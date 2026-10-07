import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pila de modales abiertos: con uno encima de otro (por ejemplo, una confirmación
// sobre el formulario) Esc solo cierra el de arriba.
const pila: symbol[] = [];

type Props = {
  titulo: ReactNode;
  onCerrar: () => void;
  /** Si es false, un clic en el fondo no cierra (formularios donde se perdería lo escrito). */
  cerrarConFondo?: boolean;
  tamano?: "normal" | "angosto" | "medio";
  children: ReactNode;
};

/**
 * Ventana modal accesible: `role="dialog"`, el foco entra al abrir, se queda dentro
 * mientras está abierta (Tab no se escapa al fondo), Esc cierra, y al cerrar el foco
 * vuelve a donde estaba.
 */
export default function Modal({
  titulo,
  onCerrar,
  cerrarConFondo = true,
  tamano = "normal",
  children,
}: Props) {
  const idTitulo = useId();
  const caja = useRef<HTMLDivElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    const yo = Symbol("modal");
    pila.push(yo);
    const anterior = document.activeElement as HTMLElement | null;

    // Si algun hijo ya pidio el foco (autoFocus) se respeta; si no, va al primer control.
    if (!caja.current?.contains(document.activeElement)) {
      caja.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus();
    }

    const alTeclear = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== yo) return;
      if (e.key === "Escape") {
        e.preventDefault();
        alCerrar.current();
        return;
      }
      if (e.key !== "Tab" || !caja.current) return;
      const dentro = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
      const primero = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);

    return () => {
      document.removeEventListener("keydown", alTeclear);
      pila.splice(pila.indexOf(yo), 1);
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  return (
    <div
      className="fondo-modal"
      onMouseDown={(e) => {
        if (cerrarConFondo && e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        className={"modal" + (tamano === "normal" ? "" : " " + tamano)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
      >
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
