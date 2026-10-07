import { useState } from "react";
import type { ReactNode } from "react";
import { RotateCcw, X } from "lucide-react";
import Modal from "./Modal";
import { mensajeDe } from "../utilidades/intentar";

export type ItemPapelera = {
  id: number;
  titulo: ReactNode;
  detalle?: ReactNode;
  icono?: ReactNode;
};

/**
 * Papelera genérica: lista lo eliminado y deja restaurarlo. La usan pacientes,
 * sesiones y archivos adjuntos. Si restaurar falla, el error se muestra dentro de la
 * propia ventana en vez de perderse.
 */
export default function ModalPapelera({
  titulo,
  descripcion,
  items,
  onRestaurar,
  onCerrar,
  pieExtra,
}: {
  titulo: string;
  descripcion: string;
  items: ItemPapelera[];
  onRestaurar: (id: number) => Promise<void>;
  onCerrar: () => void;
  /** Botones adicionales a la izquierda de "Cerrar". */
  pieExtra?: ReactNode;
}) {
  const [error, setError] = useState("");
  const [restaurando, setRestaurando] = useState<number | null>(null);

  const restaurar = async (id: number) => {
    setError("");
    setRestaurando(id);
    try {
      await onRestaurar(id);
    } catch (e) {
      setError("No se pudo restaurar. " + mensajeDe(e));
    } finally {
      setRestaurando(null);
    }
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <p className="sin-margen-arriba">{descripcion}</p>

      {error && (
        <p className="error-formulario" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="texto-suave">La papelera está vacía.</p>
      ) : (
        <ul className="lista-papelera">
          {items.map((item) => (
            <li key={item.id}>
              <span className="papelera-dato">
                {item.icono}
                <span>
                  <strong>{item.titulo}</strong>
                  {item.detalle && (
                    <>
                      <br />
                      <span className="papelera-detalle">{item.detalle}</span>
                    </>
                  )}
                </span>
              </span>
              <button
                className="btn secundario mini"
                disabled={restaurando !== null}
                onClick={() => void restaurar(item.id)}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pie-modal">
        {pieExtra}
        <button className="btn" onClick={onCerrar}>
          <X size={20} aria-hidden="true" />
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
