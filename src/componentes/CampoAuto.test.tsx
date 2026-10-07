// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vaciarPendientes } from "../utilidades/autoguardado";
import { CampoAuto } from "./ui";

/** Promesa que el test resuelve cuando quiere: simula un guardado lento. */
function pendiente() {
  let resolver!: () => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

/** Hace lo mismo que FichaPaciente: tras guardar, devuelve el valor guardado como `valorInicial`. */
function Padre({
  guardar,
  obligatorio,
}: {
  guardar: (v: string, registrarBitacora: boolean) => Promise<void>;
  obligatorio?: boolean;
}) {
  const [valor, setValor] = useState<string | null>("");
  return (
    <CampoAuto
      etiqueta="Notas"
      area
      valorInicial={valor}
      obligatorio={obligatorio}
      guardar={async (v, registrarBitacora) => {
        await guardar(v, registrarBitacora);
        setValor(v);
      }}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const usuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const caja = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Notas" });

describe("CampoAuto", () => {
  it("B1: lo que se escribe durante un guardado en vuelo no se pierde", async () => {
    const guardados: string[] = [];
    const lentos = [pendiente(), pendiente()];
    const guardar = vi.fn((v: string, _registrarBitacora: boolean) => {
      guardados.push(v);
      return lentos[guardados.length - 1]!.promesa;
    });
    const u = usuario();
    render(<Padre guardar={guardar} />);

    await u.type(caja(), "Hola");
    await vi.advanceTimersByTimeAsync(800); // se dispara el primer guardado...
    expect(guardados).toEqual(["Hola"]); // ...que queda en vuelo

    await u.type(caja(), " mundo"); // ella sigue escribiendo mientras tanto
    lentos[0]!.resolver(); // llega la respuesta del primer guardado
    await vi.advanceTimersByTimeAsync(0);

    // Antes del arreglo, el eco "Hola" pisaba el texto y se perdía " mundo".
    expect(caja().value).toBe("Hola mundo");

    await vi.advanceTimersByTimeAsync(800);
    expect(guardados).toEqual(["Hola", "Hola mundo"]);
    lentos[1]!.resolver();
    await vi.advanceTimersByTimeAsync(0);
    expect(caja().value).toBe("Hola mundo");
    expect(screen.getByRole("status").textContent).toBe("✓ Guardado");
  });

  it("los guardados de un campo van en orden: uno nuevo espera al anterior", async () => {
    const lentos = [pendiente(), pendiente()];
    let n = 0;
    const guardar = vi.fn(() => lentos[n++]!.promesa);
    const u = usuario();
    render(<Padre guardar={guardar} />);

    await u.type(caja(), "a");
    await vi.advanceTimersByTimeAsync(800);
    await u.type(caja(), "b");
    await vi.advanceTimersByTimeAsync(800);

    expect(guardar).toHaveBeenCalledTimes(1); // el segundo no arranca hasta que termine el primero
    lentos[0]!.resolver();
    await vi.advanceTimersByTimeAsync(0);
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenLastCalledWith("ab", false);
    lentos[1]!.resolver();
  });

  it("vaciarPendientes guarda de inmediato lo que está a medias (cierre de la app)", async () => {
    const guardar = vi.fn(() => Promise.resolve());
    const u = usuario();
    render(<Padre guardar={guardar} />);

    await u.type(caja(), "nota importante"); // aún no pasan los 800 ms
    expect(guardar).not.toHaveBeenCalled();

    expect(await vaciarPendientes()).toBe(true);
    expect(guardar).toHaveBeenCalledWith("nota importante", true);
  });

  it("vaciarPendientes avisa si el guardado falló", async () => {
    const guardar = vi.fn(() => Promise.reject(new Error("disco lleno")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const u = usuario();
    render(<Padre guardar={guardar} />);

    await u.type(caja(), "algo");
    expect(await vaciarPendientes()).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("No se pudo guardar");
  });

  it("B7/B8: un campo obligatorio vacío no se guarda y lo dice", async () => {
    const guardar = vi.fn(() => Promise.resolve());
    const u = usuario();
    render(<Padre guardar={guardar} obligatorio />);

    await u.type(caja(), "50");
    await vi.advanceTimersByTimeAsync(800);
    expect(guardar).toHaveBeenCalledTimes(1);

    await u.clear(caja());
    await vi.advanceTimersByTimeAsync(2000);
    expect(guardar).toHaveBeenCalledTimes(1); // no se mandó el vacío
    expect(screen.getByRole("alert").textContent).toContain("no puede quedar vacío");
  });

  it("A2: el campo sin etiqueta visible tiene nombre accesible", () => {
    render(
      <CampoAuto
        etiqueta=""
        nombreAccesible="Motivo de consulta"
        valorInicial=""
        guardar={() => Promise.resolve()}
        area
      />
    );
    expect(screen.getByRole("textbox", { name: "Motivo de consulta" })).toBeTruthy();
  });
});
