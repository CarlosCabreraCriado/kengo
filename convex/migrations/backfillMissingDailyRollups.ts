/**
 * Backfill one-shot de `dailyPatientRollup` para los días con plan vigente
 * que nunca produjeron rollup (porque el paciente no abrió sesión y, hasta
 * el fix del Bug 2, ningún cron los materializaba).
 *
 * Para cada plan no cancelado/borrador, calcula el rango
 *   [max(plan.fechaInicio, hoy-90), min(plan.fechaFin ?? hoy-1, hoy-1)]
 * (cap 90 días para acotar coste) y, para cada fecha sin rollup en
 * `(pacienteId, clinicId, fecha)`, invoca `recomputeDayAndPropagateImpl`.
 *
 * Idempotente: `recomputeDayAndPropagateImpl` hace upsert. Pacientes con
 * varios planes en la misma clínica disparan recompute repetidos (coste
 * aceptable para una migración one-shot).
 *
 * Cómo ejecutar (después del deploy del fix Bug 2):
 *   npx convex run migrations:run \
 *     '{"fn":"migrations/backfillMissingDailyRollups:backfill"}'
 *
 * Cron `daily-materialize-missing-rollups` mantiene la métrica al día desde
 * ese momento (sólo rellena el día anterior). Esta migración corrige el
 * estado histórico de las ventanas 7d/15d/30d que se consumen en
 * `patientMetricsSnapshot`.
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { getMadridDateOffset } from "../_helpers/datetime";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

const migrations = new Migrations<DataModel>(components.migrations);

const MAX_DIAS_POR_PLAN = 90;

export const backfill = migrations.define({
  table: "plans",
  migrateOne: async (ctx, plan) => {
    if (plan.estado === "borrador" || plan.estado === "cancelado") return;
    if (!plan.clinicId) return;

    const ayer = getMadridDateOffset(-1);
    const limiteInferior = getMadridDateOffset(-MAX_DIAS_POR_PLAN);

    const desde =
      plan.fechaInicio && plan.fechaInicio > limiteInferior
        ? plan.fechaInicio
        : limiteInferior;
    const fechaFinPlan = plan.fechaFin ?? ayer;
    const hasta = fechaFinPlan < ayer ? fechaFinPlan : ayer;
    if (desde > hasta) return;

    for (const fecha of enumerateDates(desde, hasta)) {
      const existing = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_clinicId_fecha", (q) =>
          q
            .eq("pacienteId", plan.pacienteId)
            .eq("clinicId", plan.clinicId!)
            .eq("fecha", fecha),
        )
        .unique();
      if (existing) continue;
      await recomputeDayAndPropagateImpl(ctx, plan.pacienteId, fecha);
    }
  },
});

export const run = migrations.runner();

function enumerateDates(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const [y0, m0, d0] = desde.split("-").map(Number);
  const [y1, m1, d1] = hasta.split("-").map(Number);
  const start = Date.UTC(y0, m0 - 1, d0);
  const end = Date.UTC(y1, m1 - 1, d1);
  for (let t = start; t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
