/**
 * Migración (sub-fase 3b): particiona `weeklyPatientRollup` por clínica.
 *
 * Para cada weekly legacy (sin `clinicId`):
 *   1. Identificar qué clínicas tuvieron dailies particionados en esa
 *      semana (depende de `backfillDailyByClinic` ya ejecutado).
 *   2. Insertar un placeholder weekly con `clinicId` rellenado y `stale=true`
 *      por cada clínica con actividad. Si ya existe, marcarlo stale.
 *   3. Borrar el weekly legacy.
 *
 * El cron `processStaleWeeklyRollups` se encarga de recomputar los stale.
 *
 * Cómo ejecutar (después de `backfillDailyByClinic:run`):
 *   npx convex run migrations/backfillWeeklyByClinic:run
 */

import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { startOfISOWeek, endOfISOWeek } from "../_helpers/datetime";

interface Resultado {
  procesados: number;
  weeklyInsertados: number;
  weeklyLegacyBorrados: number;
  weeklyYaParticionadosMarcadosStale: number;
  paresSinActividad: number;
}

export const run = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Resultado> => {
    const limit = args.batchSize ?? 500;
    const legacy = await ctx.db
      .query("weeklyPatientRollup")
      .filter((q) => q.eq(q.field("clinicId"), undefined))
      .take(limit);

    let weeklyInsertados = 0;
    let weeklyLegacyBorrados = 0;
    let weeklyYaParticionadosMarcadosStale = 0;
    let paresSinActividad = 0;

    for (const w of legacy) {
      const desde = startOfISOWeek(w.anioSemana);
      const hasta = endOfISOWeek(w.anioSemana);
      const clinicIds = await getClinicIdsConDailyEnRango(
        ctx,
        w.pacienteId,
        desde,
        hasta,
      );

      if (clinicIds.length === 0) {
        // Sin dailies particionados en esa semana → el paciente no tuvo
        // actividad real allí. Borramos el weekly legacy directamente.
        await ctx.db.delete(w._id);
        weeklyLegacyBorrados += 1;
        paresSinActividad += 1;
        continue;
      }

      for (const cId of clinicIds) {
        const existing = await ctx.db
          .query("weeklyPatientRollup")
          .withIndex("by_pacienteId_clinicId_anioSemana", (q) =>
            q
              .eq("pacienteId", w.pacienteId)
              .eq("clinicId", cId)
              .eq("anioSemana", w.anioSemana),
          )
          .unique();
        if (existing) {
          if (!existing.stale) {
            await ctx.db.patch(existing._id, { stale: true });
          }
          weeklyYaParticionadosMarcadosStale += 1;
        } else {
          await ctx.db.insert("weeklyPatientRollup", {
            pacienteId: w.pacienteId,
            clinicId: cId,
            anioSemana: w.anioSemana,
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
          weeklyInsertados += 1;
        }
      }

      await ctx.db.delete(w._id);
      weeklyLegacyBorrados += 1;
    }

    console.log(
      `[backfillWeeklyByClinic] procesados=${legacy.length} ` +
        `insertados=${weeklyInsertados} ` +
        `marcadosStale=${weeklyYaParticionadosMarcadosStale} ` +
        `legacyBorrados=${weeklyLegacyBorrados} ` +
        `sinActividad=${paresSinActividad}`,
    );

    return {
      procesados: legacy.length,
      weeklyInsertados,
      weeklyLegacyBorrados,
      weeklyYaParticionadosMarcadosStale,
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
