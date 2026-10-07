import { useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { CAMPOS_PACIENTE, TIPO_MENOR, camposDe, propsDeCampo } from "../campos";
import type { CampoPaciente, DefCampo } from "../campos";
import type { DatosPaciente } from "../tipos";
import { Campo, Confirmar } from "../componentes/ui";
import Modal from "../componentes/Modal";
import { hoy } from "../utilidades/fechas";

type Datos = Record<CampoPaciente, string>;

const datosIniciales = (): Datos =>
  Object.fromEntries(CAMPOS_PACIENTE.map((c) => [c, c === "fecha_ingreso" ? hoy() : ""])) as Datos;

export default function FormPaciente({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (datos: DatosPaciente) => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [inicial] = useState(datosIniciales);
  const [d, setD] = useState<Datos>(inicial);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  // Guarda ademas en un ref (sincrono) porque el estado de React se actualiza
  // en el siguiente render: un doble clic muy rapido puede disparar el
  // segundo onClick antes de que el boton alcance a deshabilitarse.
  const enviandoRef = useRef(false);

  const set = (k: CampoPaciente) => (v: string) => setD((prev) => ({ ...prev, [k]: v }));
  const hayCambios = CAMPOS_PACIENTE.some((c) => d[c] !== inicial[c]);

  /** Cerrar sin guardar: si ya escribio algo, primero se confirma (nada se pierde por un clic o Esc de mas). */
  const intentarCancelar = () => (hayCambios ? setDescartando(true) : onCancelar());

  const enviar = async () => {
    if (enviandoRef.current) return;
    if (d.nombre.trim().length < 3) {
      setError("Escribe el nombre completo del paciente para poder continuar.");
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    try {
      await onGuardar(d);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const campo = (def: DefCampo) => (
    <Campo
      key={def.clave}
      {...propsDeCampo(def)}
      valor={d[def.clave as CampoPaciente]}
      onChange={set(def.clave as CampoPaciente)}
      autoFocus={def.clave === "nombre"}
    />
  );

  return (
    <>
      <Modal titulo="Nuevo paciente" onCerrar={intentarCancelar} cerrarConFondo={false}>
        <p className="modal-intro">
          Con el nombre es suficiente para empezar. Lo demás se puede llenar después,
          directo en el expediente.
        </p>

        <div className="rejilla-form">
          {camposDe("identificacion").map(campo)}

          {d.tipo_paciente === TIPO_MENOR && (
            <>
              <hr className="separador completo en-form" />
              {camposDe("menor").map(campo)}
            </>
          )}

          <hr className="separador completo en-form" />
          {camposDe("emergencia").map(campo)}

          <hr className="separador completo en-form" />
          <h3 className="completo subtitulo-form">Datos clínicos</h3>
          <p className="completo texto-suave nota-form">
            También se pueden llenar después, directo en el expediente.
          </p>
          {camposDe("clinico").map(campo)}

          <hr className="separador completo en-form" />
          <h3 className="completo subtitulo-grupo">Antecedentes familiares</h3>
          {camposDe("familiar").map(campo)}

          {camposDe("diagnostico").map(campo)}
        </div>

        {error && (
          <p className="error-formulario" role="alert">
            {error}
          </p>
        )}

        <div className="pie-modal">
          <button className="btn secundario" onClick={intentarCancelar}>
            <X size={20} aria-hidden="true" />
            Cancelar
          </button>
          <button className="btn" onClick={() => void enviar()} disabled={enviando}>
            <UserPlus size={20} aria-hidden="true" />
            Crear expediente
          </button>
        </div>
      </Modal>

      {descartando && (
        <Confirmar
          titulo="¿Descartar lo que escribiste?"
          detalle="Si cierras ahora, el expediente nuevo no se crea y se pierde lo capturado."
          textoBoton="Sí, descartar"
          textoNo="Seguir escribiendo"
          icono={<X size={20} aria-hidden="true" />}
          onSi={onCancelar}
          onNo={() => setDescartando(false)}
        />
      )}
    </>
  );
}
