import { describe, expect, it } from "vitest";
import type { PacienteEnLista } from "../tipos";
import { filtrarPacientes, normalizar } from "./busqueda";

const paciente = (nombre: string, folio: string, telefono: string | null = null) =>
  ({ nombre, folio, telefono }) as PacienteEnLista;

const lista = [
  paciente("José Pérez", "EXP-2026-001", "555 010 0001"),
  paciente("María Núñez", "EXP-2026-002"),
  paciente("100% Real_Nombre", "EXP-2026-003"),
];

describe("normalizar", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizar("  JOSÉ Núñez ")).toBe("jose nunez");
  });
});

describe("filtrarPacientes", () => {
  it("sin texto devuelve todos", () => {
    expect(filtrarPacientes(lista, "   ")).toHaveLength(3);
  });

  it("encuentra con o sin acentos, en cualquier mayúscula", () => {
    expect(filtrarPacientes(lista, "jose")).toHaveLength(1);
    expect(filtrarPacientes(lista, "MARIA nunez")).toHaveLength(1);
    expect(filtrarPacientes(lista, "José")).toHaveLength(1);
  });

  it("busca por folio y por teléfono", () => {
    expect(filtrarPacientes(lista, "2026-002")).toHaveLength(1);
    expect(filtrarPacientes(lista, "010 0001")).toHaveLength(1);
  });

  it("% y _ se toman como texto, no como comodines", () => {
    expect(filtrarPacientes(lista, "%")).toHaveLength(1);
    expect(filtrarPacientes(lista, "_")).toHaveLength(1);
    expect(filtrarPacientes(lista, "j_se")).toHaveLength(0);
  });
});
