import type { ReactNode } from "react";
import { OBLIGATORIOS_PACIENTE, TIPO_MENOR, camposDe, propsDeCampo } from "../../campos";
import type { CampoPaciente } from "../../campos";
import type { Paciente } from "../../tipos";
import { edad, fechaLarga } from "../../utilidades/fechas";
import { CampoAuto } from "../ui";

export type GuardarPaciente = (
  campo: CampoPaciente
) => (valor: string, registrarBitacora: boolean) => Promise<void>;

function Dato({ etiqueta, mono, children }: { etiqueta: string; mono?: boolean; children: ReactNode }) {
  return (
    <div>
      <span>{etiqueta}</span>
      <p className={mono ? "mono" : undefined}>{children}</p>
    </div>
  );
}

/** "Nombre · teléfono", omitiendo lo que falte. */
function contacto(nombre: string | null, telefono: string | null) {
  return (
    <>
      {nombre || "—"}
      {telefono ? ` · ${telefono}` : ""}
    </>
  );
}

/** Datos de identificación y contacto: formulario con autoguardado o tarjetas de solo lectura. */
export default function DatosPaciente({
  p,
  editando,
  visible,
  guardar,
}: {
  p: Paciente;
  editando: boolean;
  visible: boolean;
  guardar: GuardarPaciente;
}) {
  const esMenor = p.tipo_paciente === TIPO_MENOR;

  if (editando) {
    const definiciones = [
      ...camposDe("identificacion"),
      ...(esMenor ? camposDe("menor") : []),
      ...camposDe("emergencia"),
    ];
    return (
      <div className={"rejilla-form no-imprimir" + (visible ? "" : " colapsado")}>
        {definiciones.map((def) => {
          const clave = def.clave as CampoPaciente;
          return (
            <CampoAuto
              key={clave}
              {...propsDeCampo(def)}
              valorInicial={p[clave]}
              guardar={guardar(clave)}
              obligatorio={OBLIGATORIOS_PACIENTE.includes(clave)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className={"datos" + (visible ? "" : " colapsado")}>
      <Dato etiqueta="Edad">{edad(p.fecha_nacimiento)}</Dato>
      <Dato etiqueta="Nacimiento" mono>
        {fechaLarga(p.fecha_nacimiento)}
      </Dato>
      <Dato etiqueta="Tipo de paciente">{p.tipo_paciente || "—"}</Dato>
      <Dato etiqueta="Sexo">{p.sexo || "—"}</Dato>
      <Dato etiqueta="Estado civil">{p.estado_civil || "—"}</Dato>
      <Dato etiqueta="Teléfono" mono>
        {p.telefono || "—"}
      </Dato>
      <Dato etiqueta="Correo">{p.email || "—"}</Dato>
      <Dato etiqueta="Ocupación">{p.ocupacion || "—"}</Dato>
      <Dato etiqueta="Escolaridad">{p.escolaridad || "—"}</Dato>
      <Dato etiqueta="Domicilio">{p.domicilio || "—"}</Dato>
      <Dato etiqueta="Primera consulta" mono>
        {fechaLarga(p.fecha_ingreso)}
      </Dato>
      <Dato etiqueta="Emergencia">
        {p.emergencia_nombre || "—"}
        {p.emergencia_parentesco ? ` (${p.emergencia_parentesco})` : ""}
        {p.emergencia_telefono ? ` · ${p.emergencia_telefono}` : ""}
      </Dato>
      {esMenor && (
        <>
          <Dato etiqueta="Madre">{contacto(p.madre_nombre, p.madre_telefono)}</Dato>
          <Dato etiqueta="Padre">{contacto(p.padre_nombre, p.padre_telefono)}</Dato>
        </>
      )}
    </div>
  );
}
