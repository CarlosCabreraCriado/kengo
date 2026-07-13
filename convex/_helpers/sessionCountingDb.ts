/**
 * Wrapper con acceso a BD del conteo canónico por identidad
 * (`sessionCounting.ts`): carga el conjunto esperado del día, enriquece las
 * ejecuciones con `exerciseId`/`canonicalPlanId` y ejecuta
 * `computeDayCounts`.
 *
 * Compartido por sessions/internal, rollups/internal, sessions/queries y la
 * migración de reparación. `sessionCounting.ts` queda puro y testeable.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { batchGetMap } from "./batchGet";
import { getDiaSemana } from "./datetime";
import {
  ExpectedExerciseItem,
  getExpectedExercisesForPatientOnDate,
} from "./expectedExercises";
import { resolveCanonicalPlanId } from "./planVersioning";
import {
  computeDayCounts,
  DayCounts,
  ExecutionForCount,
  ExpectedSlot,
} from "./sessionCounting";

type Ctx = QueryCtx | MutationCtx;

export interface DayCountsResult {
  counts: DayCounts;
  /** Esperados del día (con exerciseId), por si el caller los reutiliza. */
  expected: ExpectedExerciseItem[];
  /** planExercises referenciados por las ejecuciones (para enriquecer UI). */
  planExercisesById: Map<Id<"planExercises">, Doc<"planExercises">>;
}

/**
 * Convierte las ejecuciones crudas en `ExecutionForCount` resolviendo
 * `exerciseId` (vía planExercise; undefined si fue borrado) y
 * `canonicalPlanId` (cadena de versiones).
 */
export async function enrichExecutionsForCount(
  ctx: Ctx,
  executions: Doc<"exerciseExecutions">[],
  canonicalCache: Map<Id<"plans">, Id<"plans">> = new Map(),
): Promise<{
  enriched: ExecutionForCount[];
  planExercisesById: Map<Id<"planExercises">, Doc<"planExercises">>;
}> {
  const planExercisesById = await batchGetMap(
    ctx,
    executions.map((e) => e.planExerciseId),
  );
  const enriched: ExecutionForCount[] = [];
  for (const e of executions) {
    enriched.push({
      executionId: e._id,
      planExerciseId: e.planExerciseId,
      planId: e.planId,
      completado: e.completado,
      fechaHora: e.fechaHora,
      exerciseId: planExercisesById.get(e.planExerciseId)?.exerciseId,
      canonicalPlanId: await resolveCanonicalPlanId(
        ctx,
        e.planId,
        canonicalCache,
      ),
      dolorEscala: e.dolorEscala,
      esfuerzoEscala: e.esfuerzoEscala,
      duracionRealSeg: e.duracionRealSeg,
      repeticionesRealizadas: e.repeticionesRealizadas,
      notaPaciente: e.notaPaciente,
    });
  }
  return { enriched, planExercisesById };
}

/**
 * Conteo canónico del día para un (paciente, fecha, clínica) dado el listado
 * de ejecuciones ya cargado por el caller (normalmente por índice
 * `by_sessionId` o `by_pacienteId_fecha`, filtrado por clínica).
 */
export async function computeDayCountsForPatient(
  ctx: Ctx,
  args: {
    pacienteId: Id<"users">;
    fecha: string;
    clinicId?: Id<"clinics">;
    executions: Doc<"exerciseExecutions">[];
  },
): Promise<DayCountsResult> {
  const canonicalCache = new Map<Id<"plans">, Id<"plans">>();

  const expectedItems = await getExpectedExercisesForPatientOnDate(
    ctx,
    args.pacienteId,
    args.fecha,
    getDiaSemana(args.fecha),
    args.clinicId,
  );
  const expected: ExpectedSlot[] = [];
  for (const it of expectedItems) {
    expected.push({
      ...it,
      canonicalPlanId: await resolveCanonicalPlanId(
        ctx,
        it.planId,
        canonicalCache,
      ),
    });
  }

  const { enriched, planExercisesById } = await enrichExecutionsForCount(
    ctx,
    args.executions,
    canonicalCache,
  );

  return {
    counts: computeDayCounts(expected, enriched),
    expected: expectedItems,
    planExercisesById,
  };
}
