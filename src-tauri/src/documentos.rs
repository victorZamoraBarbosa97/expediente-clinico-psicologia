//! Archivos adjuntos de los pacientes.
//!
//! Viven junto a la base de datos (`app_config_dir/documentos/<id_paciente>/`), no
//! en Documentos: son archivos que la app administra por completo (nombres,
//! colisiones, papelera logica), no algo pensado para reordenar a mano.

use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

/// Carpeta que contiene las carpetas de todos los pacientes.
pub fn carpeta_base(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("No se pudo ubicar la carpeta de datos: {e}"))?;
    Ok(base.join("documentos"))
}

fn carpeta_paciente(app: &tauri::AppHandle, paciente_id: i64) -> Result<PathBuf, String> {
    if paciente_id <= 0 {
        return Err("Paciente invalido.".into());
    }
    let dir = carpeta_base(app)?.join(paciente_id.to_string());
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta del paciente: {e}"))?;
    Ok(dir)
}

/// `nombre` llega del frontend y se une a una ruta: tiene que ser solo un nombre de
/// archivo, sin separadores ni `..`, para que no se pueda salir de la carpeta del
/// paciente.
fn nombre_valido(nombre: &str) -> bool {
    !nombre.is_empty() && Path::new(nombre).file_name() == Some(OsStr::new(nombre))
}

fn ruta_de(app: &tauri::AppHandle, paciente_id: i64, nombre: &str) -> Result<PathBuf, String> {
    if !nombre_valido(nombre) {
        return Err("Nombre de archivo invalido.".into());
    }
    let ruta = carpeta_paciente(app, paciente_id)?.join(nombre);
    if !ruta.exists() {
        return Err("El archivo ya no esta en el disco.".into());
    }
    Ok(ruta)
}

/// Primer nombre libre en `carpeta`: el original, o "nombre (1).ext", "nombre (2).ext"...
fn nombre_sin_colision(carpeta: &Path, original: &str) -> String {
    let ruta = Path::new(original);
    let base = ruta
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| original.to_string());
    let ext = ruta.extension().map(|s| s.to_string_lossy().to_string());

    let mut candidato = original.to_string();
    let mut consecutivo = 1;
    while carpeta.join(&candidato).exists() {
        candidato = match &ext {
            Some(e) => format!("{base} ({consecutivo}).{e}"),
            None => format!("{base} ({consecutivo})"),
        };
        consecutivo += 1;
    }
    candidato
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopiaDocumento {
    nombre: String,
    nombre_original: String,
    extension: Option<String>,
    tamano: u64,
}

/// Copia un archivo elegido por la usuaria (dialogo o arrastrar-y-soltar) a la
/// carpeta del paciente. Nunca sobrescribe.
#[tauri::command]
pub fn copiar_documento(
    app: tauri::AppHandle,
    paciente_id: i64,
    ruta_origen: String,
) -> Result<CopiaDocumento, String> {
    let origen = PathBuf::from(&ruta_origen);
    if !origen.is_file() {
        return Err("Ese archivo ya no existe en su ubicacion original.".into());
    }

    let nombre_original = origen
        .file_name()
        .ok_or("Nombre de archivo invalido")?
        .to_string_lossy()
        .to_string();
    let extension = origen.extension().map(|s| s.to_string_lossy().to_string());

    let carpeta = carpeta_paciente(&app, paciente_id)?;
    let nombre = nombre_sin_colision(&carpeta, &nombre_original);
    let destino = carpeta.join(&nombre);

    fs::copy(&origen, &destino).map_err(|e| format!("No se pudo copiar el archivo: {e}"))?;
    let tamano = fs::metadata(&destino).map(|m| m.len()).unwrap_or(0);

    Ok(CopiaDocumento {
        nombre,
        nombre_original,
        extension,
        tamano,
    })
}

#[tauri::command]
pub fn abrir_documento(app: tauri::AppHandle, paciente_id: i64, nombre: String) -> Result<(), String> {
    let ruta = ruta_de(&app, paciente_id, &nombre)?;
    app.opener()
        .open_path(ruta.display().to_string(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir el archivo: {e}"))
}

#[tauri::command]
pub fn revelar_documento(app: tauri::AppHandle, paciente_id: i64, nombre: String) -> Result<(), String> {
    let ruta = ruta_de(&app, paciente_id, &nombre)?;
    app.opener()
        .reveal_item_in_dir(&ruta)
        .map_err(|e| format!("No se pudo mostrar el archivo en su carpeta: {e}"))
}

#[tauri::command]
pub fn abrir_carpeta_documentos(app: tauri::AppHandle, paciente_id: i64) -> Result<(), String> {
    let dir = carpeta_paciente(&app, paciente_id)?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
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
    fn acepta_nombres_normales() {
        assert!(nombre_valido("resultado.pdf"));
        assert!(nombre_valido("resultado (1).pdf"));
        assert!(nombre_valido("sin extension"));
    }

    #[test]
    fn rechaza_recorrido_de_rutas() {
        assert!(!nombre_valido(""));
        assert!(!nombre_valido(".."));
        assert!(!nombre_valido("../clinica.db"));
        assert!(!nombre_valido("sub/archivo.pdf"));
        assert!(!nombre_valido("sub\\archivo.pdf") || cfg!(not(windows)));
        assert!(!nombre_valido("/etc/passwd"));
    }

    #[test]
    fn agrega_consecutivo_si_el_nombre_existe() {
        let dir = carpeta_temporal("colision");
        assert_eq!(nombre_sin_colision(&dir, "nota.txt"), "nota.txt");

        fs::write(dir.join("nota.txt"), b"a").unwrap();
        assert_eq!(nombre_sin_colision(&dir, "nota.txt"), "nota (1).txt");

        fs::write(dir.join("nota (1).txt"), b"b").unwrap();
        assert_eq!(nombre_sin_colision(&dir, "nota.txt"), "nota (2).txt");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn colision_sin_extension() {
        let dir = carpeta_temporal("sin_ext");
        fs::write(dir.join("LEEME"), b"a").unwrap();
        assert_eq!(nombre_sin_colision(&dir, "LEEME"), "LEEME (1)");
        let _ = fs::remove_dir_all(&dir);
    }
}
