import { camposDe } from "../../campos";
import type { CampoPaciente, DefCampo } from "../../campos";
import type { Paciente } from "../../tipos";
import { CampoAuto, SinDato } from "../ui";
import type { GuardarPaciente } from "./DatosPaciente";

/** Notas clínicas del expediente: motivo, antecedentes, impresión diagnóstica, plan. */
export default function NotasClinicas({
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
  const bloque = (def: DefCampo) => {
    const clave = def.clave as CampoPaciente;
    return editando ? (
      <div className="bloque" key={clave}>
        <h3>{def.etiqueta}</h3>
        <CampoAuto
          etiqueta=""
          nombreAccesible={def.etiqueta}
          valorInicial={p[clave]}
          guardar={guardar(clave)}
          area
          placeholder={def.placeholder}
        />
      </div>
    ) : (
      <div className="bloque bloque-vista" key={clave}>
        <h3>{def.etiqueta}</h3>
        <p>{p[clave] || <SinDato />}</p>
      </div>
    );
  };

  const contenido = (
    <>
      {camposDe("clinico").map(bloque)}
      <hr className="separador" />
      <h3 className="subtitulo-grupo">Antecedentes familiares</h3>
      {camposDe("familiar").map(bloque)}
      {camposDe("diagnostico").map(bloque)}
    </>
  );

  return (
    <div className={visible ? "" : "colapsado"}>
      {editando ? <div className="no-imprimir">{contenido}</div> : contenido}
    </div>
  );
}
