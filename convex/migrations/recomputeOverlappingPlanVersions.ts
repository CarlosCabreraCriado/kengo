/**
 * Migración one-shot: repara los `dailyPatientRollup` que quedaron con barras de
 * progreso duplicadas por planes versionados.
 *
 * Contexto del bug: antes del fix en `getActivePlansForPatientOnDate`
 * (`dropSupersededVersions`), cuando un plan se versionaba (`plans.version`) el
 * plan viejo (`modificado`) y el nuevo (`activo`) podían quedar vigentes el mismo
 * día. Los rollups de esos días contienen una entrada fantasma en
 * `planAggregates` para el plan histórico (`esperados>0, completados=0`) y un
 * `totalEsperados` inflado. El frontend (`/mis-pacientes/:id`, timeline de
 * actividad) renderiza una barra extra por cada uno.
 *
 * Estrategia: para cada plan viejo versionado (tiene `planSucesor`), recomputar
 * SOLO la ventana de solape con su sucesor:
 *   desde = max(sucesor.fechaInicio, hoy-90)
 *   hasta = min(plan.fechaFin ?? hoy, hoy)
 * y, para cada fecha del rango, invocar `recomputeDayAndPropagateImpl`
 * INCONDICIONALMENTE (idempotente: hace upsert). Con el helper ya corregido, el
 * plan supersedido deja de contar y la barra fantasma desaparece.
 *
 * IMPORTANTE: no se recomputan los días previos al versionado (solo el plan
 * viejo estaba vigente). En esos días `resolveCanonicalPlanId` colapsaría sus
 * executions al plan nuevo y atribuiría `completados=0` a la barra del viejo
 * (regresión). Acotando a la ventana de solape se evita ese caso.
 *
 * El recompute marca weekly/monthly como `stale`; los procesa el cron existente.
 *
 * Cómo ejecutar (después del deploy del fix):
 *   npx convex run migrations/recomputeOverlappingPlanVersions:run \
 *     '{"fn":"migrations/recomputeOverlappingPlanVersions:backfill"}'
 *   # en producción añadir --prod
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { addDaysToYMD, getMadridDateOffset } from "../_helpers/datetime";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

const migrations = new Migrations<DataModel>(components.migrations);

const MAX_DIAS = 90;

export const backfill = migrations.define({
  table: "plans",
  migrateOne: async (ctx, plan) => {
    // Solo planes viejos versionados (apuntan a un sucesor).
    if (!plan.planSucesor) return;

    const sucesor = await ctx.db.get(plan.planSucesor);
    if (!sucesor) return;

    const hoy = getMadridDateOffset(0);
    const limiteInferior = getMadridDateOffset(-MAX_DIAS);

    // El solape empieza cuando el sucesor pasa a ser vigente.
    const inicioSolape = sucesor.fechaInicio ?? hoy;
    const desde = inicioSolape > limiteInferior ? inicioSolape : limiteInferior;

    // El solape termina cuando el plan viejo deja de ser vigente.
    const finViejo = plan.fechaFin ?? hoy;
    const hasta = finViejo < hoy ? finViejo : hoy;

    if (desde > hasta) return; // sin solape real → nada que reparar

    for (let f = desde; f <= hasta; f = addDaysToYMD(f, 1)) {
      await recomputeDayAndPropagateImpl(ctx, plan.pacienteId, f);
    }
  },
});

export const run = migrations.runner();
