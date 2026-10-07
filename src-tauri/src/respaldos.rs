//! Respaldos de la base de datos y de los archivos adjuntos.
//!
//! La copia de la base la hace SQLite mismo (`VACUUM INTO`, ver `respaldarAhora` en
//! db.ts): da un solo archivo, consistente y sin depender de los -wal/-shm. Aqui
//! solo se prepara el destino, se copian los adjuntos y se borran los respaldos
//! mas viejos.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::documentos;

/// Cuantos respaldos conservamos antes de empezar a borrar los mas viejos.
const RESPALDOS_A_CONSERVAR: usize = 40;

fn carpeta_respaldos(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .map_err(|e| format!("No se pudo ubicar la carpeta Documentos: {e}"))?;
    let dir = base.join("Consultorio").join("Respaldos");
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta de respaldos: {e}"))?;
    Ok(dir)
}

/// Paso 1: devuelve la ruta (aun inexistente) donde el frontend debe escribir la
/// copia de la base con `VACUUM INTO`.
#[tauri::command]
pub fn preparar_respaldo(app: tauri::AppHandle) -> Result<String, String> {
    let dir = carpeta_respaldos(&app)?;
    let sello = chrono::Local::now().format("%Y-%m-%d_%H%M%S").to_string();
    let destino = dir.join(format!("clinica_{sello}.db"));
    if destino.exists() {
        return Err("Ya se hizo un respaldo hace un instante. Espera unos segundos.".into());
    }
    Ok(destino.display().to_string())
}

/// Paso 2: confirma que la copia quedo escrita, respalda los adjuntos nuevos y
/// borra los respaldos que sobren.
#[tauri::command]
pub fn finalizar_respaldo(app: tauri::AppHandle, ruta: String) -> Result<(), String> {
    let dir = carpeta_respaldos(&app)?;
    let copia = PathBuf::from(&ruta);

    // Solo se acepta un archivo que este directamente dentro de la carpeta de respaldos.
    if copia.parent() != Some(dir.as_path()) {
        return Err("Ruta de respaldo invalida.".into());
    }
    let escrito = fs::metadata(&copia).map(|m| m.len() > 0).unwrap_or(false);
    if !escrito {
        return Err("La copia de la base de datos no se escribio.".into());
    }

    let origen_docs = documentos::carpeta_base(&app)?;
    if origen_docs.exists() {
        copiar_faltantes(&origen_docs, &dir.join("documentos"))
            .map_err(|e| format!("No se pudieron respaldar los archivos adjuntos: {e}"))?;
    }

    limpiar_respaldos_viejos(&dir, RESPALDOS_A_CONSERVAR);
    Ok(())
}

/// Copia a `destino` los archivos de `origen` que todavia no estan alli, conservando
/// la estructura de carpetas. Los adjuntos nunca se sobrescriben ni se borran del
/// disco (la papelera es logica), por eso basta copiar los que faltan: cada
/// respaldo no necesita volver a duplicar todo.
fn copiar_faltantes(origen: &Path, destino: &Path) -> io::Result<usize> {
    fs::create_dir_all(destino)?;
    let mut copiados = 0;
    for entrada in fs::read_dir(origen)? {
        let entrada = entrada?;
        let ruta = entrada.path();
        let objetivo = destino.join(entrada.file_name());
        if entrada.file_type()?.is_dir() {
            copiados += copiar_faltantes(&ruta, &objetivo)?;
        } else if !objetivo.exists() {
            fs::copy(&ruta, &objetivo)?;
            copiados += 1;
        }
    }
    Ok(copiados)
}

fn limpiar_respaldos_viejos(dir: &Path, conservar: usize) {
    let Ok(entradas) = fs::read_dir(dir) else { return };
    let mut archivos: Vec<PathBuf> = entradas
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("clinica_") && n.ends_with(".db"))
                .unwrap_or(false)
        })
        .collect();

    if archivos.len() <= conservar {
        return;
    }

    archivos.sort(); // el sello de tiempo ordena cronologicamente
    let sobrantes = archivos.len() - conservar;
    for viejo in archivos.into_iter().take(sobrantes) {
        let _ = fs::remove_file(&viejo);
        // Los respaldos de versiones anteriores incluian estos acompanantes.
        for extra in ["-wal", "-shm"] {
            let _ = fs::remove_file(format!("{}{}", viejo.display(), extra));
        }
    }
}

#[tauri::command]
pub fn abrir_carpeta_respaldos(app: tauri::AppHandle) -> Result<(), String> {
    let dir = carpeta_respaldos(&app)?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[tauri::command]
pub fn ruta_respaldos(app: tauri::AppHandle) -> Result<String, String> {
    carpeta_respaldos(&app).map(|p| p.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn carpeta_temporal(etiqueta: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "consultorio_test_{etiqueta}_{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn conserva_solo_los_mas_recientes() {
        let dir = carpeta_temporal("rotacion");
        for dia in 1..=5 {
            fs::write(dir.join(format!("clinica_2026-07-0{dia}_100000.db")), b"x").unwrap();
        }
        fs::write(dir.join("clinica_2026-07-01_100000.db-wal"), b"x").unwrap();
        fs::write(dir.join("otro_archivo.txt"), b"x").unwrap();

        limpiar_respaldos_viejos(&dir, 3);

        let quedan = |n: &str| dir.join(n).exists();
        assert!(!quedan("clinica_2026-07-01_100000.db"));
        assert!(!quedan("clinica_2026-07-01_100000.db-wal"));
        assert!(!quedan("clinica_2026-07-02_100000.db"));
        assert!(quedan("clinica_2026-07-03_100000.db"));
        assert!(quedan("clinica_2026-07-05_100000.db"));
        assert!(quedan("otro_archivo.txt"), "no debe tocar archivos ajenos");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_borra_nada_si_hay_pocos() {
        let dir = carpeta_temporal("pocos");
        fs::write(dir.join("clinica_2026-07-01_100000.db"), b"x").unwrap();
        limpiar_respaldos_viejos(&dir, 3);
        assert!(dir.join("clinica_2026-07-01_100000.db").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn copia_solo_los_adjuntos_que_faltan() {
        let origen = carpeta_temporal("adj_origen");
        let destino = carpeta_temporal("adj_destino");
        fs::create_dir_all(origen.join("7")).unwrap();
        fs::write(origen.join("7").join("a.pdf"), b"uno").unwrap();
        fs::write(origen.join("7").join("b.pdf"), b"dos").unwrap();

        assert_eq!(copiar_faltantes(&origen, &destino).unwrap(), 2);
        assert_eq!(fs::read(destino.join("7").join("a.pdf")).unwrap(), b"uno");

        // Segunda pasada: nada nuevo, y un archivo nuevo si se copia.
        assert_eq!(copiar_faltantes(&origen, &destino).unwrap(), 0);
        fs::write(origen.join("7").join("c.pdf"), b"tres").unwrap();
        assert_eq!(copiar_faltantes(&origen, &destino).unwrap(), 1);

        let _ = fs::remove_dir_all(&origen);
        let _ = fs::remove_dir_all(&destino);
    }
}
