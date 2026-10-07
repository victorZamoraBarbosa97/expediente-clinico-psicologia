import { useEffect, useState } from "react";
import { ScrollText, X } from "lucide-react";
import { listarBitacora } from "../db";
import type { Bitacora as BitacoraFila } from "../tipos";
import { fechaHoraLarga } from "../utilidades/fechas";
import { mensajeDe } from "../utilidades/intentar";
import Modal from "./Modal";

const TABLAS: Record<string, string> = {
  pacientes: "Paciente",
  sesiones: "Sesión",
  documentos: "Documento",
};

const ACCIONES: Record<string, string> = {
  alta: "Alta",
  editar: "Edición",
  eliminar: "Eliminación",
  restaurar: "Restauración",
  archivar: "Cierre de expediente",
  reactivar: "Reapertura de expediente",
};

/**
 * Ventana oculta de solo lectura para el rastro de altas, bajas, restauraciones y
 * ediciones (lo pide la NOM-004-SSA3-2012). Se abre con Ctrl+Shift+B, ver App.tsx.
 * No hay botón visible a propósito: no es algo que la usuaria necesite en el uso
 * diario, pero tiene que poder consultarse si hace falta. La base de datos además
 * impide editar o borrar sus filas (triggers de la migración 007).
 */
export default function Bitacora({ onCerrar }: { onCerrar: () => void }) {
  const [filas, setFilas] = useState<BitacoraFila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    listarBitacora()
      .then((f) => vigente && setFilas(f))
      .catch((e) => vigente && setError("No se pudo leer la bitácora. " + mensajeDe(e)));
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <Modal
      titulo={
        <span className="titulo-con-icono">
          <ScrollText size={26} aria-hidden="true" />
          Bitácora
        </span>
      }
      onCerrar={onCerrar}
      tamano="medio"
    >
      <p className="modal-intro">
        Rastro de altas, bajas, restauraciones y ediciones de expedientes, sesiones y
        archivos. Es de solo lectura y se abre con Ctrl+Shift+B.
      </p>

      {error ? (
        <p className="error-formulario" role="alert">
          {error}
        </p>
      ) : filas === null ? (
        <p className="texto-suave">Leyendo la bitácora…</p>
      ) : filas.length === 0 ? (
        <p className="texto-suave">Todavía no hay movimientos registrados.</p>
      ) : (
        <ul className="lista-bitacora">
          {filas.map((f) => (
            <li key={f.id}>
              <span>
                <strong>{ACCIONES[f.accion] ?? f.accion}</strong>
                {" · "}
                {TABLAS[f.tabla] ?? f.tabla}
                {f.detalle ? ` — ${f.detalle}` : ""}
              </span>
              <span className="bitacora-momento">{fechaHoraLarga(f.momento)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pie-modal">
        <button className="btn" onClick={onCerrar}>
          <X size={20} aria-hidden="true" />
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
