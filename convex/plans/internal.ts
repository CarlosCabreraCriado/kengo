import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import {
  addDaysToYMD,
  getCurrentDateInTz,
  rangeOfDates,
} from "../_helpers/datetime";
import { TzCache } from "../_helpers/patientTz";
import {
  afterPlanChainChange,
  classifyChain,
  repairBrokenChain,
} from "../_helpers/planChainRepair";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";
import { recomputeDayAndPropagateImpl } from "../rollups/internal";

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

// ─── RECOMPUTE DE RANGO DE DÍAS ───

/** Días recomputados por transacción; el resto se re-encola. */
const RECOMPUTE_RANGE_BATCH = 10;

/**
 * Recomputa los rollups diarios de un paciente en `[desde, hasta]` (ambos
 * inclusive) en lotes de `RECOMPUTE_RANGE_BATCH` días, encadenando el resto
 * con `scheduler.runAfter(0)`. `recomputeDayAndPropagateImpl` es idempotente
 * y marca `stale` los rollups semanal/mensual (el mantenimiento los drena).
 *
 * Lo encola `afterPlanChainChange` cuando se restaura una versión anterior
 * de un plan: los días en que la versión eliminada estuvo vigente se
 * calcularon con sus esperados y deben regenerarse.
 */
export const recomputePlanRange = internalMutation({
  args: {
    pacienteId: v.id("users"),
    desde: v.string(),
    hasta: v.string(),
  },
  handler: async (ctx, { pacienteId, desde, hasta }): Promise<void> => {
    if (desde > hasta) return;
    const fechas = rangeOfDates(desde, hasta).slice(0, RECOMPUTE_RANGE_BATCH);
    for (const fecha of fechas) {
      await recomputeDayAndPropagateImpl(ctx, pacienteId, fecha);
    }
    const ultima = fechas[fechas.length - 1];
    if (!ultima) return;
    const siguiente = addDaysToYMD(ultima, 1);
    if (siguiente <= hasta) {
      await ctx.scheduler.runAfter(
        0,
        internal.plans.internal.recomputePlanRange,
        { pacienteId, desde: siguiente, hasta },
      );
    }
  },
});

// ─── REPARACIÓN NOCTURNA DE CADENAS DE VERSIONES ───

/** Planes `modificado` revisados por lote (paso `repairPlanChains`). */
const REPAIR_BATCH = 100;

/**
 * Detecta y repara cadenas de versiones rotas: planes `modificado` cuyo
 * `planSucesor` falta, no existe o está `cancelado`. Sin reparación, el
 * plan viejo queda invisible e inmutable para siempre (ver
 * `_helpers/planChainRepair.ts`). `plans.remove` ya restaura en caliente;
 * este paso es la red de seguridad para borrados fuera de la app y datos
 * anteriores al fix.
 *
 * Mismo contrato de paginación que `expireOverduePlans`: devuelve `cursor`
 * mientras queden páginas. Loguea con `console.error` cuando repara algo
 * para que destaque en los logs de Convex.
 */
export const repairBrokenPlanChains = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ procesados: number; cursor?: string }> => {
    const tzCache = new TzCache(ctx);
    const page = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "modificado"))
      .paginate({ cursor: args.cursor ?? null, numItems: REPAIR_BATCH });

    const reparados: string[] = [];
    for (const pred of page.page) {
      const sucesor = pred.planSucesor
        ? await ctx.db.get(pred.planSucesor)
        : null;
      const motivo = classifyChain(pred, sucesor);
      if (!motivo) continue;

      const today = getCurrentDateInTz(await tzCache.get(pred.pacienteId));
      const out = await repairBrokenChain(ctx, pred, {
        today,
        motivo,
        apply: true,
        migracion: "repairPlanChains/cron",
      });
      await afterPlanChainChange(ctx, {
        pacienteId: pred.pacienteId,
        clinicId: pred.clinicId,
        today,
        recomputeDesde: sucesor?.fechaInicio ?? pred.fechaFin,
      });
      reparados.push(`${pred._id}:${motivo}:${out.accion}`);
    }

    if (reparados.length > 0) {
      console.error(
        `[repairPlanChains] ${reparados.length} cadenas rotas reparadas: ${reparados.join(", ")}`,
      );
    }
    return {
      procesados: reparados.length,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});
