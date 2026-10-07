mod acceso_por_voz;
mod documentos;
mod migraciones;
mod respaldos;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{Emitter, Manager, WindowEvent};

/// Nombre del archivo de base de datos. Vive en app_config_dir(), que en Windows
/// es C:\Users\<usuario>\AppData\Roaming\com.consultorio.expediente\
const ARCHIVO_DB: &str = "clinica.db";

/// Tiempo maximo que se espera al frontend para cerrar (vaciar guardados + respaldo).
/// Si la interfaz se colgo, pasado este plazo la app se cierra de todos modos.
const ESPERA_CIERRE: Duration = Duration::from_secs(30);

/// Hay un cierre en curso esperando al frontend.
static CIERRE_EN_CURSO: AtomicBool = AtomicBool::new(false);

/// El frontend termino (o descarto) el cierre y pide salir ya.
#[tauri::command]
fn cerrar_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// El frontend aborta el cierre (por ejemplo, el respaldo fallo y ella decide
/// seguir trabajando): se apaga el plazo de seguridad.
#[tauri::command]
fn cancelar_cierre() {
    CIERRE_EN_CURSO.store(false, Ordering::SeqCst);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&format!("sqlite:{ARCHIVO_DB}"), migraciones::todas())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            respaldos::preparar_respaldo,
            respaldos::finalizar_respaldo,
            respaldos::abrir_carpeta_respaldos,
            respaldos::ruta_respaldos,
            documentos::copiar_documento,
            documentos::abrir_documento,
            documentos::revelar_documento,
            documentos::abrir_carpeta_documentos,
            documentos::miniatura_documento,
            acceso_por_voz::alternar_acceso_por_voz,
            cerrar_app,
            cancelar_cierre
        ])
        .on_window_event(|window, event| {
            // No se cierra de inmediato: primero el frontend vacia los guardados
            // pendientes y hace el respaldo (si no, la ultima nota podria quedar
            // fuera de la copia), y luego pide salir con `cerrar_app`.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if CIERRE_EN_CURSO.swap(true, Ordering::SeqCst) {
                    return; // ya hay un cierre en curso
                }
                if window.emit("solicitud-cierre", ()).is_err() {
                    window.app_handle().exit(0);
                    return;
                }
                let app = window.app_handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(ESPERA_CIERRE);
                    if CIERRE_EN_CURSO.load(Ordering::SeqCst) {
                        app.exit(0);
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicacion");
}
