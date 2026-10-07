// Evita que se abra la consola de Windows junto con la app en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    consultorio_lib::run()
}
