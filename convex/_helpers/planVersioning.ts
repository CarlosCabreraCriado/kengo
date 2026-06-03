import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

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
