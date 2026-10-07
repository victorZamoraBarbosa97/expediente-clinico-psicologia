//! Enciende o apaga "Acceso por voz" de Windows, la funcion de accesibilidad para
//! dictar y navegar por comandos de voz. Solo existe desde Windows 11 22H2.
//!
//! No hay una forma documentada de preguntarle a Windows si esta encendido ni de
//! encenderlo/apagarlo por separado: la unica via es el atajo Win+Ctrl+S, que el
//! propio Acceso por voz interpreta como interruptor. Por eso se simula esa
//! combinacion de teclas.

#[cfg(windows)]
mod windows {
    use std::path::PathBuf;
    use std::time::Duration;

    #[link(name = "user32")]
    extern "system" {
        fn keybd_event(bvk: u8, bscan: u8, dwflags: u32, dwextrainfo: usize);
    }

    const VK_LWIN: u8 = 0x5B;
    const VK_CONTROL: u8 = 0x11;
    const VK_S: u8 = 0x53;
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    /// `%SystemRoot%\System32\VoiceAccess.exe`; Windows no siempre vive en C:\Windows.
    fn ejecutable() -> PathBuf {
        let raiz = std::env::var_os("SystemRoot")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
        raiz.join("System32").join("VoiceAccess.exe")
    }

    pub fn alternar() -> Result<(), String> {
        if !ejecutable().exists() {
            return Err("Esta version de Windows no incluye Acceso por voz.".into());
        }
        // SAFETY: keybd_event solo recibe enteros y no retiene punteros.
        unsafe {
            keybd_event(VK_LWIN, 0, 0, 0);
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_S, 0, 0, 0);
            std::thread::sleep(Duration::from_millis(50));
            keybd_event(VK_S, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        }
        Ok(())
    }
}

#[tauri::command]
pub fn alternar_acceso_por_voz() -> Result<(), String> {
    #[cfg(windows)]
    {
        windows::alternar()
    }
    #[cfg(not(windows))]
    {
        Err("Acceso por voz solo existe en Windows.".into())
    }
}
