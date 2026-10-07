/**
 * Definición única de los campos de un paciente. De aquí salen:
 *  - la lista blanca de columnas guardables (`CAMPOS_PACIENTE`, ver db.ts),
 *  - el tipo `Paciente` (tipos.ts),
 *  - el INSERT de `crearPaciente`,
 *  - el formulario de alta y las vistas de edición de la ficha.
 *
 * Agregar un campo nuevo = una migración SQL + una entrada aquí. Nada más.
 */

export const TIPO_MENOR = "Niño, niña o adolescente";
export const TIPOS_PACIENTE = ["Adulto", TIPO_MENOR] as const;
export const SEXOS = ["Mujer", "Hombre", "Otro", "Prefiere no decir"] as const;
export const ESTADOS_CIVILES = [
  "Soltera/o",
  "Casada/o",
  "Unión libre",
  "Divorciada/o",
  "Viuda/o",
] as const;
export const MODALIDADES = ["Presencial", "Videollamada", "Telefónica"] as const;

export type TipoCampo = "texto" | "tel" | "email" | "fecha" | "area" | "opciones";

/** Apartado del expediente al que pertenece el campo. */
export type GrupoCampo =
  | "identificacion"
  | "menor" // solo se pide si el paciente es niño, niña o adolescente
  | "emergencia"
  | "clinico"
  | "familiar"
  | "diagnostico";

export type DefCampo = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  grupo: GrupoCampo;
  opciones?: readonly string[];
  placeholder?: string;
  /** Ocupa toda la fila en las rejillas de formulario. */
  completo?: boolean;
};

export const DEFINICION_CAMPOS = [
  { clave: "nombre", etiqueta: "Nombre completo", tipo: "texto", grupo: "identificacion", completo: true },
  { clave: "fecha_nacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha", grupo: "identificacion" },
  { clave: "tipo_paciente", etiqueta: "Tipo de paciente", tipo: "opciones", grupo: "identificacion", opciones: TIPOS_PACIENTE },
  { clave: "sexo", etiqueta: "Sexo", tipo: "opciones", grupo: "identificacion", opciones: SEXOS },
  { clave: "telefono", etiqueta: "Teléfono", tipo: "tel", grupo: "identificacion" },
  { clave: "email", etiqueta: "Correo", tipo: "email", grupo: "identificacion" },
  { clave: "domicilio", etiqueta: "Domicilio", tipo: "texto", grupo: "identificacion", completo: true },
  { clave: "ocupacion", etiqueta: "Ocupación", tipo: "texto", grupo: "identificacion" },
  { clave: "estado_civil", etiqueta: "Estado civil", tipo: "opciones", grupo: "identificacion", opciones: ESTADOS_CIVILES },
  { clave: "escolaridad", etiqueta: "Escolaridad", tipo: "texto", grupo: "identificacion" },
  { clave: "fecha_ingreso", etiqueta: "Primera consulta", tipo: "fecha", grupo: "identificacion" },
  { clave: "madre_nombre", etiqueta: "Nombre completo de la madre", tipo: "texto", grupo: "menor" },
  { clave: "madre_telefono", etiqueta: "Teléfono de la madre", tipo: "tel", grupo: "menor" },
  { clave: "padre_nombre", etiqueta: "Nombre completo del padre", tipo: "texto", grupo: "menor" },
  { clave: "padre_telefono", etiqueta: "Teléfono del padre", tipo: "tel", grupo: "menor" },
  { clave: "emergencia_nombre", etiqueta: "Contacto de emergencia", tipo: "texto", grupo: "emergencia" },
  { clave: "emergencia_telefono", etiqueta: "Teléfono de emergencia", tipo: "tel", grupo: "emergencia" },
  { clave: "emergencia_parentesco", etiqueta: "Parentesco", tipo: "texto", grupo: "emergencia" },
  {
    clave: "motivo_consulta",
    etiqueta: "Motivo de consulta",
    tipo: "area",
    grupo: "clinico",
    placeholder: "Lo que el paciente refiere en sus propias palabras",
  },
  {
    clave: "antecedentes",
    etiqueta: "Antecedentes psicológicos y psiquiátricos",
    tipo: "area",
    grupo: "clinico",
    placeholder:
      "Terapias previas, diagnósticos, tratamientos, internamientos o crisis, historial de conductas, eventos traumáticos",
  },
  {
    clave: "salud",
    etiqueta: "Antecedentes de salud",
    tipo: "area",
    grupo: "clinico",
    placeholder:
      "Enfermedades crónicas, medicamentos de uso continuo, accidentes, cirugías, consumo de sustancias y estilo de vida",
  },
  {
    clave: "antecedentes_familiares_medicos",
    etiqueta: "Antecedentes familiares médicos",
    tipo: "area",
    grupo: "familiar",
    placeholder: "Enfermedades médicas relevantes o hereditarias en la familia",
  },
  {
    clave: "antecedentes_familiares_psicologicos",
    etiqueta: "Antecedentes familiares psicológicos",
    tipo: "area",
    grupo: "familiar",
    placeholder:
      "Diagnósticos psicológicos o psiquiátricos en la familia, estructura y dinámica familiar",
  },
  {
    clave: "impresion_diagnostica",
    etiqueta: "Impresión diagnóstica",
    tipo: "area",
    grupo: "diagnostico",
    placeholder: "Diagnóstico o hipótesis diagnóstica y los criterios que la sustentan",
  },
  {
    clave: "plan_tratamiento",
    etiqueta: "Plan de tratamiento",
    tipo: "area",
    grupo: "diagnostico",
    placeholder:
      "Objetivos terapéuticos, enfoque y técnicas a utilizar, frecuencia sugerida de sesiones",
  },
] as const satisfies readonly DefCampo[];

export type CampoPaciente = (typeof DEFINICION_CAMPOS)[number]["clave"];

/** Lista blanca de columnas de `pacientes` que se pueden guardar campo por campo. */
export const CAMPOS_PACIENTE: readonly CampoPaciente[] = DEFINICION_CAMPOS.map((c) => c.clave);

/** Columnas `NOT NULL` sin valor por defecto: la interfaz no puede dejarlas vacías. */
export const OBLIGATORIOS_PACIENTE: readonly CampoPaciente[] = ["nombre", "fecha_ingreso"];

export function camposDe(...grupos: GrupoCampo[]): DefCampo[] {
  return DEFINICION_CAMPOS.filter((c) => (grupos as string[]).includes(c.grupo));
}

export function definicionDe(clave: CampoPaciente): DefCampo {
  const def = DEFINICION_CAMPOS.find((c) => c.clave === clave);
  if (!def) throw new Error(`Campo sin definición: ${clave}`);
  return def;
}

const TIPO_INPUT: Record<TipoCampo, string> = {
  texto: "text",
  tel: "tel",
  email: "email",
  fecha: "date",
  area: "text",
  opciones: "text",
};

/** Propiedades de `<Campo>` que se derivan de la definición. */
export function propsDeCampo(def: DefCampo) {
  return {
    etiqueta: def.etiqueta,
    tipo: TIPO_INPUT[def.tipo],
    area: def.tipo === "area",
    opciones: def.tipo === "opciones" ? [...(def.opciones ?? [])] : undefined,
    placeholder: def.placeholder,
    completo: def.completo || def.tipo === "area",
  };
}

/* --------------------------------- Sesiones --------------------------------- */

export const CAMPOS_SESION = [
  "fecha",
  "hora",
  "duracion_min",
  "modalidad",
  "asistio",
  "notas_evolucion",
  "intervenciones",
  "tareas",
  "proxima_cita",
] as const;

export type CampoSesion = (typeof CAMPOS_SESION)[number];

/** Columnas `NOT NULL` de `sesiones`: no se pueden dejar vacías. */
export const OBLIGATORIOS_SESION: readonly CampoSesion[] = [
  "fecha",
  "duracion_min",
  "modalidad",
  "asistio",
];
