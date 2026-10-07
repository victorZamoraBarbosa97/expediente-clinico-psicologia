import { useEffect } from "react";

/** Ejecuta `accion` al pulsar Ctrl+Shift+<tecla> en cualquier parte de la ventana. */
export function useAtajo(tecla: string, accion: () => void) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === tecla.toLowerCase()) {
        e.preventDefault();
        accion();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [tecla, accion]);
}
