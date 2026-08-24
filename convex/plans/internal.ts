import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import { getCurrentDateInTz } from "../_helpers/datetime";
import { TzCache } from "../_helpers/patientTz";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

/** Planes activos revisados por lote (paso `expirePlans` del mantenimiento). */
const EXPIRE_BATCH = 100;

/**
 * Expira (marca `completado`) los planes activos cuyo último día ya pasó
 * PARA SU PACIENTE (su TZ): el criterio anterior (día UTC) podía cerrar el
 * último día del plan antes de tiempo para TZs al oeste.
 *
 * Pagina sobre `by_estado` = activo en lotes de `EXPIRE_BATCH`: devuelve
 * `cursor` mientras queden páginas para que el orquestador del
 * mantenimiento lo reinvoque en una transacción nueva.
 */
export async function expireOverduePlansImpl(
  ctx: MutationCtx,
  cursor?: string,
): Promise<{ updated: number; procesados: number; cursor?: string }> {
  const tzCache = new TzCache(ctx);

  const page = await ctx.db
    .query("plans")
    .withIndex("by_estado", (q) => q.eq("estado", "activo"))
    .paginate({ cursor: cursor ?? null, numItems: EXPIRE_BATCH });

  let updated = 0;
  for (const plan of page.page) {
    const today = getCurrentDateInTz(await tzCache.get(plan.pacienteId));
    if (plan.fechaFin && plan.fechaFin < today) {
      await ctx.db.patch(plan._id, { estado: "completado" });
      if (plan.clinicId) {
        await _syncPatientActiveStateInClinic(
          ctx,
          plan.pacienteId,
          plan.clinicId,
        );
      }
      updated++;
    }
  }

  return {
    updated,
    procesados: page.page.length,
    cursor: page.isDone ? undefined : page.continueCursor,
  };
}

export const expireOverduePlans = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ procesados: number; cursor?: string }> => {
    const res = await expireOverduePlansImpl(ctx, args.cursor);
    console.log(
      `expireOverduePlans: ${res.updated} planes marcados como completados (revisados ${res.procesados})`,
    );
    return { procesados: res.updated, cursor: res.cursor };
  },
});
