import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { registrarVaciado } from "../utilidades/autoguardado";

/* ------------------------------- Campo simple ------------------------------ */

export type CampoProps = {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  area?: boolean;
  opciones?: string[];
  completo?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Para listas desplegables de campos NOT NULL: sin la opción vacía "—". */
  obligatorio?: boolean;
  /** Nombre para lectores de pantalla cuando no hay etiqueta visible. */
  nombreAccesible?: string;
};

export function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = "text",
  area,
  opciones,
  completo,
  placeholder,
  autoFocus,
  obligatorio,
  nombreAccesible,
}: CampoProps) {
  const comun = {
    value: valor,
    autoFocus,
    "aria-label": etiqueta ? undefined : nombreAccesible,
  };
  return (
    <label className={"campo" + (completo ? " completo" : "")}>
      {etiqueta && <span>{etiqueta}</span>}
      {area ? (
        <textarea
          {...comun}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : opciones ? (
        <select {...comun} onChange={(e) => onChange(e.target.value)}>
          {!obligatorio && <option value="">—</option>}
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...comun}
          type={tipo}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

/* --------------------------- Campo con autoguardado --------------------------- */

type Estado = "quieto" | "escribiendo" | "guardado" | "error" | "vacio";

type AutoProps = Omit<CampoProps, "onChange" | "valor"> & {
  valorInicial: string | null;
  /** El segundo parametro dice si este guardado debe dejar marca en la bitacora
   * (una sola vez por sesion de edicion) o es solo un autoguardado intermedio. */
  guardar: (v: string, registrarBitacora: boolean) => Promise<void>;
};

const MENSAJES: Record<Estado, string> = {
  quieto: "",
  guardado: "✓ Guardado",
  escribiendo: "Guardando…",
  error: "⚠ No se pudo guardar, vuelve a intentar",
  vacio: "⚠ Este campo no puede quedar vacío. Se conserva lo último que se guardó.",
};

/**
 * Guarda solo cuando el texto deja de cambiar por 800 ms, y ademas al salir del
 * campo. Muestra el estado en pantalla para que ella nunca tenga que preguntarse
 * si su nota quedo escrita.
 *
 * - Lo que ella escribe manda: mientras haya texto sin guardar, un valor nuevo que
 *   llegue de afuera (el eco de un guardado anterior) no lo pisa.
 * - Los guardados de un mismo campo van en cola, en orden, para que uno lento no
 *   termine despues de uno mas nuevo y deje la version vieja en la base.
 * - La bitacora se marca UNA vez por sesion de edicion (al desmontarse el campo o
 *   cerrar la ventana), no en cada autoguardado de 800 ms.
 * - Con `obligatorio`, un texto vacio no se guarda (la columna es NOT NULL).
 */
export function CampoAuto({ valorInicial, guardar, obligatorio, ...resto }: AutoProps) {
  const [valor, setValor] = useState(valorInicial ?? "");
  const [estado, setEstado] = useState<Estado>("quieto");
  const reloj = useRef<number | undefined>(undefined);
  const pendiente = useRef(false);
  const huboCambio = useRef(false);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const valorRef = useRef(valor);
  const guardarRef = useRef(guardar);
  valorRef.current = valor;
  guardarRef.current = guardar;

  useEffect(() => {
    if (pendiente.current) return;
    const nuevo = valorInicial ?? "";
    if (nuevo === valorRef.current) return; // es el eco de nuestro propio guardado
    setValor(nuevo);
    setEstado("quieto");
    huboCambio.current = false;
  }, [valorInicial]);

  const enCola = (v: string, registrarBitacora: boolean) => {
    const guardado = cola.current.then(() => guardarRef.current(v, registrarBitacora));
    cola.current = guardado.catch(() => undefined);
    return guardado;
  };

  const confirmar = async (v: string, registrarBitacora: boolean): Promise<boolean> => {
    if (!pendiente.current) return true;
    pendiente.current = false;
    try {
      await enCola(v, registrarBitacora);
      huboCambio.current = true;
      // Si mientras se guardaba ella siguio escribiendo, el estado ya es "escribiendo".
      if (!pendiente.current) setEstado("guardado");
      return true;
    } catch (e) {
      console.error("No se pudo guardar el campo:", e);
      pendiente.current = true; // sigue sin guardar: que el siguiente intento lo reintente
      setEstado("error");
      return false;
    }
  };

  const escribir = (v: string) => {
    setValor(v);
    window.clearTimeout(reloj.current);
    if (obligatorio && v.trim() === "") {
      pendiente.current = false;
      setEstado("vacio");
      return;
    }
    setEstado("escribiendo");
    pendiente.current = true;
    reloj.current = window.setTimeout(() => void confirmar(v, false), 800);
  };

  /** Cierra la sesion de edicion de este campo: guarda lo pendiente (si hay) y deja
   * la marca de bitacora, sin repetirla si ya se habia guardado antes. Devuelve false
   * si algo no se pudo guardar. */
  const terminar = async (): Promise<boolean> => {
    window.clearTimeout(reloj.current);
    let ok = true;
    if (pendiente.current) {
      ok = await confirmar(valorRef.current, true);
    } else if (huboCambio.current) {
      huboCambio.current = false;
      try {
        await enCola(valorRef.current, true);
      } catch (e) {
        console.error("No se pudo registrar el cambio en la bitácora:", e);
        ok = false;
      }
    }
    await cola.current; // por si quedaba un guardado en vuelo
    return ok;
  };

  // Se registra una sola vez (dependencias vacias) y lee el valor por ref: si
  // dependiera de [valor] (o de "terminar", que se recrea en cada render), cada
  // tecla reharia el efecto y el cleanup del anterior dispararia terminar() de
  // inmediato, matando el debounce de 800 ms.
  useEffect(() => {
    const alSalir = () => void terminar();
    window.addEventListener("beforeunload", alSalir);
    const olvidar = registrarVaciado(terminar);
    return () => {
      window.removeEventListener("beforeunload", alSalir);
      olvidar();
      void terminar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esError = estado === "error" || estado === "vacio";

  return (
    <div>
      <Campo {...resto} valor={valor} onChange={escribir} obligatorio={obligatorio} />
      <div
        className={
          "estado-guardado bajo-campo" +
          (estado === "escribiendo" ? " pendiente" : "") +
          (esError ? " error" : "")
        }
        role={esError ? "alert" : "status"}
      >
        {MENSAJES[estado]}
      </div>
    </div>
  );
}

/* ---------------------------------- Aviso ---------------------------------- */

export function Aviso({ texto, error }: { texto: string | null; error?: boolean }) {
  if (!texto) return null;
  return (
    <div className={"aviso" + (error ? " error" : "")} role={error ? "alert" : "status"}>
      {texto}
    </div>
  );
}

/* -------------------------------- Confirmar -------------------------------- */

export function Confirmar({
  titulo,
  detalle,
  textoBoton,
  textoNo = "Cancelar",
  icono = <Trash2 size={20} aria-hidden="true" />,
  onSi,
  onNo,
}: {
  titulo: string;
  detalle: ReactNode;
  textoBoton: string;
  textoNo?: string;
  icono?: ReactNode;
  onSi: () => void;
  onNo: () => void;
}) {
  return (
    <Modal titulo={titulo} onCerrar={onNo} tamano="angosto">
      <p className="sin-margen-arriba">{detalle}</p>
      <div className="pie-modal">
        <button className="btn secundario" onClick={onNo} autoFocus>
          <X size={20} aria-hidden="true" />
          {textoNo}
        </button>
        <button className="btn peligro" onClick={onSi}>
          {icono}
          {textoBoton}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Sin dato -------------------------------- */

/** Texto atenuado para campos todavía vacíos. */
export function SinDato({ children = "Sin información registrada." }: { children?: ReactNode }) {
  return <em className="sin-dato">{children}</em>;
}
