import { describe, expect, it } from "vitest";
import { consecutivoDe, siguienteFolio } from "./folio";

describe("consecutivoDe", () => {
  it("lee el consecutivo del año indicado", () => {
    expect(consecutivoDe("EXP-2026-014", 2026)).toBe(14);
  });

  it("ignora otros años y folios escritos a mano", () => {
    expect(consecutivoDe("EXP-2025-014", 2026)).toBe(0);
    expect(consecutivoDe("EXP-2026-ABC", 2026)).toBe(0);
    expect(consecutivoDe("otro", 2026)).toBe(0);
  });
});

describe("siguienteFolio", () => {
  it("empieza en 001 cuando no hay folios", () => {
    expect(siguienteFolio([], 2026)).toBe("EXP-2026-001");
  });

  it("usa el mayor consecutivo más uno, aunque haya huecos", () => {
    expect(siguienteFolio(["EXP-2026-001", "EXP-2026-007"], 2026)).toBe("EXP-2026-008");
  });

  it("reinicia cada año", () => {
    expect(siguienteFolio(["EXP-2025-120"], 2026)).toBe("EXP-2026-001");
  });
});
