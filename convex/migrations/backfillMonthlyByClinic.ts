/**
 * Migración (sub-fase 3b): particiona `monthlyPatientRollup` por clínica.
 * Mismo patrón que `backfillWeeklyByClinic` pero sobre meses.
 *
 * Cómo ejecutar (después de `backfillDailyByClinic:run`):
 *   npx convex run migrations/backfillMonthlyByClinic:run
 */

import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { startOfMonth, endOfMonth } from "../_helpers/datetime";

interface Resultado {
  procesados: number;
  monthlyInsertados: number;
  monthlyLegacyBorrados: number;
  monthlyYaParticionadosMarcadosStale: number;
  paresSinActividad: number;
}

export const run = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Resultado> => {
    const limit = args.batchSize ?? 500;
    const legacy = await ctx.db
      .query("monthlyPatientRollup")
      .filter((q) => q.eq(q.field("clinicId"), undefined))
      .take(limit);

    let monthlyInsertados = 0;
    let monthlyLegacyBorrados = 0;
    let monthlyYaParticionadosMarcadosStale = 0;
    let paresSinActividad = 0;

    for (const m of legacy) {
      const desde = startOfMonth(m.anioMes);
      const hasta = endOfMonth(m.anioMes);
      const clinicIds = await getClinicIdsConDailyEnRango(
        ctx,
        m.pacienteId,
        desde,
        hasta,
      );

      if (clinicIds.length === 0) {
        await ctx.db.delete(m._id);
        monthlyLegacyBorrados += 1;
        paresSinActividad += 1;
        continue;
      }

      for (const cId of clinicIds) {
        const existing = await ctx.db
          .query("monthlyPatientRollup")
          .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
            q
              .eq("pacienteId", m.pacienteId)
              .eq("clinicId", cId)
              .eq("anioMes", m.anioMes),
          )
          .unique();
        if (existing) {
          if (!existing.stale) {
            await ctx.db.patch(existing._id, { stale: true });
          }
          monthlyYaParticionadosMarcadosStale += 1;
        } else {
          await ctx.db.insert("monthlyPatientRollup", {
            pacienteId: m.pacienteId,
            clinicId: cId,
            anioMes: m.anioMes,
            diasCompletados: 0,
            diasParciales: 0,
            diasFallidos: 0,
            diasDescanso: 0,
            adherencia: 0,
            rachaMaxima: 0,
            sesionesCount: 0,
            actualizadoEn: 0,
            stale: true,
          });
          monthlyInsertados += 1;
        }
      }

      await ctx.db.delete(m._id);
      monthlyLegacyBorrados += 1;
    }

    console.log(
      `[backfillMonthlyByClinic] procesados=${legacy.length} ` +
        `insertados=${monthlyInsertados} ` +
        `marcadosStale=${monthlyYaParticionadosMarcadosStale} ` +
        `legacyBorrados=${monthlyLegacyBorrados} ` +
        `sinActividad=${paresSinActividad}`,
    );

    return {
      procesados: legacy.length,
      monthlyInsertados,
      monthlyLegacyBorrados,
      monthlyYaParticionadosMarcadosStale,
      paresSinActividad,
    };
  },
});

async function getClinicIdsConDailyEnRango(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  desde: string,
  hasta: string,
): Promise<Id<"clinics">[]> {
  const dailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
    )
    .collect();
  const set = new Set<Id<"clinics">>();
  for (const d of dailies) {
    if (d.clinicId) set.add(d.clinicId);
  }
  return [...set];
}
