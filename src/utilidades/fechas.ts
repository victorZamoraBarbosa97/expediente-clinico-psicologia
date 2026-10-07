const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const dos = (n: number) => String(n).padStart(2, "0");

/** Fecha local de hoy, tipo "2026-07-24". Usa la hora local, no UTC: en México,
 * pasadas las 18:00, `toISOString()` ya daría el día siguiente. */
export function hoy(referencia: Date = new Date()): string {
  return `${referencia.getFullYear()}-${dos(referencia.getMonth() + 1)}-${dos(referencia.getDate())}`;
}

/** Fecha y hora local, tipo "2026-07-24 14:05:00". Mismo formato que
 * `datetime('now','localtime')` de SQLite, para que no se mezclen husos. */
export function ahora(referencia: Date = new Date()): string {
  const hora = `${dos(referencia.getHours())}:${dos(referencia.getMinutes())}:${dos(referencia.getSeconds())}`;
  return `${hoy(referencia)} ${hora}`;
}

/** Hora local redondeada hacia abajo, tipo "14:00", para precargar el campo Hora. */
export function horaEnPunto(referencia: Date = new Date()): string {
  return `${dos(referencia.getHours())}:00`;
}

/** "2026-07-24" -> "24 jul 2026". Sin new Date() para no pelear con zonas horarias. */
export function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return iso;
  return `${Number(d)} ${MESES[Number(m) - 1] ?? m} ${a}`;
}

/** "2026-07-24 14:05:00" -> "24 jul 2026, 14:05". Para timestamps con hora (bitácora). */
export function fechaHoraLarga(valor: string | null): string {
  if (!valor) return "—";
  const [fecha, hora] = valor.split(/[ T]/);
  const larga = fechaLarga(fecha ?? null);
  return hora ? `${larga}, ${hora.slice(0, 5)}` : larga;
}

/** "2000-03-15" -> "26 años". */
export function edad(nacimiento: string | null, referencia: Date = new Date()): string {
  if (!nacimiento) return "—";
  const n = new Date(nacimiento + "T00:00:00");
  if (Number.isNaN(n.getTime())) return "—";
  let años = referencia.getFullYear() - n.getFullYear();
  const m = referencia.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && referencia.getDate() < n.getDate())) años--;
  return `${años} años`;
}
