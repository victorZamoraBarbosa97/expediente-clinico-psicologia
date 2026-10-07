import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { cancelarCierre, cerrarApp, respaldarAhora } from "../db";
import { vaciarPendientes } from "../utilidades/autoguardado";
import { mensajeDe } from "../utilidades/intentar";

/**
 * Cierre de la ventana sin perder la última nota.
 *
 * Rust no cierra de inmediato: avisa con el evento "solicitud-cierre" (ver lib.rs) y
 * espera. Aquí se hace, en este orden: (1) guardar lo que los campos tengan a medias,
 * (2) respaldar, (3) pedir a Rust que salga. Si algo falla, la ventana NO se cierra
 * sola: se le dice a la usuaria y ella decide si seguir trabajando o cerrar igual.
 */
export function useCierreSeguro() {
  const [problema, setProblema] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let quitar: (() => void) | undefined;

    void listen("solicitud-cierre", async () => {
      try {
        const todoGuardado = await vaciarPendientes();
        if (!todoGuardado) {
          throw new Error("Hay cambios que no se pudieron guardar.");
        }
        await respaldarAhora();
        await cerrarApp();
      } catch (e) {
        await cancelarCierre();
        setProblema(mensajeDe(e));
      }
    }).then((fn) => {
      if (cancelado) fn();
      else quitar = fn;
    });

    return () => {
      cancelado = true;
      quitar?.();
    };
  }, []);

  const seguirTrabajando = useCallback(() => setProblema(null), []);

  return { problema, seguirTrabajando, cerrarDeTodosModos: cerrarApp };
}
