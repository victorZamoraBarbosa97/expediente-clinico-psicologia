-- Bitacora automatica e inmutable, y borrado suave en cascada dentro de la base.
--
-- Antes, la app hacia varias escrituras sueltas (UPDATE paciente, UPDATE sesiones,
-- UPDATE documentos, INSERT bitacora). tauri-plugin-sql usa un pool de conexiones,
-- asi que no se puede abrir una transaccion desde el frontend; si algo fallaba a
-- medias el expediente quedaba a medio borrar o sin rastro en la bitacora.
-- Con triggers, cada accion es UNA sentencia y SQLite la ejecuta de forma atomica.
--
-- Las ediciones de campos siguen anotandose desde la app (ver db.ts): solo la app
-- sabe cuando termina una sesion de edicion y vale la pena dejar una marca.

-- Un numero de sesion no puede repetirse dentro del mismo paciente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesiones_numero ON sesiones(paciente_id, numero);

-- La bitacora es de solo lectura: ni la app ni un error pueden reescribir el pasado.
CREATE TRIGGER bitacora_no_editar BEFORE UPDATE ON bitacora
BEGIN
    SELECT RAISE(ABORT, 'La bitacora es de solo lectura');
END;

CREATE TRIGGER bitacora_no_borrar BEFORE DELETE ON bitacora
BEGIN
    SELECT RAISE(ABORT, 'La bitacora es de solo lectura');
END;

/* ------------------------------- Pacientes ------------------------------- */

CREATE TRIGGER pacientes_alta AFTER INSERT ON pacientes
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    VALUES ('pacientes', NEW.id, 'alta', NEW.folio || ' — ' || NEW.nombre);
END;

CREATE TRIGGER pacientes_archivar AFTER UPDATE OF archivado ON pacientes
WHEN OLD.archivado <> NEW.archivado
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    VALUES ('pacientes', NEW.id,
            CASE WHEN NEW.archivado = 1 THEN 'archivar' ELSE 'reactivar' END,
            NEW.folio || ' — ' || NEW.nombre);
END;

-- Eliminar: se lleva con el MISMO sello de tiempo a las sesiones y documentos que
-- seguian activos (los que ya estaban en su papelera no se tocan).
CREATE TRIGGER pacientes_eliminar AFTER UPDATE OF eliminado_en ON pacientes
WHEN OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL
BEGIN
    UPDATE sesiones SET eliminado_en = NEW.eliminado_en
     WHERE paciente_id = NEW.id AND eliminado_en IS NULL;
    UPDATE documentos SET eliminado_en = NEW.eliminado_en
     WHERE paciente_id = NEW.id AND eliminado_en IS NULL;
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    VALUES ('pacientes', NEW.id, 'eliminar', NEW.folio || ' — ' || NEW.nombre);
END;

-- Restaurar: BEFORE, para que el paciente todavia tenga su sello viejo mientras
-- se restauran solo las sesiones y documentos que coinciden exactamente con el.
-- Los triggers de sesiones/documentos usan esa misma condicion para no llenar la
-- bitacora con una linea por cada hijo restaurado en cascada.
CREATE TRIGGER pacientes_restaurar BEFORE UPDATE OF eliminado_en ON pacientes
WHEN OLD.eliminado_en IS NOT NULL AND NEW.eliminado_en IS NULL
BEGIN
    UPDATE sesiones SET eliminado_en = NULL
     WHERE paciente_id = NEW.id AND eliminado_en = OLD.eliminado_en;
    UPDATE documentos SET eliminado_en = NULL
     WHERE paciente_id = NEW.id AND eliminado_en = OLD.eliminado_en;
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    VALUES ('pacientes', NEW.id, 'restaurar', NEW.folio || ' — ' || NEW.nombre);
END;

/* -------------------------------- Sesiones -------------------------------- */

CREATE TRIGGER sesiones_alta AFTER INSERT ON sesiones
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'sesiones', NEW.id, 'alta',
           p.folio || ' — ' || p.nombre || ', sesión ' || NEW.numero
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;

CREATE TRIGGER sesiones_eliminar AFTER UPDATE OF eliminado_en ON sesiones
WHEN OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM pacientes p
                  WHERE p.id = NEW.paciente_id AND p.eliminado_en = NEW.eliminado_en)
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'sesiones', NEW.id, 'eliminar',
           p.folio || ' — ' || p.nombre || ', sesión ' || NEW.numero
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;

CREATE TRIGGER sesiones_restaurar AFTER UPDATE OF eliminado_en ON sesiones
WHEN OLD.eliminado_en IS NOT NULL AND NEW.eliminado_en IS NULL
 AND NOT EXISTS (SELECT 1 FROM pacientes p
                  WHERE p.id = NEW.paciente_id AND p.eliminado_en = OLD.eliminado_en)
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'sesiones', NEW.id, 'restaurar',
           p.folio || ' — ' || p.nombre || ', sesión ' || NEW.numero
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;

/* ------------------------------- Documentos ------------------------------- */

CREATE TRIGGER documentos_alta AFTER INSERT ON documentos
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'documentos', NEW.id, 'alta',
           p.folio || ' — ' || p.nombre || ', "' || NEW.titulo || '"'
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;

CREATE TRIGGER documentos_eliminar AFTER UPDATE OF eliminado_en ON documentos
WHEN OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM pacientes p
                  WHERE p.id = NEW.paciente_id AND p.eliminado_en = NEW.eliminado_en)
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'documentos', NEW.id, 'eliminar',
           p.folio || ' — ' || p.nombre || ', "' || NEW.titulo || '"'
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;

CREATE TRIGGER documentos_restaurar AFTER UPDATE OF eliminado_en ON documentos
WHEN OLD.eliminado_en IS NOT NULL AND NEW.eliminado_en IS NULL
 AND NOT EXISTS (SELECT 1 FROM pacientes p
                  WHERE p.id = NEW.paciente_id AND p.eliminado_en = OLD.eliminado_en)
BEGIN
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    SELECT 'documentos', NEW.id, 'restaurar',
           p.folio || ' — ' || p.nombre || ', "' || NEW.titulo || '"'
      FROM pacientes p WHERE p.id = NEW.paciente_id;
END;
