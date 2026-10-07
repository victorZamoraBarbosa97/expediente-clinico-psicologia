export type Avisar = (texto: string, error?: boolean) => void;

/** Texto legible de un error. Los comandos de Tauri rechazan con un string, no con un Error. */
export function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Ejecuta una acción y, si falla, se lo dice a la usuaria en vez de dejarla creer que
 * funcionó. Devuelve el resultado, o undefined si falló.
 */
export async function intentar<T>(
  avisar: Avisar,
  mensajeError: string,
  accion: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await accion();
  } catch (e) {
    avisar(`${mensajeError} ${mensajeDe(e)}`, true);
    return undefined;
  }
}
