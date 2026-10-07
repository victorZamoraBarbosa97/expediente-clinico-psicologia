//! Migraciones de SQLite. El SQL vive en `src-tauri/migrations/*.sql`.
//!
//! REGLA: una migracion ya publicada no se edita nunca, ni un espacio. El migrador
//! de sqlx guarda el checksum del SQL de cada una; si cambia, las bases ya
//! instaladas dejan de abrir. Para cambiar el esquema se agrega la siguiente
//! version. Los checksums de las migraciones 1 a 6 estan fijados en
//! `src/migraciones.test.ts`, que falla si alguien las toca.

use tauri_plugin_sql::{Migration, MigrationKind};

fn subir(version: i64, description: &'static str, sql: &'static str) -> Migration {
    Migration {
        version,
        description,
        sql,
        kind: MigrationKind::Up,
    }
}

pub fn todas() -> Vec<Migration> {
    vec![
        subir(
            1,
            "esquema inicial: pacientes, sesiones, documentos, bitacora",
            include_str!("../migrations/001_esquema_inicial.sql"),
        ),
        subir(
            2,
            "tamano en bytes de los documentos adjuntos",
            include_str!("../migrations/002_tamano_documentos.sql"),
        ),
        subir(
            3,
            "tipo de paciente (adulto o menor) y datos de contacto de madre y padre",
            include_str!("../migrations/003_tipo_paciente_y_padres.sql"),
        ),
        subir(
            4,
            "salud general y antecedentes familiares de enfermedad",
            include_str!("../migrations/004_salud_y_antecedentes.sql"),
        ),
        subir(
            5,
            "quita notas_generales: nunca tuvo pantalla donde llenarse o leerse",
            include_str!("../migrations/005_quita_notas_generales.sql"),
        ),
        subir(
            6,
            "separa antecedentes familiares en medicos y psicologicos",
            include_str!("../migrations/006_antecedentes_familiares_separados.sql"),
        ),
        subir(
            7,
            "bitacora automatica e inmutable (triggers) y numero de sesion unico",
            include_str!("../migrations/007_bitacora_automatica.sql"),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn las_versiones_son_consecutivas_desde_uno() {
        let versiones: Vec<i64> = todas().iter().map(|m| m.version).collect();
        let esperadas: Vec<i64> = (1..=versiones.len() as i64).collect();
        assert_eq!(versiones, esperadas);
    }

    #[test]
    fn ninguna_migracion_esta_vacia() {
        assert!(todas().iter().all(|m| !m.sql.trim().is_empty()));
    }
}
