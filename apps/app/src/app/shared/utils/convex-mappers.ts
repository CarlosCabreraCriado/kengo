import type {
  DiaSemana,
  Ejercicio,
  EjercicioPlan,
  PlanCompleto,
  RegistroEjercicio,
  Usuario,
} from '../../../types/global';

/**
 * Convierte un `_creationTime` de Convex (epoch ms) a ISO 8601.
 * Devuelve `undefined` si el valor es null/undefined/0.
 */
export function toIsoFromCreationTime(
  creationTime: number | undefined | null,
): string | undefined {
  return creationTime ? new Date(creationTime).toISOString() : undefined;
}

/**
 * Extrae el `_id` de un documento Convex como string. Vacío si falta.
 */
export function mapId(raw: { _id?: string } | null | undefined): string {
  return raw?._id ?? '';
}

/**
 * Devuelve los campos base del dominio (`id` + `dateCreated`) a partir de un
 * documento Convex con `_id` y `_creationTime`. Pensado para spreadear:
 *   `{ ...mapConvexBase(raw), titulo: raw.titulo, ... }`.
 */
export function mapConvexBase(
  raw: { _id?: string; _creationTime?: number } | null | undefined,
): { id: string; dateCreated: string | undefined } {
  return {
    id: mapId(raw),
    dateCreated: toIsoFromCreationTime(raw?._creationTime),
  };
}

/**
 * Construye un `Usuario` mínimo a partir del `id` + `nombre completo` que
 * vienen embebidos en otros documentos Convex (planes, sesiones, etc.).
 */
export function mapConvexToUsuarioBasico(
  id: string,
  nombre: string | undefined,
): Usuario {
  const parts = (nombre || '').split(' ');
  return {
    id,
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
    email: '',
    email_verified: false,
    avatar: '',
    detalle: null,
    clinicas: [],
    esFisio: false,
    esPaciente: true,
  };
}

/**
 * Convierte un documento `planExercises` expandido (con `ejercicio` opcional)
 * en `EjercicioPlan` del dominio.
 */
export function mapConvexToEjercicioPlan(e: {
  _id?: string;
  sort?: number;
  planId?: string;
  ejercicio?: {
    _id?: string;
    nombreEjercicio?: string;
    descripcion?: string;
    video?: string;
    portada?: string;
  } | null;
  exerciseId?: string;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  vecesDia?: number;
  diasSemana?: DiaSemana[];
  instruccionesPaciente?: string;
  notasFisio?: string;
}): EjercicioPlan {
  return {
    id: mapId(e),
    sort: e.sort ?? 0,
    planId: e.planId ?? '',
    ejercicio: {
      id: mapId(e.ejercicio) || (e.exerciseId ?? ''),
      nombre: e.ejercicio?.nombreEjercicio ?? '',
      descripcion: e.ejercicio?.descripcion ?? '',
      video: e.ejercicio?.video ?? '',
      portada: e.ejercicio?.portada ?? '',
      categoria: [],
    } as Ejercicio,
    series: e.series,
    repeticiones: e.repeticiones,
    duracionSeg: e.duracionSeg,
    descansoSeg: e.descansoSeg,
    vecesDia: e.vecesDia,
    diasSemana: e.diasSemana,
    instruccionesPaciente: e.instruccionesPaciente,
    notasFisio: e.notasFisio,
  };
}

/**
 * Convierte un documento `plans` expandido con `ejercicios[]` en `PlanCompleto`.
 */
export function mapConvexToPlanCompleto(r: {
  _id?: string;
  _creationTime?: number;
  pacienteId: string;
  pacienteNombre?: string;
  fisioId: string;
  fisioNombre?: string;
  titulo: string;
  descripcion?: string;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
  ejercicios?: Parameters<typeof mapConvexToEjercicioPlan>[0][];
}): PlanCompleto {
  return {
    ...mapConvexBase(r),
    paciente: mapConvexToUsuarioBasico(r.pacienteId, r.pacienteNombre),
    fisio: mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
    titulo: r.titulo,
    descripcion: r.descripcion,
    estado: r.estado as PlanCompleto['estado'],
    fechaInicio: r.fechaInicio,
    fechaFin: r.fechaFin,
    items: ((r.ejercicios ?? []) as Parameters<typeof mapConvexToEjercicioPlan>[0][])
      .map((e) => mapConvexToEjercicioPlan(e))
      .sort((a, b) => a.sort - b.sort),
  };
}

/** Forma plana de un execution devuelta por
 *  `executions.queries.listByPacienteAndDate`. */
export interface ConvexExecutionRecord {
  _id: string;
  planExerciseId: string;
  pacienteId: string;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
}

/**
 * Convierte un `exerciseExecutions` plano (sin expandir) en `RegistroEjercicio`.
 */
export function mapConvexToRegistro(r: ConvexExecutionRecord): RegistroEjercicio {
  return {
    id: r._id,
    executionId: r._id,
    planItemId: r.planExerciseId,
    pacienteId: r.pacienteId,
    fechaHora: r.fechaHora,
    completado: r.completado,
    repeticionesRealizadas: r.repeticionesRealizadas,
    duracionRealSeg: r.duracionRealSeg,
    dolorEscala: r.dolorEscala,
    esfuerzoEscala: r.esfuerzoEscala,
    notaPaciente: r.notaPaciente,
  };
}
