/**
 * Reparación: cadenas de versiones de planes rotas (predecesor huérfano).
 *
 * Contexto: `plans.version` deja el plan viejo en `estado="modificado"` con
 * `planSucesor` apuntando a la versión nueva. Hasta el fix de 2026-09,
 * `plans.remove` no miraba `planAnterior`: al borrar (hard-delete) o
 * cancelar la versión nueva, el plan viejo quedaba `modificado` apuntando a
 * un sucesor inexistente o cancelado. Un plan `modificado` se oculta en
 * todos los listados y no puede editarse, borrarse ni cambiar de estado, así
 * que el paciente aparecía "sin planes" (caso real: paciente Iván,
 * plan `kx77a8t9mb0c15azscarcz640x8ak2j3`, versionado y borrado el
 * 2026-08-24).
 *
 * Estrategia (regla compartida en `_helpers/planChainRepair.ts`, la misma
 * que aplica ahora `plans.remove` y el paso nocturno `repairPlanChains`):
 *   - Si existe un "heredero" (plan del paciente cuyo `planAnterior` es el
 *     sucesor desaparecido) → se re-enlaza la cadena y el predecesor sigue
 *     `modificado`.
 *   - Si no → el predecesor se restaura: `planSucesor` fuera, `fechaFin` =
 *     `fechaFinPreVersion` si se registró (legacy: se conserva la truncada) y
 *     `estado` = `activo` si sigue vigente hoy (TZ del paciente) o
 *     `completado` si ya terminó.
 *   - Tras cada reparación: sync del aggregate de activos, recompute de hoy
 *     y recompute diferido de los días en que el sucesor estuvo vigente.
 *   - Cada plan reparado deja fila en `dataRepairAudit` (`planId`).
 *
 * Ejecución (desde la raíz; en self-hosted todo va contra PRODUCCIÓN):
 *   0. Backup: npx convex export --path ./backups/kengo-prod-pre-plan-chain-repair-<fecha>.zip
 *   1. Informe (solo lectura):
 *        npx convex run migrations/repairOrphanPlanVersions:report
 *   2. Dry-run (sin escrituras; es el modo por defecto):
 *        npx convex run migrations/repairOrphanPlanVersions:run
 *   3. Aplicar a UN plan concreto:
 *        npx convex run migrations/repairOrphanPlanVersions:run '{"apply":true,"planId":"kx7..."}'
 *   4. Aplicar a todos los rotos:
 *        npx convex run migrations/repairOrphanPlanVersions:run '{"apply":true}'
 *   5. Validar: `report` debe devolver `rotos: []`; revisar `dataRepairAudit`
 *      (`npx convex data dataRepairAudit --limit 5`) y drenar rollups stale:
 *        npx convex run rollups/internal:processStaleWeeklyRollups '{"batchSize":100}'
 *        npx convex run rollups/internal:processStaleMonthlyRollups '{"batchSize":100}'
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { internalMutation } from "../_helpers/mutationWithTriggers";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentDateInTz } from "../_helpers/datetime";
import { TzCache } from "../_helpers/patientTz";
import {
  afterPlanChainChange,
  classifyChain,
  computeRestoredPredecessorPatch,
  findHeir,
  MotivoCadenaRota,
  repairBrokenChain,
} from "../_helpers/planChainRepair";

export const MIGRACION = "repairOrphanPlanVersions/2026-09";

type Propuesta = {
  planId: Id<"plans">;
  titulo: string;
  version: number;
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  motivo: MotivoCadenaRota;
  accion: "restaurado" | "relinkeado";
  today: string;
  actual: { estado: string; fechaInicio?: string; fechaFin?: string; planSucesor?: Id<"plans"> };
  propuesto: Record<string, unknown>;
  /** fechaInicio del sucesor (si existe): desde ahí se recomputan rollups. */
  recomputeDesde?: string;
};

async function analyzeAll(
  ctx: QueryCtx | MutationCtx,
  soloPlanId?: Id<"plans">,
): Promise<{ modificados: number; rotos: Propuesta[] }> {
  const tzCache = new TzCache(ctx);
  const modificados: Doc<"plans">[] = soloPlanId
    ? [await ctx.db.get(soloPlanId)].filter((p): p is Doc<"plans"> => !!p)
    : await ctx.db
        .query("plans")
        .withIndex("by_estado", (q) => q.eq("estado", "modificado"))
        .collect();

  const rotos: Propuesta[] = [];
  for (const pred of modificados) {
    const sucesor = pred.planSucesor ? await ctx.db.get(pred.planSucesor) : null;
    const motivo = classifyChain(pred, sucesor);
    if (!motivo) continue;

    const today = getCurrentDateInTz(await tzCache.get(pred.pacienteId));
    const heir =
      motivo === "sucesor_inexistente" && pred.planSucesor
        ? await findHeir(ctx, pred.pacienteId, pred.planSucesor)
        : null;
    const propuesto = heir
      ? { planSucesor: heir._id, heredero: heir.titulo }
      : { ...computeRestoredPredecessorPatch(pred, today) };

    rotos.push({
      planId: pred._id,
      titulo: pred.titulo,
      version: pred.version,
      pacienteId: pred.pacienteId,
      clinicId: pred.clinicId,
      motivo,
      accion: heir ? "relinkeado" : "restaurado",
      today,
      actual: {
        estado: pred.estado,
        fechaInicio: pred.fechaInicio,
        fechaFin: pred.fechaFin,
        planSucesor: pred.planSucesor,
      },
      propuesto,
      recomputeDesde: sucesor?.fechaInicio ?? pred.fechaFin,
    });
  }
  return { modificados: modificados.length, rotos };
}

/** Informe de solo lectura: planes `modificado` con la cadena rota. */
export const report = internalQuery({
  args: { planId: v.optional(v.id("plans")) },
  handler: async (ctx, args) => {
    const { modificados, rotos } = await analyzeAll(ctx, args.planId);
    const porMotivo: Record<string, number> = {};
    for (const r of rotos) porMotivo[r.motivo] = (porMotivo[r.motivo] ?? 0) + 1;
    return { migracion: MIGRACION, modificados, rotos: rotos.length, porMotivo, detalles: rotos };
  },
});

/**
 * Repara. `apply` por defecto `false` (dry-run). `planId` acota a un plan.
 */
export const run = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    planId: v.optional(v.id("plans")),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const { modificados, rotos } = await analyzeAll(ctx, args.planId);

    const detalles: Array<Propuesta & { aplicado: boolean }> = [];
    for (const propuesta of rotos) {
      const pred = await ctx.db.get(propuesta.planId);
      if (!pred) continue;
      await repairBrokenChain(ctx, pred, {
        today: propuesta.today,
        motivo: propuesta.motivo,
        apply,
        migracion: MIGRACION,
      });
      if (apply) {
        await afterPlanChainChange(ctx, {
          pacienteId: pred.pacienteId,
          clinicId: pred.clinicId,
          today: propuesta.today,
          recomputeDesde: propuesta.recomputeDesde,
        });
      }
      detalles.push({ ...propuesta, aplicado: apply });
    }

    const resumen = {
      migracion: MIGRACION,
      modo: apply ? "apply" : "dry-run",
      modificados,
      rotos: rotos.length,
      reparados: apply ? detalles.length : 0,
    };
    console.log(`[repairOrphanPlanVersions] ${JSON.stringify(resumen)}`);
    return { ...resumen, detalles };
  },
});
