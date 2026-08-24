/**
 * Rollups diarios "virtuales": la forma de `dailyPatientRollup` para un día
 * ya pasado que NUNCA tuvo actividad ni fue materializado por el cron.
 *
 * Se usa en lectura (`rollups.queries.getDailyByPaciente`) para que un día
 * con plan vigente sin sesión cuente como `fallido` (o `descanso`) aunque el
 * cron de materialización no lo haya persistido: sin esto, el día
 * desaparece del denominador de la adherencia y el porcentaje se infla.
 *
 * Funciones puras (sin `ctx.db`): testeables en aislamiento.
 */

import { Doc, Id } from "../_generated/dataModel";
import { computeEstadoDia } from "./rollupComputation";
import { rangeOfDates } from "./datetime";
import type { ExpectedExerciseItem } from "./expectedExercises";

/** Doc de rollup diario sin los metadatos del sistema (`_id`, `_creationTime`). */
export type DailyRollupShape = Omit<
  Doc<"dailyPatientRollup">,
  "_id" | "_creationTime"
>;

/** Rollup virtual: misma forma que el persistido + marca de depuración. */
export type VirtualDailyRollup = DailyRollupShape & { virtual: true };

/**
 * Fechas del rango `[desde, hasta]` (inclusive) que no están en `presentes`.
 * Devuelve `[]` si `desde > hasta` (p.ej. rango íntegramente en el futuro).
 */
export function missingDatesInRange(
  desde: string,
  hasta: string,
  presentes: ReadonlySet<string>,
): string[] {
  if (desde > hasta) return [];
  return rangeOfDates(desde, hasta).filter((f) => !presentes.has(f));
}

/**
 * Construye el rollup virtual de un día sin actividad para `(paciente,
 * clínica)`: `esperados` por plan según `expected`, `completados = 0`.
 *
 * `planIds` son los planes vigentes ese día en la clínica (puede haber
 * planes vigentes sin ejercicios ese día ⇒ entrada con `esperados = 0`,
 * igual que hace `upsertDailyForClinic`). Con `planIds` vacío el día es
 * `sin_plan` — el caller decide si lo emite (normalmente no).
 */
export function buildVirtualDailyRollup(input: {
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  fecha: string;
  planIds: Id<"plans">[];
  expected: ExpectedExerciseItem[];
  ahora: number;
}): VirtualDailyRollup {
  const esperadosPorPlan = new Map<Id<"plans">, number>();
  for (const planId of input.planIds) esperadosPorPlan.set(planId, 0);
  for (const e of input.expected) {
    esperadosPorPlan.set(e.planId, (esperadosPorPlan.get(e.planId) ?? 0) + 1);
  }

  const planAggregates = Array.from(esperadosPorPlan.entries()).map(
    ([planId, esperados]) => ({
      planId,
      esperados,
      completados: 0,
      extras: 0,
    }),
  );
  const totalEsperados = input.expected.length;

  return {
    pacienteId: input.pacienteId,
    clinicId: input.clinicId,
    fecha: input.fecha,
    planAggregates,
    totalEsperados,
    totalCompletados: 0,
    totalExtras: 0,
    estadoDia: computeEstadoDia(totalEsperados, 0, input.planIds.length > 0),
    sessionIds: [],
    actualizadoEn: input.ahora,
    virtual: true,
  };
}
