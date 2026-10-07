import type { PacienteEnLista } from "../tipos";
import { fechaLarga } from "../utilidades/fechas";

export default function ListaPacientes({
  pacientes,
  cargando,
  seleccionado,
  onSeleccionar,
}: {
  pacientes: PacienteEnLista[];
  cargando: boolean;
  seleccionado: number | null;
  onSeleccionar: (id: number) => void;
}) {
  if (cargando) {
    return (
      <div className="lista">
        <p className="lista-mensaje">Abriendo expedientes…</p>
      </div>
    );
  }

  if (pacientes.length === 0) {
    return (
      <div className="lista">
        <p className="lista-mensaje">
          No hay pacientes que coincidan. Prueba con menos letras, o crea un expediente nuevo.
        </p>
      </div>
    );
  }

  return (
    <ul className="lista sin-vinetas">
      {pacientes.map((p) => (
        <li key={p.id}>
          <button
            className="fila-paciente"
            aria-current={seleccionado === p.id}
            onClick={() => onSeleccionar(p.id)}
          >
            <strong>
              {p.nombre}
              {p.archivado === 1 && <span className="etiqueta etiqueta-cerrado">cerrado</span>}
            </strong>
            <span>
              {p.total_sesiones === 0
                ? "sin sesiones"
                : `${p.total_sesiones} ${p.total_sesiones === 1 ? "sesión" : "sesiones"} · última ${fechaLarga(p.ultima_sesion)}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
