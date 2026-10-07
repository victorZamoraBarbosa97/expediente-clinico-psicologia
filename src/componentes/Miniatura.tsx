import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { miniaturaDocumento } from "../db";
import { obtenerMiniatura, tieneMiniatura } from "../utilidades/miniaturas";

/**
 * Vista previa de una imagen adjunta. Mientras carga, o si no se puede generar (no es una
 * imagen, es muy pesada, el archivo ya no está), muestra `alternativa`: el ícono de siempre.
 */
export default function Miniatura({
  pacienteId,
  ruta,
  tipo,
  alternativa,
}: {
  pacienteId: number;
  ruta: string;
  tipo: string | null;
  alternativa: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tieneMiniatura(tipo)) return;
    let vigente = true;
    obtenerMiniatura(`${pacienteId}/${ruta}`, () => miniaturaDocumento(pacienteId, ruta))
      .then((u) => vigente && setUrl(u))
      .catch(() => undefined); // sin miniatura se queda el ícono
    return () => {
      vigente = false;
    };
  }, [pacienteId, ruta, tipo]);

  return url ? <img className="documento-miniatura" src={url} alt="" /> : <>{alternativa}</>;
}
