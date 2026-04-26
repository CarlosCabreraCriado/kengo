import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { expireOverduePlansImpl } from "../plans/internal";
import { esPaciente } from "../_helpers/permissions";

type DiaSemana = "L" | "M" | "X" | "J" | "V" | "S" | "D";
const DIAS_SEMANA: DiaSemana[] = ["D", "L", "M", "X", "J", "V", "S"];

function getFechaMadridOffset(offsetDays: number): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().split("T")[0];
}

function getDiaSemana(fecha: string): DiaSemana {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return DIAS_SEMANA[date.getUTCDay()];
}

export function getHoyMadrid(): string {
  return getFechaMadridOffset(0);
}

async function getRelevantPlans(
  ctx: MutationCtx,
  target: string,
  pacienteId?: Id<"users">,
): Promise<Doc<"plans">[]> {
  if (pacienteId) {
    const [activos, completados] = await Promise.all([
      ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", pacienteId).eq("estado", "activo"),
        )
        .collect(),
      ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", pacienteId).eq("estado", "completado"),
        )
        .collect(),
    ]);
    return [...activos, ...completados].filter((p) => isPlanVigente(p, target));
  }

  const [activos, completados] = await Promise.all([
    ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect(),
    ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "completado"))
      .collect(),
  ]);
  return [...activos, ...completados].filter((p) => isPlanVigente(p, target));
}

function isPlanVigente(plan: Doc<"plans">, target: string): boolean {
  if (plan.fechaInicio && plan.fechaInicio > target) return false;
  if (plan.fechaFin && plan.fechaFin < target) return false;
  return true;
}

async function processCompliance(
  ctx: MutationCtx,
  plan: Doc<"plans">,
  target: string,
  diaSemana: DiaSemana,
): Promise<void> {
  const items = await ctx.db
    .query("planExercises")
    .withIndex("by_planId", (q) => q.eq("planId", plan._id))
    .collect();

  const itemsHoy = items.filter((item) => {
    if (!item.diasSemana || item.diasSemana.length === 0) return true;
    return item.diasSemana.includes(diaSemana);
  });

  const esDiaDescanso = itemsHoy.length === 0;
  const ejerciciosEsperados = itemsHoy.length;

  const registros = await ctx.db
    .query("planRecords")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", plan.pacienteId).eq("fecha", target),
    )
    .collect();

  const porItem = new Map<
    Id<"planExercises">,
    { completados: number; dolores: number[] }
  >();
  for (const r of registros) {
    if (!r.completado) continue;
    const curr = porItem.get(r.planExerciseId) ?? {
      completados: 0,
      dolores: [],
    };
    curr.completados += 1;
    if (r.dolorEscala !== undefined && r.dolorEscala !== null) {
      curr.dolores.push(r.dolorEscala);
    }
    porItem.set(r.planExerciseId, curr);
  }

  let ejerciciosCompletados = 0;
  for (const item of itemsHoy) {
    const reg = porItem.get(item._id);
    const vecesDia = item.vecesDia ?? 1;
    if (reg && reg.completados >= vecesDia) {
      ejerciciosCompletados += 1;
    }
  }

  let dolorTotal = 0;
  let dolorCount = 0;
  for (const item of items) {
    const data = porItem.get(item._id);
    if (!data || data.dolores.length === 0) continue;
    const avg = data.dolores.reduce((a, b) => a + b, 0) / data.dolores.length;
    dolorTotal += avg;
    dolorCount += 1;
  }
  const dolorPromedio = dolorCount > 0 ? dolorTotal / dolorCount : undefined;

  const existing = await ctx.db
    .query("dailyCompliance")
    .withIndex("by_pacienteId_planId_fecha", (q) =>
      q
        .eq("pacienteId", plan.pacienteId)
        .eq("planId", plan._id)
        .eq("fecha", target),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      ejerciciosEsperados,
      ejerciciosCompletados,
      esDiaDescanso,
      dolorPromedio,
    });
  } else {
    await ctx.db.insert("dailyCompliance", {
      fecha: target,
      pacienteId: plan.pacienteId,
      planId: plan._id,
      ejerciciosEsperados,
      ejerciciosCompletados,
      esDiaDescanso,
      dolorPromedio,
    });
  }
}

export const calculateDailyCompliance = internalMutation({
  args: {
    fecha: v.optional(v.string()),
    pacienteId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const target = args.fecha ?? getFechaMadridOffset(-1);
    const diaSemana = getDiaSemana(target);
    const plans = await getRelevantPlans(ctx, target, args.pacienteId);

    if (plans.length === 0) {
      console.log(`[compliance] ${target} (${diaSemana}): sin planes activos`);
      return 0;
    }

    let procesadas = 0;
    for (const plan of plans) {
      await processCompliance(ctx, plan, target, diaSemana);
      procesadas += 1;
    }

    console.log(
      `[compliance] ${target} (${diaSemana}): ${procesadas} fila(s) procesadas`,
    );
    return procesadas;
  },
});

async function recalculateClinicMetrics(ctx: MutationCtx): Promise<number> {
  const today = getFechaMadridOffset(0);
  const fechaDesde = getFechaMadridOffset(-30);

  const clinics = await ctx.db.query("clinics").collect();
  let updated = 0;

  for (const clinic of clinics) {
    // Pacientes de la clínica
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
      .collect();
    const pacienteIds = new Set(
      memberships.filter((m) => esPaciente(m.puesto)).map((m) => m.userId),
    );

    // Pacientes activos: con plan activo
    let pacientesActivos = 0;
    let sumEsperados = 0;
    let sumCompletados = 0;

    for (const pid of pacienteIds) {
      const planesActivos = await ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", pid).eq("estado", "activo"),
        )
        .first();
      if (planesActivos) pacientesActivos += 1;

      const cumplimientos = await ctx.db
        .query("dailyCompliance")
        .withIndex("by_pacienteId_fecha", (q) =>
          q.eq("pacienteId", pid).gte("fecha", fechaDesde),
        )
        .collect();
      for (const c of cumplimientos) {
        if (c.esDiaDescanso) continue;
        sumEsperados += c.ejerciciosEsperados;
        sumCompletados += c.ejerciciosCompletados;
      }
    }

    const adherenciaPromedio =
      sumEsperados > 0
        ? Math.round((sumCompletados / sumEsperados) * 100)
        : 0;

    const existing = await ctx.db
      .query("clinicMetrics")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pacientesActivos,
        adherenciaPromedio,
        actualizadoEn: today,
      });
    } else {
      await ctx.db.insert("clinicMetrics", {
        clinicId: clinic._id,
        pacientesActivos,
        adherenciaPromedio,
        actualizadoEn: today,
      });
    }
    updated += 1;
  }

  return updated;
}

/**
 * Mantenimiento diario consolidado: expira planes vencidos, recalcula
 * el cumplimiento del día anterior, y actualiza las métricas por clínica.
 * Único punto de entrada del cron diario.
 */
export const dailyMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await expireOverduePlansImpl(ctx);

    const target = getFechaMadridOffset(-1);
    const diaSemana = getDiaSemana(target);
    const plans = await getRelevantPlans(ctx, target);

    let procesadas = 0;
    for (const plan of plans) {
      await processCompliance(ctx, plan, target, diaSemana);
      procesadas += 1;
    }

    const clinicasActualizadas = await recalculateClinicMetrics(ctx);

    console.log(
      `[maintenance] expirados=${expired} compliance=${procesadas} clinicas=${clinicasActualizadas} (${target} ${diaSemana})`,
    );
    return {
      expired,
      compliance: procesadas,
      clinics: clinicasActualizadas,
    };
  },
});
