import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

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

export const calculateDailyCompliance = internalMutation({
  args: {
    fecha: v.optional(v.string()),
    pacienteId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const target = args.fecha ?? getFechaMadridOffset(-1);
    const diaSemana = getDiaSemana(target);

    const activos = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const completados = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "completado"))
      .collect();

    let plans = [...activos, ...completados].filter((p) => {
      if (p.fechaInicio && p.fechaInicio > target) return false;
      if (p.fechaFin && p.fechaFin < target) return false;
      return true;
    });

    if (args.pacienteId) {
      plans = plans.filter((p) => p.pacienteId === args.pacienteId);
    }

    if (plans.length === 0) {
      console.log(`[compliance] ${target} (${diaSemana}): sin planes activos`);
      return 0;
    }

    let procesadas = 0;

    for (const plan of plans) {
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
        const avg =
          data.dolores.reduce((a, b) => a + b, 0) / data.dolores.length;
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

      procesadas += 1;
    }

    console.log(
      `[compliance] ${target} (${diaSemana}): ${procesadas} fila(s) procesadas`,
    );
    return procesadas;
  },
});

export function getHoyMadrid(): string {
  return getFechaMadridOffset(0);
}
