/**
 * Registro de los campos con autoguardado que están en pantalla. Al cerrar la
 * aplicación, `vaciarPendientes` obliga a cada uno a guardar lo que tenga a medias
 * y espera a que termine, ANTES de hacer el respaldo (ver hooks/useCierreSeguro.ts).
 */

/** Guarda lo pendiente del campo. Devuelve false si el guardado falló. */
export type Vaciador = () => Promise<boolean>;

const vaciadores = new Set<Vaciador>();

export function registrarVaciado(vaciador: Vaciador): () => void {
  vaciadores.add(vaciador);
  return () => {
    vaciadores.delete(vaciador);
  };
}

/** Espera a que todos los campos terminen de guardar. true = todo quedó guardado. */
export async function vaciarPendientes(): Promise<boolean> {
  const resultados = await Promise.all(
    [...vaciadores].map((vaciar) => vaciar().catch(() => false))
  );
  return resultados.every(Boolean);
}
