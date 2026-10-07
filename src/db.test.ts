import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearBaseEnMemoria } from "./pruebas/baseEnMemoria";

// `db.ts` habla con SQLite real (en memoria, con las migraciones reales); solo la
// capa de Tauri se sustituye.
const falso = vi.hoisted(() => ({ fachada: null as unknown }));
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: async () => falso.fachada },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

type Db = typeof import("./db");
let db: Db;
let sqlite: ReturnType<typeof crearBaseEnMemoria>["sqlite"];

beforeEach(async () => {
  const base = crearBaseEnMemoria();
  sqlite = base.sqlite;
  falso.fachada = base.fachada;
  vi.resetModules(); // db.ts guarda la conexión en una variable de módulo
  db = await import("./db");
});

const pacienteDemo = (nombre = "Ana Demo") => db.crearPaciente({ nombre });
const bitacora = () =>
  sqlite.prepare("SELECT tabla, accion, detalle FROM bitacora ORDER BY id").all();

describe("pacientes", () => {
  it("crea un paciente con folio automático y fecha de ingreso", async () => {
    const id = await pacienteDemo();
    const p = await db.obtenerPaciente(id);
    expect(p?.nombre).toBe("Ana Demo");
    expect(p?.folio).toMatch(/^EXP-\d{4}-001$/);
    expect(p?.fecha_ingreso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("guarda los demás campos y deja en NULL los vacíos", async () => {
    const id = await db.crearPaciente({ nombre: "  Luis Demo ", telefono: "555", email: "" });
    const p = await db.obtenerPaciente(id);
    expect(p).toMatchObject({ nombre: "Luis Demo", telefono: "555", email: null });
  });

  it("los folios consecutivos no chocan aunque haya uno manual o uno eliminado", async () => {
    const anio = new Date().getFullYear();
    await db.crearPaciente({ nombre: "A", folio: `EXP-${anio}-010` });
    const b = await pacienteDemo("B");
    expect((await db.obtenerPaciente(b))?.folio).toBe(`EXP-${anio}-011`);
    await db.eliminarPaciente(b);
    const c = await pacienteDemo("C");
    expect((await db.obtenerPaciente(c))?.folio).toBe(`EXP-${anio}-012`);
  });

  it("el listado cuenta solo sesiones activas y oculta cerrados salvo que se pidan", async () => {
    const id = await pacienteDemo();
    await db.crearSesion(id);
    const segunda = await db.crearSesion(id);
    await db.eliminarSesion(segunda);
    const [fila] = await db.listarPacientes();
    expect(fila?.total_sesiones).toBe(1);

    await db.archivarPaciente(id, true);
    expect(await db.listarPacientes()).toHaveLength(0);
    expect(await db.listarPacientes(true)).toHaveLength(1);
  });

  it("eliminar y restaurar usan el borrado suave en cascada", async () => {
    const id = await pacienteDemo();
    await db.crearSesion(id);
    await db.eliminarPaciente(id);
    expect(await db.obtenerPaciente(id)).toBeNull();
    expect(await db.listarSesiones(id)).toHaveLength(0);
    expect(await db.papelera()).toHaveLength(1);

    await db.restaurarPaciente(id);
    expect(await db.obtenerPaciente(id)).not.toBeNull();
    expect(await db.listarSesiones(id)).toHaveLength(1);
    expect(sqlite.prepare("SELECT COUNT(*) n FROM pacientes").get()).toMatchObject({ n: 1 });
  });
});

describe("lista blanca y campos obligatorios", () => {
  it("rechaza un campo de paciente que no está en la lista", async () => {
    const id = await pacienteDemo();
    // @ts-expect-error: justo lo que la lista blanca debe frenar
    await expect(db.guardarCampoPaciente(id, "id = 1; --", "x")).rejects.toThrow(/no permitido/);
  });

  it("rechaza un campo de sesión que no está en la lista", async () => {
    const id = await pacienteDemo();
    const sesion = await db.crearSesion(id);
    // @ts-expect-error: justo lo que la lista blanca debe frenar
    await expect(db.guardarCampoSesion(sesion, "paciente_id", "9")).rejects.toThrow(/no permitido/);
  });

  it("no deja vaciar un campo obligatorio", async () => {
    const id = await pacienteDemo();
    const sesion = await db.crearSesion(id);
    await expect(db.guardarCampoPaciente(id, "nombre", "")).rejects.toThrow(/no puede quedar vacío/);
    await expect(db.guardarCampoSesion(sesion, "fecha", "")).rejects.toThrow(/no puede quedar vacío/);
    await expect(db.guardarCampoSesion(sesion, "modalidad", "")).rejects.toThrow(/no puede quedar vacío/);
    expect((await db.obtenerPaciente(id))?.nombre).toBe("Ana Demo");
  });

  it("sí deja vaciar un campo opcional (queda NULL)", async () => {
    const id = await db.crearPaciente({ nombre: "Ana Demo", telefono: "555" });
    await db.guardarCampoPaciente(id, "telefono", "");
    expect((await db.obtenerPaciente(id))?.telefono).toBeNull();
  });
});

describe("sesiones", () => {
  it("numera con el máximo más uno, incluidas las eliminadas", async () => {
    const id = await pacienteDemo();
    const s1 = await db.crearSesion(id);
    const s2 = await db.crearSesion(id);
    await db.eliminarSesion(s2);
    const s3 = await db.crearSesion(id);
    const numeros = (await db.listarSesiones(id)).map((s) => s.numero).sort();
    expect(numeros).toEqual([1, 3]);
    await db.restaurarSesion(s2);
    expect((await db.listarSesiones(id)).map((s) => s.numero).sort()).toEqual([1, 2, 3]);
    expect([s1, s2, s3]).toHaveLength(3);
  });

  it("la fecha de una sesión nueva es la local", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24, 20, 30)); // 20:30 hora local
    const id = await pacienteDemo();
    await db.crearSesion(id);
    vi.useRealTimers();
    const [s] = await db.listarSesiones(id);
    expect(s?.fecha).toBe("2026-07-24");
    expect(s?.hora).toBe("20:00");
  });
});

describe("bitácora", () => {
  it("las ediciones solo se anotan cuando se pide", async () => {
    const id = await pacienteDemo();
    await db.guardarCampoPaciente(id, "email", "a@b.c", false);
    expect(bitacora().filter((f) => f.accion === "editar")).toHaveLength(0);

    await db.guardarCampoPaciente(id, "email", "a@b.c", true);
    expect(bitacora().filter((f) => f.accion === "editar")).toEqual([
      expect.objectContaining({ detalle: expect.stringContaining("campo: Correo") }),
    ]);
  });

  it("alta, cierre y eliminación quedan anotados sin que la app lo pida", async () => {
    const id = await pacienteDemo();
    await db.archivarPaciente(id, true);
    await db.eliminarPaciente(id);
    expect(bitacora().map((f) => f.accion)).toEqual(["alta", "archivar", "eliminar"]);
  });
});

describe("documentos", () => {
  it("alta, eliminación y restauración", async () => {
    const id = await pacienteDemo();
    const doc = await db.crearDocumento(id, "estudio.pdf", "pdf", "estudio.pdf", 1024);
    expect(await db.listarDocumentos(id)).toHaveLength(1);
    await db.eliminarDocumento(doc);
    expect(await db.listarDocumentos(id)).toHaveLength(0);
    expect(await db.papeleraDocumentos(id)).toHaveLength(1);
    await db.restaurarDocumento(doc);
    expect(await db.listarDocumentos(id)).toHaveLength(1);
  });
});
