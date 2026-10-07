import { useCallback, useEffect, useRef, useState } from "react";

/** Mensaje temporal en pantalla. Un aviso nuevo cancela el temporizador del anterior,
 * para que el viejo no borre el nuevo antes de tiempo. */
export function useAviso() {
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const reloj = useRef<number | undefined>(undefined);

  const mostrar = useCallback((texto: string, error = false) => {
    window.clearTimeout(reloj.current);
    setMensaje({ texto, error });
    reloj.current = window.setTimeout(() => setMensaje(null), error ? 7000 : 3500);
  }, []);

  useEffect(() => () => window.clearTimeout(reloj.current), []);

  return { mensaje, mostrar };
}
