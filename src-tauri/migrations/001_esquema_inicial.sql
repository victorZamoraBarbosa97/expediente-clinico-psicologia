
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS pacientes (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            folio                   TEXT    NOT NULL UNIQUE,
            nombre                  TEXT    NOT NULL,
            fecha_nacimiento        TEXT,
            sexo                    TEXT,
            telefono                TEXT,
            email                   TEXT,
            domicilio               TEXT,
            ocupacion               TEXT,
            estado_civil            TEXT,
            escolaridad             TEXT,
            emergencia_nombre       TEXT,
            emergencia_telefono     TEXT,
            emergencia_parentesco   TEXT,
            motivo_consulta         TEXT,
            antecedentes            TEXT,
            impresion_diagnostica   TEXT,
            plan_tratamiento        TEXT,
            notas_generales         TEXT,
            fecha_ingreso           TEXT    NOT NULL,
            archivado               INTEGER NOT NULL DEFAULT 0,
            eliminado_en            TEXT,
            creado_en               TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            actualizado_en          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS sesiones (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id     INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
            numero          INTEGER NOT NULL,
            fecha           TEXT    NOT NULL,
            hora            TEXT,
            duracion_min    INTEGER NOT NULL DEFAULT 50,
            modalidad       TEXT    NOT NULL DEFAULT 'Presencial',
            asistio         INTEGER NOT NULL DEFAULT 1,
            notas_evolucion TEXT,
            intervenciones  TEXT,
            tareas          TEXT,
            proxima_cita    TEXT,
            eliminado_en    TEXT,
            creado_en       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            actualizado_en  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS documentos (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id  INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
            titulo       TEXT    NOT NULL,
            tipo         TEXT,
            ruta         TEXT    NOT NULL,
            eliminado_en TEXT,
            creado_en    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        );

        -- Rastro de cambios. La NOM-004 pide poder saber quien escribio que y cuando;
        -- aqui no hay multiusuario, pero el historial sirve para recuperar texto perdido.
        CREATE TABLE IF NOT EXISTS bitacora (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            tabla       TEXT NOT NULL,
            registro_id INTEGER NOT NULL,
            accion      TEXT NOT NULL,
            detalle     TEXT,
            momento     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_pacientes_nombre  ON pacientes(nombre);
        CREATE INDEX IF NOT EXISTS idx_pacientes_activos ON pacientes(eliminado_en, archivado);
        CREATE INDEX IF NOT EXISTS idx_sesiones_paciente ON sesiones(paciente_id, fecha DESC);
        CREATE INDEX IF NOT EXISTS idx_docs_paciente     ON documentos(paciente_id);
        