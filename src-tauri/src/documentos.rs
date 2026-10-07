//! Archivos adjuntos de los pacientes.
//!
//! Viven junto a la base de datos (`app_config_dir/documentos/<id_paciente>/`), no
//! en Documentos: son archivos que la app administra por completo (nombres,
//! colisiones, papelera logica), no algo pensado para reordenar a mano.

use std::ffi::OsStr;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use base64::Engine;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
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

/// Lado mayor de la miniatura, en píxeles.
const LADO_MINIATURA: u32 = 240;
/// Imágenes más pesadas que esto no se decodifican para la miniatura (se muestra el ícono).
const MAX_BYTES_MINIATURA: u64 = 40 * 1024 * 1024;

fn es_imagen(nombre: &str) -> bool {
    Path::new(nombre)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            matches!(
                e.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"
            )
        })
        .unwrap_or(false)
}

/// Reduce la imagen a una miniatura y la devuelve como URL `data:` lista para un `<img>`.
/// Respeta la orientación EXIF (las fotos de celular suelen venir "acostadas").
fn generar_miniatura(ruta: &Path) -> Result<String, String> {
    let peso = fs::metadata(ruta).map(|m| m.len()).unwrap_or(0);
    if peso > MAX_BYTES_MINIATURA {
        return Err("La imagen es demasiado grande para una miniatura.".into());
    }

    let lector = ImageReader::open(ruta)
        .map_err(|e| format!("No se pudo abrir la imagen: {e}"))?
        .with_guessed_format()
        .map_err(|e| format!("No se pudo leer la imagen: {e}"))?;
    let mut decodificador = lector
        .into_decoder()
        .map_err(|e| format!("Formato de imagen no reconocido: {e}"))?;
    let orientacion = decodificador.orientation().ok();
    let mut imagen = DynamicImage::from_decoder(decodificador)
        .map_err(|e| format!("No se pudo decodificar la imagen: {e}"))?;
    if let Some(o) = orientacion {
        imagen.apply_orientation(o);
    }

    let mini = imagen.thumbnail(LADO_MINIATURA, LADO_MINIATURA);
    let mut salida = Cursor::new(Vec::new());
    // JPEG para fotos (mucho más liviano); PNG solo si hay transparencia que conservar.
    let mime = if mini.color().has_alpha() {
        mini.write_to(&mut salida, ImageFormat::Png)
            .map_err(|e| format!("No se pudo crear la miniatura: {e}"))?;
        "image/png"
    } else {
        DynamicImage::ImageRgb8(mini.to_rgb8())
            .write_to(&mut salida, ImageFormat::Jpeg)
            .map_err(|e| format!("No se pudo crear la miniatura: {e}"))?;
        "image/jpeg"
    };

    let base64 = base64::engine::general_purpose::STANDARD.encode(salida.into_inner());
    Ok(format!("data:{mime};base64,{base64}"))
}

/// Miniatura de una imagen adjunta. Es `async` y decodifica en un hilo aparte para no
/// congelar la ventana con fotos grandes.
#[tauri::command]
pub async fn miniatura_documento(
    app: tauri::AppHandle,
    paciente_id: i64,
    nombre: String,
) -> Result<String, String> {
    if !es_imagen(&nombre) {
        return Err("Ese archivo no es una imagen.".into());
    }
    let ruta = ruta_de(&app, paciente_id, &nombre)?;
    tauri::async_runtime::spawn_blocking(move || generar_miniatura(&ruta))
        .await
        .map_err(|e| format!("No se pudo crear la miniatura: {e}"))?
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
    fn reconoce_las_extensiones_de_imagen() {
        assert!(es_imagen("foto.JPG"));
        assert!(es_imagen("dibujo.png"));
        assert!(!es_imagen("estudio.pdf"));
        assert!(!es_imagen("sin_extension"));
        assert!(!es_imagen("logo.svg"));
    }

    #[test]
    fn la_miniatura_es_pequena_y_valida() {
        let dir = carpeta_temporal("miniatura");
        let ruta = dir.join("grande.png");
        image::RgbImage::from_pixel(1200, 600, image::Rgb([30, 120, 90]))
            .save(&ruta)
            .unwrap();

        let url = generar_miniatura(&ruta).unwrap();
        let datos = url.strip_prefix("data:image/jpeg;base64,").expect("JPEG sin transparencia");
        let bytes = base64::engine::general_purpose::STANDARD.decode(datos).unwrap();
        let mini = image::load_from_memory(&bytes).unwrap();
        assert_eq!((mini.width(), mini.height()), (240, 120)); // conserva la proporción

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn archivo_que_no_es_imagen_da_error_sin_romper() {
        let dir = carpeta_temporal("falsa");
        let ruta = dir.join("falsa.png");
        fs::write(&ruta, b"esto no es una imagen").unwrap();
        assert!(generar_miniatura(&ruta).is_err());
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
