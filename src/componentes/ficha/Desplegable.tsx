import { ChevronDown, ChevronRight } from "lucide-react";

/** Botón de acordeón ("Ver detalles" / "Ocultar detalles"). No sale al imprimir. */
export default function Desplegable({
  abierto,
  onAlternar,
  textoAbierto,
  textoCerrado,
}: {
  abierto: boolean;
  onAlternar: () => void;
  textoAbierto: string;
  textoCerrado: string;
}) {
  return (
    <button
      type="button"
      className="enlace-detalles no-imprimir"
      onClick={onAlternar}
      aria-expanded={abierto}
    >
      {abierto ? (
        <ChevronDown size={18} aria-hidden="true" />
      ) : (
        <ChevronRight size={18} aria-hidden="true" />
      )}
      {abierto ? textoAbierto : textoCerrado}
    </button>
  );
}
