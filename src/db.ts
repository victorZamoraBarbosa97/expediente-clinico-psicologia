import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import {
  CAMPOS_PACIENTE,
  CAMPOS_SESION,
  OBLIGATORIOS_PACIENTE,
  OBLIGATORIOS_SESION,
  definicionDe,
} from "./campos";
import type { CampoPaciente, CampoSesion } from "./campos";
import type { Bitacora, DatosPaciente, Documento, Paciente, PacienteEnLista, Sesion } from "./tipos";
import { ahora, hoy, horaEnPunto } from "./utilidades/fechas";
import { siguienteFolio } from "./utilidades/folio";

/*
 * Toda la base de datos pasa por este archivo.
 *
 * La bitácora de altas, bajas y restauraciones, y el borrado en cascada de un
 * paciente, los hacen triggers de SQLite (migración 007): cada acción es una sola
 * sentencia y, por lo tanto, atómica. Desde aquí solo se anotan las ediciones de
 * campos, porque solo la interfaz sabe cuándo termina una sesión de edición.
 */

let conexion: Database | null = null;

export async function db(): Promise<Database> {
  if (!conexion) {
    conexion = await Database.load("sqlite:clinica.db");
    // journal_mode no se puede cambiar dentro de una transaccion, por eso va aqui y
    // no en una migracion; ademas queda guardado en el archivo. NORMAL es seguro con
    // WAL: aguanta la caida de la app sin perder datos, y para el apagon fisico
    // esta el respaldo.
    await conexion.execute("PRAGMA journal_mode = WAL");
    await conexion.execute("PRAGMA synchronous = NORMAL");
    // Ojo: esto vale solo para la conexion que lo ejecuta (el plugin usa un pool).
    // Por eso la integridad no depende de las llaves foraneas, sino de que nada se
    // borra de verdad y de los triggers.
    await conexion.execute("PRAGMA foreign_keys = ON");
  }
  return conexion;
}

/** Rastro de una edición de campo. Altas, bajas y restauraciones las anotan los triggers. */
async function anotarEdicion(tabla: string, id: number, detalle: string) {
  const d = await db();
  await d.execute(
    "INSERT INTO bitacora (tabla, registro_id, accion, detalle) VALUES ($1, $2, 'editar', $3)",
    [tabla, id, detalle]
  );
}

function validarCampo(
  campo: string,
  permitidos: readonly string[],
  obligatorios: readonly string[],
  valor: string | number,
  entidad: string
) {
  // El nombre del campo se interpola directo en el SQL del UPDATE, asi que se
  // valida contra la lista blanca antes de tocar la base.
  if (!permitidos.includes(campo)) {
    throw new Error(`Campo de ${entidad} no permitido: ${campo}`);
  }
  if (valor === "" && obligatorios.includes(campo)) {
    throw new Error(`El campo ${campo.replace(/_/g, " ")} no puede quedar vacío.`);
  }
  if (campo === "duracion_min" && !(Number.isInteger(Number(valor)) && Number(valor) > 0)) {
    throw new Error("La duración debe ser un número entero de minutos, mayor que cero.");
  }
}

/* ------------------------------- Pacientes ------------------------------- */

/** Pacientes con su total de sesiones y la fecha de la última. La búsqueda por texto
 * se hace en memoria (ver utilidades/busqueda.ts). */
export async function listarPacientes(incluirArchivados = false): Promise<PacienteEnLista[]> {
  const d = await db();
  return d.select<PacienteEnLista[]>(
    `SELECT p.*,
            COALESCE(s.total, 0) AS total_sesiones,
            s.ultima             AS ultima_sesion
       FROM pacientes p
       LEFT JOIN (SELECT paciente_id, COUNT(*) AS total, MAX(fecha) AS ultima
                    FROM sesiones
                   WHERE eliminado_en IS NULL
                   GROUP BY paciente_id) s ON s.paciente_id = p.id
      WHERE p.eliminado_en IS NULL
        AND ($1 = 1 OR p.archivado = 0)
      ORDER BY p.archivado ASC, p.nombre COLLATE NOCASE ASC`,
    [incluirArchivados ? 1 : 0]
  );
}

export async function obtenerPaciente(id: number): Promise<Paciente | null> {
  const d = await db();
  const filas = await d.select<Paciente[]>(
    "SELECT * FROM pacientes WHERE id = $1 AND eliminado_en IS NULL",
    [id]
  );
  return filas[0] ?? null;
}

/** Folio legible tipo EXP-2026-014. Cuenta también los pacientes eliminados: el folio no se reutiliza. */
async function nuevoFolio(): Promise<string> {
  const d = await db();
  const anio = new Date().getFullYear();
  const filas = await d.select<{ folio: string }[]>(
    "SELECT folio FROM pacientes WHERE folio LIKE $1",
    [`EXP-${anio}-%`]
  );
  return siguienteFolio(
    filas.map((f) => f.folio),
    anio
  );
}

export async function crearPaciente(datos: DatosPaciente): Promise<number> {
  const d = await db();
  const folio = datos.folio?.trim() || (await nuevoFolio());
  const valorDe = (campo: CampoPaciente): string | null => {
    if (campo === "nombre") return datos.nombre?.trim() ?? "";
    if (campo === "fecha_ingreso") return datos.fecha_ingreso || hoy();
    return datos[campo] || null;
  };
  // Las columnas salen de la lista blanca (campos.ts), nunca del usuario.
  const columnas = ["folio", ...CAMPOS_PACIENTE];
  const marcas = columnas.map((_, i) => `$${i + 1}`).join(", ");
  const res = await d.execute(
    `INSERT INTO pacientes (${columnas.join(", ")}) VALUES (${marcas})`,
    [folio, ...CAMPOS_PACIENTE.map(valorDe)]
  );
  return Number(res.lastInsertId);
}

/**
 * Guarda un solo campo. Es lo que usa el autoguardado. `registrarBitacora` solo
 * debería venir en true en el guardado final de una sesión de edición (ver
 * CampoAuto) para no llenar la bitácora con una entrada por cada autoguardado.
 */
export async function guardarCampoPaciente(
  id: number,
  campo: CampoPaciente,
  valor: string,
  registrarBitacora = false
): Promise<void> {
  validarCampo(campo, CAMPOS_PACIENTE, OBLIGATORIOS_PACIENTE, valor, "paciente");
  const d = await db();
  await d.execute(`UPDATE pacientes SET ${campo} = $1, actualizado_en = $2 WHERE id = $3`, [
    valor === "" ? null : valor,
    ahora(),
    id,
  ]);
  if (registrarBitacora) {
    const filas = await d.select<{ folio: string; nombre: string }[]>(
      "SELECT folio, nombre FROM pacientes WHERE id = $1",
      [id]
    );
    const f = filas[0];
    if (f) {
      await anotarEdicion(
        "pacientes",
        id,
        `${f.folio} — ${f.nombre}, campo: ${definicionDe(campo).etiqueta}`
      );
    }
  }
}

export async function archivarPaciente(id: number, archivado: boolean) {
  const d = await db();
  await d.execute("UPDATE pacientes SET archivado = $1, actualizado_en = $2 WHERE id = $3", [
    archivado ? 1 : 0,
    ahora(),
    id,
  ]);
}

/**
 * Borrado suave: el expediente deja de aparecer pero sigue en la base. Un trigger
 * (migración 007) se lleva, con el mismo sello de tiempo, a las sesiones y
 * documentos que seguían activos, y deja la marca en la bitácora.
 */
export async function eliminarPaciente(id: number) {
  const d = await db();
  await d.execute("UPDATE pacientes SET eliminado_en = $1 WHERE id = $2 AND eliminado_en IS NULL", [
    ahora(),
    id,
  ]);
}

/** Deshace eliminarPaciente: el trigger restaura solo lo que se eliminó junto con él. */
export async function restaurarPaciente(id: number) {
  const d = await db();
  await d.execute(
    "UPDATE pacientes SET eliminado_en = NULL WHERE id = $1 AND eliminado_en IS NOT NULL",
    [id]
  );
}

export async function papelera(): Promise<Paciente[]> {
  const d = await db();
  return d.select<Paciente[]>(
    "SELECT * FROM pacientes WHERE eliminado_en IS NOT NULL ORDER BY eliminado_en DESC"
  );
}

/* -------------------------------- Sesiones -------------------------------- */

export async function listarSesiones(pacienteId: number): Promise<Sesion[]> {
  const d = await db();
  return d.select<Sesion[]>(
    `SELECT * FROM sesiones
      WHERE paciente_id = $1 AND eliminado_en IS NULL
      ORDER BY fecha DESC, numero DESC`,
    [pacienteId]
  );
}

/**
 * El número es el máximo del paciente más uno, contando también las eliminadas: no se
 * reutiliza nunca, para que una sesión borrada y luego restaurada no choque con una
 * nueva. Todo en una sola sentencia, así que dos altas simultáneas no pueden tomar el
 * mismo número (y el índice único de la migración 007 lo garantiza).
 */
export async function crearSesion(pacienteId: number): Promise<number> {
  const d = await db();
  const res = await d.execute(
    `INSERT INTO sesiones (paciente_id, numero, fecha, hora)
     VALUES ($1,
             (SELECT COALESCE(MAX(numero), 0) + 1 FROM sesiones WHERE paciente_id = $1),
             $2, $3)`,
    [pacienteId, hoy(), horaEnPunto()]
  );
  return Number(res.lastInsertId);
}

export async function guardarCampoSesion(
  id: number,
  campo: CampoSesion,
  valor: string | number,
  registrarBitacora = false
): Promise<void> {
  validarCampo(campo, CAMPOS_SESION, OBLIGATORIOS_SESION, valor, "sesión");
  const d = await db();
  await d.execute(`UPDATE sesiones SET ${campo} = $1, actualizado_en = $2 WHERE id = $3`, [
    valor === "" ? null : valor,
    ahora(),
    id,
  ]);
  if (registrarBitacora) {
    const filas = await d.select<{ numero: number; folio: string; nombre: string }[]>(
      `SELECT s.numero, p.folio, p.nombre
         FROM sesiones s JOIN pacientes p ON p.id = s.paciente_id
        WHERE s.id = $1`,
      [id]
    );
    const f = filas[0];
    if (f) {
      await anotarEdicion(
        "sesiones",
        id,
        `${f.folio} — ${f.nombre}, sesión ${f.numero}, campo: ${campo.replace(/_/g, " ")}`
      );
    }
  }
}

export async function eliminarSesion(id: number) {
  const d = await db();
  await d.execute("UPDATE sesiones SET eliminado_en = $1 WHERE id = $2 AND eliminado_en IS NULL", [
    ahora(),
    id,
  ]);
}

export async function restaurarSesion(id: number) {
  const d = await db();
  await d.execute(
    "UPDATE sesiones SET eliminado_en = NULL WHERE id = $1 AND eliminado_en IS NOT NULL",
    [id]
  );
}

export async function papeleraSesiones(pacienteId: number): Promise<Sesion[]> {
  const d = await db();
  return d.select<Sesion[]>(
    `SELECT * FROM sesiones
      WHERE paciente_id = $1 AND eliminado_en IS NOT NULL
      ORDER BY eliminado_en DESC`,
    [pacienteId]
  );
}

/* ------------------------------- Documentos ------------------------------- */

export async function listarDocumentos(pacienteId: number): Promise<Documento[]> {
  const d = await db();
  return d.select<Documento[]>(
    `SELECT * FROM documentos
      WHERE paciente_id = $1 AND eliminado_en IS NULL
      ORDER BY creado_en DESC`,
    [pacienteId]
  );
}

export async function papeleraDocumentos(pacienteId: number): Promise<Documento[]> {
  const d = await db();
  return d.select<Documento[]>(
    `SELECT * FROM documentos
      WHERE paciente_id = $1 AND eliminado_en IS NOT NULL
      ORDER BY eliminado_en DESC`,
    [pacienteId]
  );
}

/**
 * Registra en la base un archivo que ya fue copiado a la carpeta del paciente (ver
 * copiarDocumento). `ruta` es solo el nombre del archivo dentro de esa carpeta, no una
 * ruta absoluta: la carpeta se recalcula siempre a partir de app_config_dir + paciente_id.
 */
export async function crearDocumento(
  pacienteId: number,
  titulo: string,
  tipo: string | null,
  ruta: string,
  tamanoBytes: number | null
): Promise<number> {
  const d = await db();
  const res = await d.execute(
    "INSERT INTO documentos (paciente_id, titulo, tipo, ruta, tamano_bytes) VALUES ($1,$2,$3,$4,$5)",
    [pacienteId, titulo, tipo, ruta, tamanoBytes]
  );
  return Number(res.lastInsertId);
}

export async function eliminarDocumento(id: number) {
  const d = await db();
  await d.execute("UPDATE documentos SET eliminado_en = $1 WHERE id = $2 AND eliminado_en IS NULL", [
    ahora(),
    id,
  ]);
}

export async function restaurarDocumento(id: number) {
  const d = await db();
  await d.execute(
    "UPDATE documentos SET eliminado_en = NULL WHERE id = $1 AND eliminado_en IS NOT NULL",
    [id]
  );
}

/** Copia el archivo al disco (carpeta del paciente). No toca la base de datos. */
export const copiarDocumento = (pacienteId: number, rutaOrigen: string) =>
  invoke<{ nombre: string; nombreOriginal: string; extension: string | null; tamano: number }>(
    "copiar_documento",
    { pacienteId, rutaOrigen }
  );

export const abrirDocumento = (pacienteId: number, nombre: string) =>
  invoke<void>("abrir_documento", { pacienteId, nombre });

/** Miniatura (URL `data:`) de una imagen adjunta; falla si no es imagen o es demasiado grande. */
export const miniaturaDocumento = (pacienteId: number, nombre: string) =>
  invoke<string>("miniatura_documento", { pacienteId, nombre });

export const revelarDocumento = (pacienteId: number, nombre: string) =>
  invoke<void>("revelar_documento", { pacienteId, nombre });

export const abrirCarpetaDocumentos = (pacienteId: number) =>
  invoke<void>("abrir_carpeta_documentos", { pacienteId });

/* -------------------------------- Respaldos -------------------------------- */

/**
 * Respaldo completo: la base (una copia consistente hecha por SQLite con `VACUUM INTO`,
 * un solo archivo, sin depender de los -wal/-shm) y los archivos adjuntos que falten en
 * la carpeta de respaldos. Devuelve la ruta de la copia de la base.
 */
export async function respaldarAhora(): Promise<string> {
  const destino = await invoke<string>("preparar_respaldo");
  const d = await db();
  await d.execute("VACUUM INTO $1", [destino]);
  await invoke<void>("finalizar_respaldo", { ruta: destino });
  return destino;
}

export const abrirCarpetaRespaldos = () => invoke<void>("abrir_carpeta_respaldos");

/* ---------------------------- Cierre de la aplicación ---------------------------- */

/** Cierra la aplicación de inmediato (el respaldo ya se hizo, o se decidió omitirlo). */
export const cerrarApp = () => invoke<void>("cerrar_app");
/** Avisa a Rust que el cierre se abortó, para que no cierre por su cuenta. */
export const cancelarCierre = () => invoke<void>("cancelar_cierre");

/* ---------------------------- Accesibilidad ---------------------------- */

/** Enciende Acceso por voz si esta apagado, o lo apaga si ya esta encendido. */
export const alternarAccesoPorVoz = () => invoke<void>("alternar_acceso_por_voz");

/* -------------------------------- Bitácora -------------------------------- */

/** Rastro de altas/bajas/restauraciones/ediciones (NOM-004). Ventana oculta, ver Bitacora.tsx. */
export async function listarBitacora(limite = 300): Promise<Bitacora[]> {
  const d = await db();
  return d.select<Bitacora[]>("SELECT * FROM bitacora ORDER BY id DESC LIMIT $1", [limite]);
}
