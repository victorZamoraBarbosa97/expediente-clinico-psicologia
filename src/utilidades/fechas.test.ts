import { describe, expect, it } from "vitest";
import { ahora, edad, fechaHoraLarga, fechaLarga, hoy, horaEnPunto } from "./fechas";

describe("fechaLarga", () => {
  it("formatea una fecha ISO", () => {
    expect(fechaLarga("2026-07-24")).toBe("24 jul 2026");
    expect(fechaLarga("2026-01-05")).toBe("5 ene 2026");
  });

  it("ignora la parte de hora si viene un timestamp", () => {
    expect(fechaLarga("2026-12-31 23:59:00")).toBe("31 dic 2026");
  });

  it("devuelve raya para valores vacíos", () => {
    expect(fechaLarga(null)).toBe("—");
    expect(fechaLarga("")).toBe("—");
  });

  it("devuelve el texto original si no es una fecha", () => {
    expect(fechaLarga("mañana")).toBe("mañana");
  });
});

describe("fechaHoraLarga", () => {
  it("agrega la hora sin segundos", () => {
    expect(fechaHoraLarga("2026-07-24 14:05:33")).toBe("24 jul 2026, 14:05");
    expect(fechaHoraLarga("2026-07-24T14:05:33")).toBe("24 jul 2026, 14:05");
  });

  it("funciona sin hora", () => {
    expect(fechaHoraLarga("2026-07-24")).toBe("24 jul 2026");
    expect(fechaHoraLarga(null)).toBe("—");
  });
});

describe("edad", () => {
  const ref = new Date(2026, 6, 24); // 24 jul 2026

  it("cuenta años cumplidos", () => {
    expect(edad("2000-03-15", ref)).toBe("26 años");
  });

  it("no suma el año si el cumpleaños aún no llega", () => {
    expect(edad("2000-07-25", ref)).toBe("25 años");
    expect(edad("2000-08-01", ref)).toBe("25 años");
  });

  it("suma el año el mismo día del cumpleaños", () => {
    expect(edad("2000-07-24", ref)).toBe("26 años");
  });

  it("devuelve raya si falta o es inválida", () => {
    expect(edad(null, ref)).toBe("—");
    expect(edad("no-es-fecha", ref)).toBe("—");
  });
});

describe("fecha y hora locales", () => {
  it("hoy() usa el día local, no el UTC", () => {
    // 20:30 hora local: en UTC-6 ya sería el día siguiente en UTC.
    expect(hoy(new Date(2026, 6, 24, 20, 30))).toBe("2026-07-24");
    expect(hoy(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("ahora() tiene el mismo formato que datetime('now','localtime') de SQLite", () => {
    expect(ahora(new Date(2026, 6, 24, 9, 5, 3))).toBe("2026-07-24 09:05:03");
  });

  it("horaEnPunto() redondea hacia abajo", () => {
    expect(horaEnPunto(new Date(2026, 6, 24, 9, 59))).toBe("09:00");
    expect(horaEnPunto(new Date(2026, 6, 24, 14, 0))).toBe("14:00");
  });
});
