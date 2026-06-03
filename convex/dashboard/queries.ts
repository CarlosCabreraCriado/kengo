/**
 * Queries del dashboard del fisio.
 *
 * Tras Fase 5 (drop legacy), `fisioSummary` y `patientMetrics` se eliminaron
 * — el frontend lee de `snapshots.queries.getClinicMetrics` y
 * `snapshots.queries.getPatientMetrics`. Aquí solo permanece
 * `planesPorVencer` porque opera sobre la tabla `plans` (no afectada por
 * el rediseño).
 */

import { v } from "convex/values";
import { query, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser, tieneGestion } from "../_helpers/permissions";
import { assertFisioInClinic } from "../_helpers/patientAccess";
import {
  DiaSemana,
  getCurrentMadridDate,
  getDiaSemana,
  getMadridDateOffset,
  rangeOfDates,
} from "../_helpers/datetime";
import { sessionsByClinic } from "../aggregates/sessionsByClinic";

function fechaHoy(): string {
  return new Date().toISOString().split("T")[0];
}

function fechaDentroDe(days: number): string {
  return new Date(Date.now() + days * 86400000)
    .toISOString()
    .split("T")[0];
}

async function getFisioIdsEnClinicasDelUsuario(
  ctx: Parameters<typeof query>[0] extends never ? never : any,
  userId: Id<"users">,
): Promise<Set<Id<"users">>> {
  const misMemberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  const clinicIdsGestion = misMemberships
    .filter((m: any) => tieneGestion(m.puesto))
    .map((m: any) => m.clinicId as Id<"clinics">);

  const fisioIds = new Set<Id<"users">>();
  for (const clinicId of clinicIdsGestion) {
    const members = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q: any) => q.eq("clinicId", clinicId))
      .collect();
    for (const m of members) {
      if (tieneGestion(m.puesto)) {
        fisioIds.add(m.userId as Id<"users">);
      }
    }
  }

  return fisioIds;
}

/**
 * Planes activos del fisio actual (de las clínicas que gestiona) cuya
 * `fechaFin` cae entre hoy y hoy + 7 días. Devuelve top 10 ordenados por
 * fechaFin ascendente.
 */
export const planesPorVencer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const fisioIds = await getFisioIdsEnClinicasDelUsuario(ctx, user._id);
    if (fisioIds.size === 0) return [];

    const hoy = fechaHoy();
    const limite = fechaDentroDe(7);
    const planesPorVencer: Array<{
      id: string;
      titulo: string;
      fechaFin: string;
      pacienteNombre: string;
      pacienteId: string;
    }> = [];

    for (const fisioId of fisioIds) {
      const planes = await ctx.db
        .query("plans")
        .withIndex("by_fisioId_estado", (q) =>
          q.eq("fisioId", fisioId).eq("estado", "activo"),
        )
        .collect();
      for (const plan of planes) {
        if (!plan.fechaFin) continue;
        if (plan.fechaFin >= hoy && plan.fechaFin <= limite) {
          const paciente = await ctx.db.get(plan.pacienteId);
          const nombre = paciente
            ? `${paciente.firstName} ${paciente.lastName}`.trim()
            : "";
          planesPorVencer.push({
            id: plan._id,
            titulo: plan.titulo,
            fechaFin: plan.fechaFin,
            pacienteNombre: nombre,
            pacienteId: plan.pacienteId,
          });
        }
      }
    }
    planesPorVencer.sort((a, b) => a.fechaFin.localeCompare(b.fechaFin));
    return planesPorVencer.slice(0, 10);
  },
});

type ActividadDia = {
  fecha: string;
  label: DiaSemana;
  sesiones: number;
  today: boolean;
};

export type ActividadDiariaClinica = {
  days: ActividadDia[];
  deltaPct: number | null;
  totalActual: number;
  totalAnterior: number;
};

/**
 * Sesiones reales (no sintéticas) por fecha vía `sessionsByClinic.sumBatch`.
 *
 * El aggregate tiene `sumValue = esSintetica ? 0 : 1`, así que `sum()` por
 * cada fecha equivale al filtro legacy `if (s.esSintetica === true) continue`.
 * Una sola RPC al componente con N entries — O(log n) por día.
 */
async function loadActividadDiaria_aggregate(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
  fechas: string[],
): Promise<Map<string, number>> {
  const queries = fechas.map((fecha) => ({
    namespace: clinicId,
    bounds: { eq: fecha },
  }));
  const sums = await sessionsByClinic.sumBatch(ctx, queries);
  return new Map(fechas.map((fecha, i) => [fecha, sums[i]]));
}

/**
 * Sesiones reales (no sintéticas) por día en la clínica para los últimos 10
 * días, junto al total de los 10 días previos para calcular un delta. La
 * normalización 0-1 y el copy del delta se componen en el cliente.
 */
export const getActividadDiariaClinica = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args): Promise<ActividadDiariaClinica> => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    const hoy = getCurrentMadridDate();
    const inicioActual = getMadridDateOffset(-9);
    const finPrevia = getMadridDateOffset(-10);
    const inicioPrevia = getMadridDateOffset(-19);

    const fechasActual = rangeOfDates(inicioActual, hoy);
    const fechasPrevia = rangeOfDates(inicioPrevia, finPrevia);
    const counts = await loadActividadDiaria_aggregate(
      ctx,
      args.clinicId,
      [...fechasActual, ...fechasPrevia],
    );

    const days: ActividadDia[] = fechasActual.map((fecha) => ({
      fecha,
      label: getDiaSemana(fecha),
      sesiones: counts.get(fecha) ?? 0,
      today: fecha === hoy,
    }));

    let totalActual = 0;
    for (const d of days) totalActual += d.sesiones;

    let totalAnterior = 0;
    for (const fecha of fechasPrevia) {
      totalAnterior += counts.get(fecha) ?? 0;
    }

    const deltaPct =
      totalAnterior === 0
        ? null
        : Math.round(((totalActual - totalAnterior) / totalAnterior) * 100);

    return { days, deltaPct, totalActual, totalAnterior };
  },
});
