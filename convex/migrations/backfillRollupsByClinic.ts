/**
 * Orquestador del backfill de rollups por clínica (sub-fase 3b).
 *
 * Encadena las tres migraciones en orden:
 *   1. `backfillDailyByClinic:run`  — particiona dailies legacy.
 *   2. `backfillWeeklyByClinic:run` — marca/inserta weekly por clínica con
 *      `stale=true`.
 *   3. `backfillMonthlyByClinic:run` — idem monthly.
 *
 * Tras este orquestador, el cron `daily-maintenance` (que invoca
 * `processStaleWeeklyRollups` y `processStaleMonthlyRollups`) recomputa los
 * placeholders. Para forzar el recompute inmediato se puede ejecutar los
 * procesadores directamente.
 *
 * Idempotente: se puede ejecutar varias veces. Si la BD es grande, el
 * `batchSize` (default 500) puede requerir múltiples ejecuciones — el daily
 * informa `procesados` y `pendientes` para iterar hasta 0.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillRollupsByClinic:runAll
 *   npx convex run migrations/backfillRollupsByClinic:runAll --prod
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const runAll = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize;

    const daily: any = await ctx.runMutation(
      internal.migrations.backfillDailyByClinic.run,
      batchSize ? { batchSize } : {},
    );
    const weekly: any = await ctx.runMutation(
      internal.migrations.backfillWeeklyByClinic.run,
      batchSize ? { batchSize } : {},
    );
    const monthly: any = await ctx.runMutation(
      internal.migrations.backfillMonthlyByClinic.run,
      batchSize ? { batchSize } : {},
    );

    const summary = { daily, weekly, monthly };
    console.log(
      "[backfillRollupsByClinic] summary=" + JSON.stringify(summary, null, 2),
    );
    return summary;
  },
});
