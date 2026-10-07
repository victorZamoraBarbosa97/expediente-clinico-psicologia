import { FolderOpen, Mic, Save, Trash2, UserPlus } from "lucide-react";
import type { PacienteEnLista } from "../tipos";
import logo from "../assets/logo.svg";
import ListaPacientes from "./ListaPacientes";

/** Panel izquierdo: marca, búsqueda, lista de pacientes y acciones generales. */
export default function PanelLateral({
  pacientes,
  cargando,
  seleccionado,
  busqueda,
  verArchivados,
  onBusqueda,
  onVerArchivados,
  onSeleccionar,
  onNuevo,
  onRespaldar,
  onVerRespaldos,
  onPapelera,
  onVoz,
}: {
  pacientes: PacienteEnLista[];
  cargando: boolean;
  seleccionado: number | null;
  busqueda: string;
  verArchivados: boolean;
  onBusqueda: (texto: string) => void;
  onVerArchivados: (ver: boolean) => void;
  onSeleccionar: (id: number) => void;
  onNuevo: () => void;
  onRespaldar: () => void;
  onVerRespaldos: () => void;
  onPapelera: () => void;
  onVoz: () => void;
}) {
  return (
    <aside className="panel-izq">
      <div className="marca">
        <img src={logo} alt="" className="marca-logo" />
        <h1>Consultorio</h1>
        <p>Expedientes de pacientes</p>
      </div>

      <div className="buscador">
        <label className="campo campo-busqueda">
          <span>Buscar paciente</span>
          <input
            className="busca-input"
            type="search"
            value={busqueda}
            placeholder="Nombre o teléfono"
            onChange={(e) => onBusqueda(e.target.value)}
          />
        </label>
        <label className="casilla casilla-chica">
          <input
            type="checkbox"
            checked={verArchivados}
            onChange={(e) => onVerArchivados(e.target.checked)}
          />
          Mostrar también los expedientes cerrados
        </label>
      </div>

      <ListaPacientes
        pacientes={pacientes}
        cargando={cargando}
        seleccionado={seleccionado}
        onSeleccionar={onSeleccionar}
      />

      <div className="pie-izq">
        <button className="btn ancho" onClick={onNuevo}>
          <UserPlus size={20} aria-hidden="true" />
          Nuevo paciente
        </button>
        <button className="btn secundario ancho" onClick={onRespaldar}>
          <Save size={20} aria-hidden="true" />
          Respaldar ahora
        </button>
        <div className="fila-botones">
          <button className="btn secundario mini" onClick={onVerRespaldos}>
            <FolderOpen size={16} aria-hidden="true" />
            Ver respaldos
          </button>
          <button className="btn secundario mini" onClick={onPapelera}>
            <Trash2 size={16} aria-hidden="true" />
            Papelera
          </button>
          <button
            className="btn secundario mini"
            onClick={onVoz}
            title="Enciende o apaga el Acceso por voz de Windows"
          >
            <Mic size={16} aria-hidden="true" />
            Acceso por voz
          </button>
        </div>
        <p className="nota-atajo">Bitácora: Ctrl+Shift+B</p>
      </div>
    </aside>
  );
}
