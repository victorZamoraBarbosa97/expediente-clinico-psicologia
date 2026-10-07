import type { PacienteEnLista } from "../tipos";

/** Minúsculas y sin acentos: "José" y "jose" son lo mismo al buscar. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra por nombre, folio o teléfono. Se hace aquí y no con `LIKE` en SQL porque
 * SQLite no ignora acentos ("Jose" no encontraba "José") y porque `%` y `_` del
 * texto escrito se tomaban como comodines. La lista de un consultorio individual
 * cabe de sobra en memoria.
 */
export function filtrarPacientes(
  pacientes: PacienteEnLista[],
  busqueda: string
): PacienteEnLista[] {
  const buscado = normalizar(busqueda);
  if (!buscado) return pacientes;
  return pacientes.filter((p) =>
    [p.nombre, p.folio, p.telefono ?? ""].some((campo) => normalizar(campo).includes(buscado))
  );
}
