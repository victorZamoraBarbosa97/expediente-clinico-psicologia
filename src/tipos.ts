import type { CampoPaciente } from "./campos";

type CamposOpcionales = Exclude<CampoPaciente, "nombre" | "fecha_ingreso">;

/** Fila de `pacientes`. Los campos editables salen de la definición en campos.ts. */
export type Paciente = {
  id: number;
  folio: string;
  nombre: string;
  fecha_ingreso: string;
  /** 0 = abierto, 1 = cerrado. */
  archivado: number;
  eliminado_en: string | null;
  creado_en: string;
  actualizado_en: string;
} & Record<CamposOpcionales, string | null>;

/** Datos para dar de alta un paciente: solo el nombre es indispensable. */
export type DatosPaciente = Partial<Record<CampoPaciente, string>> & { folio?: string };

export type PacienteEnLista = Paciente & {
  total_sesiones: number;
  ultima_sesion: string | null;
};

export type Sesion = {
  id: number;
  paciente_id: number;
  numero: number;
  fecha: string;
  hora: string | null;
  duracion_min: number;
  modalidad: string;
  /** 1 = asistió, 0 = no asistió. */
  asistio: number;
  notas_evolucion: string | null;
  intervenciones: string | null;
  tareas: string | null;
  proxima_cita: string | null;
  eliminado_en: string | null;
};

export type Documento = {
  id: number;
  paciente_id: number;
  titulo: string;
  tipo: string | null;
  ruta: string;
  tamano_bytes: number | null;
  eliminado_en: string | null;
  creado_en: string;
};

export type Bitacora = {
  id: number;
  tabla: string;
  registro_id: number;
  accion: string;
  detalle: string | null;
  momento: string;
};
