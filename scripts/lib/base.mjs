// Utilidades compartidas por los scripts que preparan una base de datos de prueba.
// Necesitan Node 22.5 o superior (usan node:sqlite).

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
export const CARPETA_SCRIPTS = join(aqui, "..");
const CARPETA_MIGRACIONES = join(CARPETA_SCRIPTS, "..", "src-tauri", "migrations");

/** Base de trabajo de la app en Windows: %APPDATA%\com.consultorio.expediente\clinica.db */
export function rutaPorDefecto() {
  return join(process.env.APPDATA ?? "", "com.consultorio.expediente", "clinica.db");
}

/** Si ya hay una base en `ruta`, la renombra (no la borra). Devuelve el nombre nuevo o null. */
export function apartarBase(ruta) {
  if (!existsSync(ruta)) return null;
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  for (const extra of ["", "-wal", "-shm"]) {
    if (existsSync(ruta + extra)) renameSync(ruta + extra, `${ruta}.antes-${sello}${extra}`);
  }
  return `${ruta}.antes-${sello}`;
}

/**
 * Crea una base nueva con las migraciones 1..`hastaVersion` aplicadas y registradas en
 * `_sqlx_migrations` con su checksum SHA-384, igual que lo hace el migrador de la app.
 * Así, al abrirla, la app solo aplica las migraciones que falten.
 */
export function crearBase(ruta, hastaVersion) {
  mkdirSync(dirname(ruta), { recursive: true });
  const archivos = readdirSync(CARPETA_MIGRACIONES)
    .filter((f) => f.endsWith(".sql") && Number(f.slice(0, 3)) <= hastaVersion)
    .sort();

  const db = new DatabaseSync(ruta);
  db.exec(`CREATE TABLE _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    checksum BLOB NOT NULL,
    execution_time BIGINT NOT NULL
  )`);
  const registrar = db.prepare(
    "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES (?, ?, 1, ?, 0)"
  );
  for (const archivo of archivos) {
    const sql = readFileSync(join(CARPETA_MIGRACIONES, archivo));
    db.exec(sql.toString("utf8"));
    registrar.run(
      Number(archivo.slice(0, 3)),
      archivo.slice(4, -4).replace(/_/g, " "),
      createHash("sha384").update(sql).digest()
    );
  }
  return db;
}

export function cargarDemo(db) {
  db.exec(readFileSync(join(CARPETA_SCRIPTS, "datos-demo.sql"), "utf8"));
}
