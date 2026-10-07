// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const miniaturaDocumento = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ miniaturaDocumento }));

import Miniatura from "./Miniatura";

const icono = <span data-testid="icono">icono</span>;

beforeEach(() => {
  miniaturaDocumento.mockReset();
});
afterEach(cleanup);

describe("Miniatura", () => {
  it("muestra la miniatura de una imagen cuando está lista", async () => {
    miniaturaDocumento.mockResolvedValue("data:image/jpeg;base64,AAAA");
    const { container } = render(
      <Miniatura pacienteId={1} ruta="foto-ok.jpg" tipo="jpg" alternativa={icono} />
    );
    expect(screen.getByTestId("icono")).toBeTruthy(); // mientras carga, el ícono
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,AAAA");
    expect(screen.queryByTestId("icono")).toBeNull();
  });

  it("no pide miniatura de un PDF y deja el ícono", () => {
    render(<Miniatura pacienteId={1} ruta="estudio.pdf" tipo="pdf" alternativa={icono} />);
    expect(miniaturaDocumento).not.toHaveBeenCalled();
    expect(screen.getByTestId("icono")).toBeTruthy();
  });

  it("si falla, se queda con el ícono", async () => {
    miniaturaDocumento.mockRejectedValue("demasiado grande");
    render(<Miniatura pacienteId={1} ruta="enorme.png" tipo="png" alternativa={icono} />);
    await waitFor(() => expect(miniaturaDocumento).toHaveBeenCalled());
    expect(screen.getByTestId("icono")).toBeTruthy();
  });

  it("no vuelve a pedir la misma miniatura al volver a mostrarla", async () => {
    miniaturaDocumento.mockResolvedValue("data:image/jpeg;base64,BBBB");
    const props = { pacienteId: 2, ruta: "repetida.png", tipo: "png", alternativa: icono };
    const primera = render(<Miniatura {...props} />);
    await waitFor(() => expect(primera.container.querySelector("img")).not.toBeNull());
    primera.unmount();

    const segunda = render(<Miniatura {...props} />);
    await waitFor(() => expect(segunda.container.querySelector("img")).not.toBeNull());
    expect(miniaturaDocumento).toHaveBeenCalledTimes(1);
  });
});
