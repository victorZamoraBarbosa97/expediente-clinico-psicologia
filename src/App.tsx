import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  abrirCarpetaRespaldos,
  alternarAccesoPorVoz,
  crearPaciente,
  listarPacientes,
  papelera as leerPapelera,
  respaldarAhora,
  restaurarPaciente,
} from "./db";
import type { Paciente, PacienteEnLista, DatosPaciente } from "./tipos";
import { Aviso, Confirmar } from "./componentes/ui";
import Bitacora from "./componentes/Bitacora";
import ModalPapelera from "./componentes/ModalPapelera";
import { useAtajo } from "./hooks/useAtajo";
import { useCierreSeguro } from "./hooks/useCierreSeguro";
import FichaPaciente from "./pantallas/FichaPaciente";
import FormPaciente from "./pantallas/FormPaciente";
import PanelLateral from "./pantallas/PanelLateral";
import { filtrarPacientes } from "./utilidades/busqueda";
import { fechaLarga } from "./utilidades/fechas";
import { intentar, mensajeDe } from "./utilidades/intentar";
import { useAviso } from "./utilidades/useAviso";

export default function App() {
  const [pacientes, setPacientes] = useState<PacienteEnLista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [eliminados, setEliminados] = useState<Paciente[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bitacoraAbierta, setBitacoraAbierta] = useState(false);
  const { mensaje, mostrar } = useAviso();
  const cierre = useCierreSeguro();

  const recargar = useCallback(async () => {
    try {
      setPacientes(await listarPacientes(verArchivados));
    } catch (e) {
      mostrar("No se pudo leer la lista de pacientes. " + mensajeDe(e), true);
    } finally {
      setCargando(false);
    }
  }, [verArchivados, mostrar]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // La búsqueda se filtra en memoria: no consulta la base en cada tecla.
  const visibles = useMemo(() => filtrarPacientes(pacientes, busqueda), [pacientes, busqueda]);

  const nuevoPaciente = async (datos: DatosPaciente) => {
    const id = await intentar(mostrar, "No se pudo crear el expediente.", () => crearPaciente(datos));
    if (id === undefined) return;
    setFormAbierto(false);
    await recargar();
    setSeleccionado(id);
    mostrar("Expediente creado");
  };

  const respaldar = async () => {
    const ruta = await intentar(mostrar, "No se pudo hacer el respaldo.", respaldarAhora);
    if (ruta) mostrar("Respaldo guardado en " + ruta);
  };

  const abrirPapelera = async () => {
    const lista = await intentar(mostrar, "No se pudo abrir la papelera.", leerPapelera);
    if (lista) setEliminados(lista);
  };

  const restaurar = async (id: number) => {
    await restaurarPaciente(id);
    setEliminados(await leerPapelera());
    await recargar();
    mostrar("Expediente restaurado");
  };

  const alternarVoz = () =>
    void intentar(mostrar, "No se pudo alternar Acceso por voz.", alternarAccesoPorVoz);

  const verRespaldos = () =>
    void intentar(mostrar, "No se pudo abrir la carpeta de respaldos.", abrirCarpetaRespaldos);

  // Ventana oculta sin botón visible a propósito: es para consulta ocasional
  // (auditoría NOM-004), no para el uso diario. Ctrl+Shift+B en cualquier parte.
  const abrirBitacora = useCallback(() => setBitacoraAbierta(true), []);
  useAtajo("b", abrirBitacora);

  return (
    <div className="app">
      <PanelLateral
        pacientes={visibles}
        cargando={cargando}
        seleccionado={seleccionado}
        busqueda={busqueda}
        verArchivados={verArchivados}
        onBusqueda={setBusqueda}
        onVerArchivados={setVerArchivados}
        onSeleccionar={setSeleccionado}
        onNuevo={() => setFormAbierto(true)}
        onRespaldar={() => void respaldar()}
        onVerRespaldos={verRespaldos}
        onPapelera={() => void abrirPapelera()}
        onVoz={alternarVoz}
      />

      <main className="panel-der">
        {seleccionado ? (
          <FichaPaciente
            key={seleccionado}
            pacienteId={seleccionado}
            onCambio={recargar}
            onCerrado={() => setSeleccionado(null)}
            avisar={mostrar}
          />
        ) : (
          <div className="vacio">
            <h2>Elige un paciente</h2>
            <p>
              Selecciona un nombre de la lista para ver su expediente y sus sesiones, o crea
              uno nuevo con el botón de abajo a la izquierda.
            </p>
          </div>
        )}
      </main>

      {formAbierto && (
        <FormPaciente onGuardar={nuevoPaciente} onCancelar={() => setFormAbierto(false)} />
      )}

      {eliminados && (
        <ModalPapelera
          titulo="Papelera"
          descripcion="Los expedientes eliminados se guardan aquí. Nada se borra de verdad."
          items={eliminados.map((p) => ({
            id: p.id,
            titulo: p.nombre,
            detalle: `${p.folio} · ingresó ${fechaLarga(p.fecha_ingreso)}`,
          }))}
          onRestaurar={restaurar}
          onCerrar={() => setEliminados(null)}
        />
      )}

      {bitacoraAbierta && <Bitacora onCerrar={() => setBitacoraAbierta(false)} />}

      {cierre.problema !== null && (
        <Confirmar
          titulo="No se pudo cerrar con seguridad"
          detalle={`${cierre.problema} Puedes seguir trabajando y volver a intentarlo, o cerrar de todos modos.`}
          textoBoton="Cerrar de todos modos"
          textoNo="Seguir trabajando"
          icono={<X size={20} aria-hidden="true" />}
          onSi={() => void cierre.cerrarDeTodosModos()}
          onNo={cierre.seguirTrabajando}
        />
      )}

      <Aviso texto={mensaje?.texto ?? null} error={mensaje?.error} />
    </div>
  );
}
