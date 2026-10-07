import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Carpeta con las migraciones reales que usa la app (las mismas que aplica Rust). */
export const CARPETA_MIGRACIONES = join(process.cwd(), "src-tauri", "migrations");

export function archivosDeMigracion(): string[] {
  return readdirSync(CARPETA_MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

type Valor = string | number | null;

/**
 * Base SQLite en memoria con TODAS las migraciones aplicadas, y una fachada con la
 * misma forma que `Database` de @tauri-apps/plugin-sql (execute/select con
 * parámetros `$1, $2...`). Sirve para probar `db.ts` y los triggers con SQL real.
 */
export function crearBaseEnMemoria() {
  const sqlite = new DatabaseSync(":memory:");
  for (const archivo of archivosDeMigracion()) {
    sqlite.exec(readFileSync(join(CARPETA_MIGRACIONES, archivo), "utf8"));
  }

  const enlazar = (params: Valor[]) =>
    Object.fromEntries(params.map((v, i) => [`$${i + 1}`, v]));

  const fachada = {
    async execute(sql: string, params: Valor[] = []) {
      const r = sqlite.prepare(sql).run(enlazar(params));
      return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
    },
    async select<T>(sql: string, params: Valor[] = []): Promise<T> {
      return sqlite.prepare(sql).all(enlazar(params)) as T;
    },
  };

  return { sqlite, fachada };
}
