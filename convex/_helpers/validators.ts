import { v, type Validator } from "convex/values";

export const diaSemana = v.union(
  v.literal("L"),
  v.literal("M"),
  v.literal("X"),
  v.literal("J"),
  v.literal("V"),
  v.literal("S"),
  v.literal("D"),
);

export const tipoEjercicio = v.union(
  v.literal("repeticiones"),
  v.literal("duracion"),
);

/**
 * Campo opcional que además tolera `null` en los ARGS de una mutation.
 *
 * El builder de planes del cliente pone `null` en un campo numérico cuando el
 * fisio vacía la casilla, y esos borradores se persisten en `localStorage`.
 * `v.optional(...)` solo admite el campo ausente, así que un `null` hacía que
 * Convex rechazara la mutación entera (`ArgumentValidationError`) y el fisio
 * solo veía "No se pudo guardar el plan". Aceptarlo aquí cubre también las
 * apps nativas ya publicadas.
 *
 * Solo para args: el schema sigue siendo `v.optional(...)`, por lo que el
 * valor DEBE pasar por `sanearEjercicioPrescrito` antes de cualquier insert.
 */
const opcionalONulo = <T extends Validator<any, "required", any>>(validator: T) =>
  v.optional(v.union(validator, v.null()));

/**
 * Args de un ejercicio prescrito (planes y rutinas). Tolerante a `null` en los
 * campos opcionales; ver `opcionalONulo`.
 */
export const ejercicioPrescritoArgs = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  tipo: opcionalONulo(tipoEjercicio),
  series: opcionalONulo(v.number()),
  repeticiones: opcionalONulo(v.number()),
  duracionSeg: opcionalONulo(v.number()),
  descansoSeg: opcionalONulo(v.number()),
  diasSemana: opcionalONulo(v.array(diaSemana)),
  instruccionesPaciente: opcionalONulo(v.string()),
  notasFisio: opcionalONulo(v.string()),
});

export const estadoPlan = v.union(
  v.literal("borrador"),
  v.literal("activo"),
  v.literal("completado"),
  v.literal("modificado"),
  v.literal("cancelado"),
);

export const tipoCodigo = v.union(
  v.literal("fisioterapeuta"),
  v.literal("paciente"),
);

export const visibilidadRutina = v.union(
  v.literal("privado"),
  v.literal("clinica"),
);

