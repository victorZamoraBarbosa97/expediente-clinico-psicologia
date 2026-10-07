import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { MODALIDADES } from "../../campos";
import type { CampoSesion } from "../../campos";
import { guardarCampoSesion } from "../../db";
import type { Sesion } from "../../tipos";
import { fechaLarga } from "../../utilidades/fechas";
import { mensajeDe } from "../../utilidades/intentar";
import type { Avisar } from "../../utilidades/intentar";
import { Campo, CampoAuto, Confirmar, SinDato } from "../ui";

export type ModoSesion = "ver" | "editar" | null;

/** Una sesión en la línea de tiempo: resumen, vista completa o edición. */
export default function FilaSesion({
  s,
  modo,
  onVer,
  onEditar,
  onBorrar,
  onFechaCambiada,
  avisar,
}: {
  s: Sesion;
  modo: ModoSesion;
  onVer: () => void;
  onEditar: () => void;
  onBorrar: () => void;
  /** La fecha determina "última sesión" en la lista de pacientes; ningún otro campo la afecta. */
  onFechaCambiada: () => Promise<void> | void;
  avisar: Avisar;
}) {
  const [porBorrar, setPorBorrar] = useState(false);
  const [datos, setDatos] = useState(s);
  // Contraida por defecto para no saturar la pantalla cuando hay muchas sesiones;
  // se abre sola si el padre pone esta sesion en modo "ver" o "editar" (por
  // ejemplo, al crear una sesion nueva), pero nunca se vuelve a cerrar sola.
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    if (modo !== null) setAbierta(true);
  }, [modo]);

  /** Autoguardado de los campos de texto: el estado local solo se actualiza si el guardado funcionó. */
  const guardar = (campo: CampoSesion) => async (v: string, registrarBitacora: boolean) => {
    try {
      await guardarCampoSesion(s.id, campo, v, registrarBitacora);
    } catch (e) {
      avisar("No se pudo guardar el cambio. " + mensajeDe(e), true);
      throw e;
    }
    setDatos((d) => ({ ...d, [campo]: campo === "duracion_min" ? Number(v) : v }));
  };

  // Los campos directos (fecha, hora, modalidad, asistencia) no pasan por el
  // autoguardado con espera: cada cambio es una accion completa y deliberada
  // (elegir una fecha, marcar la casilla), asi que aqui si se registra en la
  // bitacora de una vez, sin esperar a un "terminar de editar".
  const cambiarDirecto = async (campo: CampoSesion, v: string | number) => {
    // Una fecha a medio escribir llega como "": no se guarda ni se borra la anterior.
    if (v === "" && campo === "fecha") return;
    const anterior = datos[campo];
    setDatos((d) => ({ ...d, [campo]: v }));
    try {
      await guardarCampoSesion(s.id, campo, v, true);
    } catch (e) {
      setDatos((d) => ({ ...d, [campo]: anterior }));
      avisar("No se pudo guardar el cambio. " + mensajeDe(e), true);
      return;
    }
    if (campo === "fecha") {
      try {
        await onFechaCambiada();
      } catch (e) {
        console.error("No se pudo actualizar la lista de pacientes:", e);
      }
    }
  };

  return (
    <article className={"sesion" + (datos.asistio === 0 ? " falta" : "")}>
      <div className="canal">
        <span className="num">Sesión</span>
        <span className="n">{String(datos.numero).padStart(2, "0")}</span>
      </div>

      <div className="contenido">
        <div className="encabezado">
          <button
            type="button"
            className="sesion-toggle no-imprimir"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            aria-label={abierta ? "Contraer sesión" : "Expandir sesión"}
          >
            {abierta ? (
              <ChevronDown size={20} aria-hidden="true" />
            ) : (
              <ChevronRight size={20} aria-hidden="true" />
            )}
          </button>
          <span className="fecha">{fechaLarga(datos.fecha)}</span>
          {datos.hora && <span className="fecha">{datos.hora}</span>}
          <span className="etiqueta">{datos.modalidad}</span>
          <span className="etiqueta">{datos.duracion_min} min</span>
          {datos.asistio === 0 && <span className="etiqueta alerta">No asistió</span>}
        </div>

        <div className={abierta ? "" : "colapsado"}>
          {modo === "editar" ? (
            <div className="no-imprimir">
              <div className="rejilla-form">
                <Campo
                  etiqueta="Fecha"
                  tipo="date"
                  valor={datos.fecha}
                  onChange={(v) => void cambiarDirecto("fecha", v)}
                />
                <Campo
                  etiqueta="Hora"
                  tipo="time"
                  valor={datos.hora ?? ""}
                  onChange={(v) => void cambiarDirecto("hora", v)}
                />
                <CampoAuto
                  etiqueta="Duración (minutos)"
                  tipo="number"
                  valorInicial={String(datos.duracion_min)}
                  guardar={guardar("duracion_min")}
                  obligatorio
                />
                <Campo
                  etiqueta="Modalidad"
                  valor={datos.modalidad}
                  onChange={(v) => void cambiarDirecto("modalidad", v)}
                  opciones={[...MODALIDADES]}
                  obligatorio
                />
              </div>

              <label className="casilla">
                <input
                  type="checkbox"
                  checked={datos.asistio === 0}
                  onChange={(e) => void cambiarDirecto("asistio", e.target.checked ? 0 : 1)}
                />
                El paciente no asistió a esta sesión
              </label>

              <CampoAuto
                etiqueta="Notas de la sesión"
                valorInicial={datos.notas_evolucion}
                guardar={guardar("notas_evolucion")}
                area
                placeholder="Cómo llegó, qué se trabajó, cómo respondió"
              />
              <CampoAuto
                etiqueta="Técnicas e intervenciones"
                valorInicial={datos.intervenciones}
                guardar={guardar("intervenciones")}
                area
              />
              <CampoAuto
                etiqueta="Tareas para casa"
                valorInicial={datos.tareas}
                guardar={guardar("tareas")}
                area
              />
              <CampoAuto
                etiqueta="Próxima cita"
                tipo="date"
                valorInicial={datos.proxima_cita}
                guardar={guardar("proxima_cita")}
              />
            </div>
          ) : modo === "ver" ? (
            <div className="no-imprimir">
              <div className="bloque bloque-vista">
                <h3 className="titulo-chico">Notas de la sesión</h3>
                <p className="notas">{datos.notas_evolucion || <SinDato>Sin notas todavía.</SinDato>}</p>
              </div>
              <div className="bloque bloque-vista">
                <h3 className="titulo-chico">Técnicas e intervenciones</h3>
                <p>{datos.intervenciones || <SinDato />}</p>
              </div>
              <div className="bloque bloque-vista">
                <h3 className="titulo-chico">Tareas para casa</h3>
                <p>{datos.tareas || <SinDato>Sin tareas asignadas.</SinDato>}</p>
              </div>
              <div className="bloque bloque-vista">
                <h3 className="titulo-chico">Próxima cita</h3>
                <p className="mono">
                  {datos.proxima_cita ? fechaLarga(datos.proxima_cita) : <SinDato>Sin agendar.</SinDato>}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="notas">{datos.notas_evolucion || <SinDato>Sin notas todavía.</SinDato>}</p>
              {datos.tareas && (
                <p className="sub">
                  <b>Tareas:</b> {datos.tareas}
                </p>
              )}
              {datos.proxima_cita && (
                <p className="sub">
                  <b>Próxima cita:</b> {fechaLarga(datos.proxima_cita)}
                </p>
              )}
            </>
          )}
        </div>

        <div className="acciones-sesion no-imprimir">
          {modo !== "editar" && (
            <button className="btn secundario mini" onClick={onVer}>
              {modo === "ver" ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
              {modo === "ver" ? "Listo" : "Ver sesión"}
            </button>
          )}
          <button className="btn secundario mini" onClick={onEditar}>
            {modo === "editar" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Pencil size={16} aria-hidden="true" />
            )}
            {modo === "editar" ? "Listo" : "Editar sesión"}
          </button>
          <button className="btn peligro mini" onClick={() => setPorBorrar(true)}>
            <Trash2 size={16} aria-hidden="true" />
            Eliminar sesión
          </button>
        </div>
      </div>

      {porBorrar && (
        <Confirmar
          titulo={`¿Eliminar la sesión ${datos.numero}?`}
          detalle="La sesión desaparece del expediente. Queda registrada en la base de datos, así que se puede recuperar si hace falta."
          textoBoton="Sí, eliminar"
          onSi={() => {
            setPorBorrar(false);
            onBorrar();
          }}
          onNo={() => setPorBorrar(false)}
        />
      )}
    </article>
  );
}
