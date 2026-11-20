/**
 * Helpers de dominio para el discriminador de métrica de un ejercicio prescrito.
 *
 * Invariante: un ejercicio prescrito lleva SOLO una métrica por serie según su
 * `tipo`. `series` y `descansoSeg` son ortogonales y no se tocan.
 *   - `tipo === "duracion"`   ⇒ `duracionSeg` definido, `repeticiones` undefined.
 *   - `tipo === "repeticiones"` (o `undefined`) ⇒ `repeticiones` definido,
 *      `duracionSeg` undefined.
 */

export type TipoEjercicio = "repeticiones" | "duracion";
export type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";

export function normalizarMetricaEjercicio<
  T extends {
    tipo?: TipoEjercicio;
    repeticiones?: number;
    duracionSeg?: number;
  },
>(ej: T): T {
  if (ej.tipo === "duracion") {
    return { ...ej, repeticiones: undefined };
  }
  // "repeticiones" o undefined (legacy) → se trata como repeticiones.
  return { ...ej, duracionSeg: undefined };
}

/** Ejercicio prescrito tal como puede llegar en los args (con `null`). */
export interface EjercicioPrescritoEntrada<ExerciseId> {
  exerciseId: ExerciseId;
  sort: number;
  tipo?: TipoEjercicio | null;
  series?: number | null;
  repeticiones?: number | null;
  duracionSeg?: number | null;
  descansoSeg?: number | null;
  diasSemana?: DiaSemana[] | null;
  instruccionesPaciente?: string | null;
  notasFisio?: string | null;
}

/** Ejercicio prescrito listo para insertar (`planExercises`/`routineExercises`). */
export interface EjercicioPrescrito<ExerciseId> {
  exerciseId: ExerciseId;
  sort: number;
  tipo?: TipoEjercicio;
  series?: number;
  repeticiones?: number;
  duracionSeg?: number;
  descansoSeg?: number;
  diasSemana?: DiaSemana[];
  instruccionesPaciente?: string;
  notasFisio?: string;
}

const sinNulo = <T>(valor: T | null | undefined): T | undefined =>
  valor ?? undefined;

/** Un número no finito (NaN, Infinity) se trata como casilla vacía. */
const numeroValido = (valor: number | null | undefined): number | undefined =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : undefined;

/**
 * Normaliza un ejercicio prescrito antes de insertarlo:
 *  - `null` (casilla vaciada en el builder) → campo ausente, que es lo único
 *    que admite el schema (`v.optional`).
 *  - Aplica la invariante de métrica de `normalizarMetricaEjercicio`.
 *
 * Todas las escrituras de `planExercises` y `routineExercises` que parten de
 * args del cliente deben pasar por aquí.
 */
export function sanearEjercicioPrescrito<ExerciseId>(
  ej: EjercicioPrescritoEntrada<ExerciseId>,
): EjercicioPrescrito<ExerciseId> {
  return normalizarMetricaEjercicio({
    exerciseId: ej.exerciseId,
    sort: ej.sort,
    tipo: sinNulo(ej.tipo),
    series: numeroValido(ej.series),
    repeticiones: numeroValido(ej.repeticiones),
    duracionSeg: numeroValido(ej.duracionSeg),
    descansoSeg: numeroValido(ej.descansoSeg),
    diasSemana: sinNulo(ej.diasSemana),
    instruccionesPaciente: sinNulo(ej.instruccionesPaciente),
    notasFisio: sinNulo(ej.notasFisio),
  });
}
