const PREFIJO = "EXP";

/** "EXP-2026-014" -> 14. Devuelve 0 si el folio no es de ese año o no termina en número
 * (por ejemplo, un folio escrito a mano). */
export function consecutivoDe(folio: string, anio: number): number {
  const m = new RegExp(`^${PREFIJO}-${anio}-(\\d+)$`).exec(folio);
  return m?.[1] ? Number(m[1]) : 0;
}

/**
 * Siguiente folio del año: el mayor consecutivo existente más uno. Antes se contaban
 * los folios (`COUNT(*) + 1`), que chocaba con la restricción UNIQUE si había un
 * folio manual o un hueco en la numeración.
 */
export function siguienteFolio(existentes: string[], anio: number): string {
  const mayor = existentes.reduce((max, f) => Math.max(max, consecutivoDe(f, anio)), 0);
  return `${PREFIJO}-${anio}-${String(mayor + 1).padStart(3, "0")}`;
}
