import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Check,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import {
  archivarPaciente,
  crearSesion,
  eliminarPaciente,
  eliminarSesion,
  guardarCampoPaciente,
  listarSesiones,
  obtenerPaciente,
  papeleraSesiones,
  restaurarSesion,
} from "../db";
import type { CampoPaciente } from "../campos";
import type { Paciente, Sesion } from "../tipos";
import { Confirmar } from "../componentes/ui";
import Documentos from "../componentes/Documentos";
import ModalPapelera from "../componentes/ModalPapelera";
import DatosPaciente from "../componentes/ficha/DatosPaciente";
import Desplegable from "../componentes/ficha/Desplegable";
import FilaSesion from "../componentes/ficha/FilaSesion";
import type { ModoSesion } from "../componentes/ficha/FilaSesion";
import NotasClinicas from "../componentes/ficha/NotasClinicas";
import { fechaLarga } from "../utilidades/fechas";
import { intentar, mensajeDe } from "../utilidades/intentar";
import type { Avisar } from "../utilidades/intentar";

/** Campos que se ven en la lista de la izquierda: solo ellos obligan a recargarla. */
const CAMPOS_EN_LISTA: readonly CampoPaciente[] = ["nombre", "telefono"];

export default function FichaPaciente({
  pacienteId,
  onCambio,
  onCerrado,
  avisar,
}: {
  pacienteId: number;
  onCambio: () => Promise<void> | void;
  onCerrado: () => void;
  avisar: Avisar;
}) {
  const [p, setP] = useState<Paciente | null>(null);
  const [cargado, setCargado] = useState(false);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [verDetalles, setVerDetalles] = useState(false);
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [verNotas, setVerNotas] = useState(false);
  const [verSesiones, setVerSesiones] = useState(false);
  const [porEliminar, setPorEliminar] = useState(false);
  const [sesionActiva, setSesionActiva] = useState<{ id: number; modo: Exclude<ModoSesion, null> } | null>(null);
  const [sesionesEliminadas, setSesionesEliminadas] = useState<Sesion[] | null>(null);
  const [creandoSesion, setCreandoSesion] = useState(false);
  // Guarda ademas en un ref (sincrono) porque el estado de React se actualiza
  // en el siguiente render: un doble clic muy rapido puede disparar el
  // segundo onClick antes de que el boton alcance a deshabilitarse, creando
  // dos sesiones en blanco.
  const creandoSesionRef = useRef(false);
  const sesionesRef = useRef<HTMLHeadingElement>(null);

  const cargar = useCallback(async () => {
    setP(await obtenerPaciente(pacienteId));
    setSesiones(await listarSesiones(pacienteId));
  }, [pacienteId]);

  useEffect(() => {
    cargar()
      .catch((e) => avisar("No se pudo abrir el expediente. " + mensajeDe(e), true))
      .finally(() => setCargado(true));
  }, [cargar, avisar]);

  /** Refresca la lista de la izquierda sin convertir un fallo de ahí en "no se guardó". */
  const refrescarLista = async () => {
    try {
      await onCambio();
    } catch (e) {
      console.error("No se pudo actualizar la lista de pacientes:", e);
    }
  };

  if (!p) {
    return (
      <div className="vacio">
        {cargado ? "Este expediente ya no está disponible." : "Abriendo expediente…"}
      </div>
    );
  }

  const guardar = (campo: CampoPaciente) => async (v: string, registrarBitacora: boolean) => {
    try {
      await guardarCampoPaciente(pacienteId, campo, v, registrarBitacora);
    } catch (e) {
      avisar("No se pudo guardar el cambio. " + mensajeDe(e), true);
      throw e;
    }
    setP((prev) => (prev ? { ...prev, [campo]: v } : prev));
    if (CAMPOS_EN_LISTA.includes(campo)) await refrescarLista();
  };

  const nuevaSesion = async () => {
    if (creandoSesionRef.current) return;
    creandoSesionRef.current = true;
    setCreandoSesion(true);
    try {
      const id = await intentar(avisar, "No se pudo crear la sesión.", async () => {
        const nueva = await crearSesion(pacienteId);
        await cargar();
        return nueva;
      });
      if (id === undefined) return;
      await refrescarLista();
      setSesionActiva({ id, modo: "editar" });
      setVerSesiones(true);
      // Doble rAF: espera a que React confirme el nuevo render antes de
      // medir/desplazar, si no el scroll apunta a la posicion vieja.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sesionesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    } finally {
      creandoSesionRef.current = false;
      setCreandoSesion(false);
    }
  };

  const alternarArchivado = async () => {
    const cerrar = p.archivado === 0;
    const ok = await intentar(avisar, "No se pudo cambiar el estado del expediente.", async () => {
      await archivarPaciente(pacienteId, cerrar);
      await cargar();
    });
    if (ok === undefined) return;
    await refrescarLista();
    avisar(cerrar ? "Expediente cerrado" : "Expediente reabierto");
  };

  const borrarSesion = async (id: number) => {
    const ok = await intentar(avisar, "No se pudo eliminar la sesión.", async () => {
      await eliminarSesion(id);
      await cargar();
    });
    if (ok === undefined) return;
    await refrescarLista();
    avisar("Sesión eliminada");
  };

  const eliminarExpediente = async () => {
    setPorEliminar(false);
    const ok = await intentar(avisar, "No se pudo eliminar el expediente.", async () => {
      await eliminarPaciente(pacienteId);
    });
    if (ok === undefined) return;
    await refrescarLista();
    onCerrado();
    avisar("Expediente movido a la Papelera");
  };

  const abrirPapeleraSesiones = async () => {
    const lista = await intentar(avisar, "No se pudo abrir la papelera de sesiones.", () =>
      papeleraSesiones(pacienteId)
    );
    if (lista) setSesionesEliminadas(lista);
  };

  const restaurar = async (id: number) => {
    await restaurarSesion(id);
    setSesionesEliminadas(await papeleraSesiones(pacienteId));
    await cargar();
    await refrescarLista();
    avisar("Sesión restaurada");
  };

  const alternarSesion = (id: number, modo: Exclude<ModoSesion, null>) =>
    setSesionActiva(sesionActiva?.id === id && sesionActiva.modo === modo ? null : { id, modo });

  return (
    <div className="expediente">
      <div className="barra-acciones">
        <button className="btn" onClick={() => void nuevaSesion()} disabled={creandoSesion}>
          <CalendarPlus size={20} aria-hidden="true" />
          Nueva sesión
        </button>
        <button
          className="btn secundario"
          onClick={() => {
            setEditandoDatos((v) => !v);
            setVerDetalles(true);
          }}
        >
          {editandoDatos ? <Check size={20} aria-hidden="true" /> : <Pencil size={20} aria-hidden="true" />}
          {editandoDatos ? "Terminar de editar" : "Editar datos"}
        </button>
        <button
          className="btn secundario"
          onClick={() => {
            setEditandoNotas((v) => !v);
            setVerNotas(true);
          }}
        >
          {editandoNotas ? <Check size={20} aria-hidden="true" /> : <Pencil size={20} aria-hidden="true" />}
          {editandoNotas ? "Terminar de editar" : "Editar notas clínicas"}
        </button>
        <button className="btn secundario" onClick={() => void alternarArchivado()}>
          {p.archivado === 0 ? (
            <Archive size={20} aria-hidden="true" />
          ) : (
            <ArchiveRestore size={20} aria-hidden="true" />
          )}
          {p.archivado === 0 ? "Cerrar expediente" : "Reabrir expediente"}
        </button>
      </div>

      <div className="pestana">
        <h2>{p.nombre}</h2>
        <span className="folio">{p.folio}</span>
      </div>

      <div className="cuerpo-expediente">
        <Desplegable
          abierto={verDetalles}
          onAlternar={() => setVerDetalles((v) => !v)}
          textoAbierto="Ocultar detalles"
          textoCerrado="Ver detalles paciente"
        />
        <DatosPaciente p={p} editando={editandoDatos} visible={verDetalles} guardar={guardar} />

        <hr className="separador" />

        <Desplegable
          abierto={verNotas}
          onAlternar={() => setVerNotas((v) => !v)}
          textoAbierto="Ocultar detalles"
          textoCerrado="Ver detalles expediente"
        />
        <NotasClinicas p={p} editando={editandoNotas} visible={verNotas} guardar={guardar} />

        <hr className="separador" />

        <h3 ref={sesionesRef} className="titulo-seccion">
          Sesiones <span className="contador">({sesiones.length})</span>
        </h3>
        <Desplegable
          abierto={verSesiones}
          onAlternar={() => setVerSesiones((v) => !v)}
          textoAbierto="Ocultar sesiones"
          textoCerrado="Ver sesiones"
        />

        <div className={verSesiones ? "" : "colapsado"}>
          {sesiones.length === 0 ? (
            <p className="texto-suave">
              Todavía no hay sesiones registradas. Usa “Nueva sesión” para anotar la primera.
            </p>
          ) : (
            <div className="sesiones">
              {sesiones.map((s) => (
                <FilaSesion
                  key={s.id}
                  s={s}
                  avisar={avisar}
                  modo={sesionActiva?.id === s.id ? sesionActiva.modo : null}
                  onVer={() => alternarSesion(s.id, "ver")}
                  onEditar={() => alternarSesion(s.id, "editar")}
                  onFechaCambiada={onCambio}
                  onBorrar={() => void borrarSesion(s.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* .btn es inline-flex (para poder ponerse en fila junto a otros
            botones), asi que sin este contenedor de bloque quedaria en la
            misma linea que "Ver sesiones" en vez de debajo. */}
        <div>
          <button
            className="btn secundario no-imprimir separado-arriba"
            onClick={() => void abrirPapeleraSesiones()}
          >
            <Trash2 size={20} aria-hidden="true" />
            Papelera de sesiones
          </button>
        </div>

        <hr className="separador" />

        <Documentos pacienteId={pacienteId} pacienteNombre={p.nombre} avisar={avisar} />

        <hr className="separador" />

        <button className="btn peligro no-imprimir" onClick={() => setPorEliminar(true)}>
          <Trash2 size={20} aria-hidden="true" />
          Eliminar expediente
        </button>
      </div>

      <button
        type="button"
        className="boton-flotante no-imprimir"
        onClick={() => window.print()}
        title="Imprimir o guardar PDF"
        aria-label="Imprimir o guardar PDF"
      >
        <Printer size={22} aria-hidden="true" />
      </button>

      {porEliminar && (
        <Confirmar
          titulo="¿Eliminar este expediente?"
          detalle={`El expediente de ${p.nombre} dejará de aparecer en la lista, pero se guarda en la Papelera y lo puedes recuperar en cualquier momento.`}
          textoBoton="Sí, eliminar"
          onSi={() => void eliminarExpediente()}
          onNo={() => setPorEliminar(false)}
        />
      )}

      {sesionesEliminadas && (
        <ModalPapelera
          titulo="Papelera de sesiones"
          descripcion="Las sesiones eliminadas de este expediente se guardan aquí. Nada se borra de verdad."
          items={sesionesEliminadas.map((s) => ({
            id: s.id,
            titulo: `Sesión ${String(s.numero).padStart(2, "0")}`,
            detalle: fechaLarga(s.fecha),
          }))}
          onRestaurar={restaurar}
          onCerrar={() => setSesionesEliminadas(null)}
        />
      )}
    </div>
  );
}
