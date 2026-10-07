import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { CARPETA_MIGRACIONES, archivosDeMigracion, crearBaseEnMemoria } from "./pruebas/baseEnMemoria";

/**
 * Checksums (SHA-384, el mismo que usa sqlx) de las migraciones ya publicadas.
 * Si alguna cambia, las bases de datos ya instaladas dejan de abrir. Para cambiar el
 * esquema se agrega una migración nueva; estos valores no se tocan.
 */
const CHECKSUMS_PUBLICADOS: Record<string, string> = {
  "001_esquema_inicial.sql":
    "66de6622fd1e644835b0ec474130f66c6e74a23a4d74392dfb222742f51307be508c0f261090740bec342918b5d6ba6b",
  "002_tamano_documentos.sql":
    "f48b7230bf21928ab2b68272a2528b073d8fe5839739c1a7bc22a173d24a474ca2c6c1cbcc712623201def60ed1ac1ae",
  "003_tipo_paciente_y_padres.sql":
    "3b6494c8e9686b58cbb3a9ce31786518761eb916c8eddb1e0d091c92a5b4cf833024b5b73dd16b805cbd764a6169eafc",
  "004_salud_y_antecedentes.sql":
    "0c7cfe3864287e7068c30866b690e4c47207ac9389de2c1b6de282d3f34161394d90198be1a3db5eb31a7153396dbb7f",
  "005_quita_notas_generales.sql":
    "464807a6b1b642f3c4c5506c2dbb062d69a59711cf7bbfc4c950acb86555469481cf2ca48251e85f459a65f53dab9b1e",
  "006_antecedentes_familiares_separados.sql":
    "9936fca20b0a2878adf377cd3965582b9c4d9750c5ef1d0bd8eeddee15fbf01dad43f1d765dbcdf2bd1058ecee4cdf78",
};

describe("migraciones publicadas", () => {
  it.each(Object.entries(CHECKSUMS_PUBLICADOS))("%s no ha cambiado", (archivo, esperado) => {
    const contenido = readFileSync(join(CARPETA_MIGRACIONES, archivo));
    expect(createHash("sha384").update(contenido).digest("hex")).toBe(esperado);
  });

  it("no usa finales de línea CRLF (cambiarían el checksum)", () => {
    for (const archivo of archivosDeMigracion()) {
      expect(readFileSync(join(CARPETA_MIGRACIONES, archivo), "utf8")).not.toContain("\r");
    }
  });

  it("están numeradas de forma consecutiva", () => {
    const numeros = archivosDeMigracion().map((f) => Number(f.slice(0, 3)));
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));
  });
});

describe("esquema resultante", () => {
  it("aplica todas las migraciones sobre una base vacía", () => {
    const { sqlite } = crearBaseEnMemoria();
    const tablas = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((t) => String(t.name));
    expect(tablas).toEqual(expect.arrayContaining(["bitacora", "documentos", "pacientes", "sesiones"]));
  });
});

describe("triggers de la bitácora (migración 007)", () => {
  const alta = () => {
    const { sqlite } = crearBaseEnMemoria();
    sqlite
      .prepare("INSERT INTO pacientes (folio, nombre, fecha_ingreso) VALUES ('EXP-2026-001', 'Ana Demo', '2026-01-01')")
      .run();
    return sqlite;
  };
  const bitacora = (sqlite: ReturnType<typeof alta>) =>
    sqlite.prepare("SELECT tabla, accion, detalle FROM bitacora ORDER BY id").all();

  it("anota el alta de un paciente", () => {
    expect(bitacora(alta())).toEqual([
      expect.objectContaining({ tabla: "pacientes", accion: "alta", detalle: "EXP-2026-001 — Ana Demo" }),
    ]);
  });

  it("la bitácora no se puede editar ni borrar", () => {
    const sqlite = alta();
    expect(() => sqlite.exec("UPDATE bitacora SET detalle = 'otra cosa'")).toThrow(/solo lectura/);
    expect(() => sqlite.exec("DELETE FROM bitacora")).toThrow(/solo lectura/);
    expect(bitacora(sqlite)).toHaveLength(1);
  });

  it("eliminar un paciente se lleva sus sesiones y documentos con una sola anotación", () => {
    const sqlite = alta();
    sqlite.exec(`
      INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-01'), (1, 2, '2026-02-08');
      INSERT INTO documentos (paciente_id, titulo, ruta) VALUES (1, 'estudio.pdf', 'estudio.pdf');
      UPDATE pacientes SET eliminado_en = '2026-03-01 10:00:00' WHERE id = 1;
    `);
    const pendientes = sqlite
      .prepare("SELECT (SELECT COUNT(*) FROM sesiones WHERE eliminado_en IS NULL) s, (SELECT COUNT(*) FROM documentos WHERE eliminado_en IS NULL) d")
      .get();
    expect(pendientes).toMatchObject({ s: 0, d: 0 });
    const eliminaciones = bitacora(sqlite).filter((f) => f.accion === "eliminar");
    expect(eliminaciones).toHaveLength(1);
    expect(eliminaciones[0]).toMatchObject({ tabla: "pacientes" });
  });

  it("restaurar solo recupera lo que se eliminó junto con el paciente", () => {
    const sqlite = alta();
    sqlite.exec(`
      INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-01'), (1, 2, '2026-02-08');
      UPDATE sesiones SET eliminado_en = '2026-02-20 09:00:00' WHERE numero = 1;  -- ya estaba en su papelera
      UPDATE pacientes SET eliminado_en = '2026-03-01 10:00:00' WHERE id = 1;
      UPDATE pacientes SET eliminado_en = NULL WHERE id = 1;
    `);
    const filas = sqlite.prepare("SELECT numero, eliminado_en FROM sesiones ORDER BY numero").all();
    expect(filas).toEqual([
      expect.objectContaining({ numero: 1, eliminado_en: "2026-02-20 09:00:00" }),
      expect.objectContaining({ numero: 2, eliminado_en: null }),
    ]);
    const acciones = bitacora(sqlite).map((f) => `${f.tabla}:${f.accion}`);
    expect(acciones.filter((a) => a === "pacientes:restaurar")).toHaveLength(1);
    expect(acciones.filter((a) => a === "sesiones:restaurar")).toHaveLength(0);
  });

  it("eliminar y restaurar una sesión suelta sí queda anotado", () => {
    const sqlite = alta();
    sqlite.exec(`
      INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-01');
      UPDATE sesiones SET eliminado_en = '2026-02-02 10:00:00' WHERE id = 1;
      UPDATE sesiones SET eliminado_en = NULL WHERE id = 1;
    `);
    const acciones = bitacora(sqlite).map((f) => `${f.tabla}:${f.accion}`);
    expect(acciones).toEqual([
      "pacientes:alta",
      "sesiones:alta",
      "sesiones:eliminar",
      "sesiones:restaurar",
    ]);
  });

  it("anota el cierre y la reapertura del expediente", () => {
    const sqlite = alta();
    sqlite.exec("UPDATE pacientes SET archivado = 1 WHERE id = 1; UPDATE pacientes SET archivado = 0 WHERE id = 1;");
    expect(bitacora(sqlite).map((f) => f.accion)).toEqual(["alta", "archivar", "reactivar"]);
  });

  it("no permite repetir el número de sesión de un paciente", () => {
    const sqlite = alta();
    sqlite.exec("INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-01')");
    expect(() =>
      sqlite.exec("INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-08')")
    ).toThrow(/UNIQUE/);
  });
});

describe("datos de demostración y actualización desde la versión anterior", () => {
  it("scripts/datos-demo.sql se aplica sin duplicar la bitácora", () => {
    const { sqlite } = crearBaseEnMemoria();
    sqlite.exec(readFileSync(join(process.cwd(), "scripts", "datos-demo.sql"), "utf8"));
    const altas = sqlite
      .prepare("SELECT COUNT(*) n FROM bitacora WHERE tabla = 'pacientes' AND accion = 'alta'")
      .get();
    const pacientes = sqlite.prepare("SELECT COUNT(*) n FROM pacientes").get();
    expect(pacientes).toMatchObject({ n: 3 });
    expect(altas).toMatchObject({ n: 3 });
  });

  it("la migración 7 conserva los datos de una base de la versión 6", () => {
    const sqlite = new DatabaseSync(":memory:");
    const aplicar = (archivo: string) =>
      sqlite.exec(readFileSync(join(CARPETA_MIGRACIONES, archivo), "utf8"));
    archivosDeMigracion().slice(0, 6).forEach(aplicar);
    sqlite.exec(`
      INSERT INTO pacientes (folio, nombre, fecha_ingreso) VALUES ('EXP-2026-001', 'Ana Demo', '2026-01-01');
      INSERT INTO sesiones (paciente_id, numero, fecha) VALUES (1, 1, '2026-02-01');
      INSERT INTO bitacora (tabla, registro_id, accion, detalle) VALUES ('pacientes', 1, 'alta', 'anterior');
    `);

    aplicar("007_bitacora_automatica.sql");

    expect(sqlite.prepare("SELECT COUNT(*) n FROM pacientes").get()).toMatchObject({ n: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) n FROM sesiones").get()).toMatchObject({ n: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) n FROM bitacora").get()).toMatchObject({ n: 1 });
    // y los triggers ya funcionan sobre lo que había
    sqlite.exec("UPDATE pacientes SET eliminado_en = '2026-03-01 10:00:00' WHERE id = 1");
    expect(sqlite.prepare("SELECT eliminado_en e FROM sesiones").get()).toMatchObject({
      e: "2026-03-01 10:00:00",
    });
  });
});
