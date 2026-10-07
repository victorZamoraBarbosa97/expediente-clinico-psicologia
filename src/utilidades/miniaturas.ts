/** Extensiones de las que Rust sabe sacar miniatura (SVG queda fuera a propósito). */
const CON_MINIATURA = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

export function tieneMiniatura(tipo: string | null): boolean {
  return CON_MINIATURA.includes((tipo ?? "").toLowerCase());
}

// Las miniaturas se piden una sola vez por sesión: abrir y cerrar expedientes no vuelve a
// decodificar las mismas fotos. Se guarda la promesa para que dos pedidos simultáneos
// compartan el mismo trabajo.
const cache = new Map<string, Promise<string>>();

export function obtenerMiniatura(clave: string, cargar: () => Promise<string>): Promise<string> {
  let pendiente = cache.get(clave);
  if (!pendiente) {
    pendiente = cargar();
    cache.set(clave, pendiente);
    // Un fallo no se recuerda: si el archivo cambia o vuelve a intentarse, se pide de nuevo.
    pendiente.catch(() => cache.delete(clave));
  }
  return pendiente;
}
