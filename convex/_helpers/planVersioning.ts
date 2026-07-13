import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { addDaysToYMD } from "./datetime";

type Ctx = QueryCtx | MutationCtx;

export interface VersionDates {
  /** fechaInicio del plan nuevo. */
  nuevoInicio: string;
  /** fechaFin con la que queda el plan viejo (vigente hasta ayer). */
  oldFechaFin: string;
}

/**
 * Fechas efectivas al versionar un plan: la NUEVA versión rige desde hoy
 * (nunca retroactiva) y el plan viejo conserva su vigencia hasta el día
 * anterior. Así los días pasados se siguen evaluando contra la versión que
 * estaba vigente entonces — versionar no reescribe la historia.
 *
 * Reglas:
 * - `nuevoInicio` = fecha solicitada, con suelo en `today` (clamp
 *   anti-retroactivo: defiende de clientes antiguos que reenvían la
 *   fechaInicio original del plan).
 * - Plan viejo aún no empezado (`fechaInicio > hoy`): la nueva versión hereda
 *   ese inicio futuro (no existe historia que preservar).
 * - `oldFechaFin` = min(fechaFin actual, nuevoInicio - 1), sin invertir el
 *   intervalo del plan viejo (piso en su fechaInicio). En el caso degenerado
 *   de versionar el mismo día del inicio, ambas versiones comparten ese día
 *   y `dropSupersededVersions` descarta la vieja al contar.
 *
 * Función pura — testeable en `planVersioning.test.ts`.
 */
export function computeVersionDates(
  oldPlan: { fechaInicio?: string; fechaFin?: string },
  fechaInicioSolicitada: string | undefined,
  today: string,
): VersionDates {
  let nuevoInicio = fechaInicioSolicitada ?? today;
  if (nuevoInicio < today) nuevoInicio = today;
  if (oldPlan.fechaInicio && oldPlan.fechaInicio > nuevoInicio) {
    nuevoInicio = oldPlan.fechaInicio;
  }

  const fechaFinActual = oldPlan.fechaFin ?? today;
  const sinSolape = addDaysToYMD(nuevoInicio, -1);
  let oldFechaFin = fechaFinActual < sinSolape ? fechaFinActual : sinSolape;
  if (oldPlan.fechaInicio && oldFechaFin < oldPlan.fechaInicio) {
    oldFechaFin = oldPlan.fechaInicio;
  }
  return { nuevoInicio, oldFechaFin };
}

const MAX_SUCESOR_HOPS = 10;

/**
 * Resuelve el `planId` canónico siguiendo la cadena `plan.planSucesor` hasta
 * llegar al último plan de la versión.
 *
 * Un plan versionado (vía `plans.mutations.version`) queda con
 * `estado="modificado"` y `planSucesor` apuntando al plan nuevo. Las
 * `exerciseExecutions` creadas antes del versionado conservan el `planId`
 * antiguo (campo inmutable), mientras que los `planExercises` esperados ya
 * viven en el plan sucesor. Para que los agregados por plan en
 * `dailyPatientRollup.planAggregates` casen ejecutadas con esperadas, hay
 * que colapsar las executions antiguas al id del último plan.
 *
 * Guard anti-ciclos: se detiene a los 10 saltos y devuelve el id actual,
 * loggeando un warning. En la práctica una cadena de versiones no debería
 * superar 2-3 niveles.
 *
 * Cache opcional (`cache`) para evitar lecturas repetidas dentro de la misma
 * mutation. Pasar siempre el mismo Map si se procesan muchas executions.
 *
 * Usado por:
 *   - `rollups/internal.upsertDailyForClinic` (agrupación por plan vigente).
 */
export async function resolveCanonicalPlanId(
  ctx: Ctx,
  planId: Id<"plans">,
  cache?: Map<Id<"plans">, Id<"plans">>,
): Promise<Id<"plans">> {
  if (cache?.has(planId)) return cache.get(planId)!;

  const visited = new Set<Id<"plans">>();
  let current: Id<"plans"> = planId;
  for (let i = 0; i < MAX_SUCESOR_HOPS; i++) {
    if (visited.has(current)) {
      console.warn(
        `[resolveCanonicalPlanId] ciclo detectado en cadena planSucesor desde ${planId} en ${current}`,
      );
      break;
    }
    visited.add(current);
    const plan: Doc<"plans"> | null = await ctx.db.get(current);
    if (!plan || !plan.planSucesor) break;
    current = plan.planSucesor;
  }

  if (cache) cache.set(planId, current);
  return current;
}
