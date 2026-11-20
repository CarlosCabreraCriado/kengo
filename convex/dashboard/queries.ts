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
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertFisioInClinic,
  getManagedClinicIds,
} from "../_helpers/patientAccess";
import {
  contarSesionesPorFecha,
  getPacientesVisiblesEnClinica,
} from "../_helpers/fisioScope";
import {
  CLINIC_REF_TZ,
  DiaSemana,
  getDateOffsetInTz,
  getDiaSemana,
  rangeOfDates,
} from "../_helpers/datetime";
import { sessionsByClinic } from "../aggregates/sessionsByClinic";
import { batchGetMap } from "../_helpers/batchGet";

// Vistas agregadas de CLÍNICA: mezclan pacientes de varias TZ, así que el
// corte "hoy"/"+7d" usa la TZ de referencia de clínica (decisión documentada;
// desalineación máx. ±1 día para pacientes en otra TZ, cosmética).
function fechaHoy(): string {
  return getDateOffsetInTz(CLINIC_REF_TZ, 0);
}

function fechaDentroDe(days: number): string {
  return getDateOffsetInTz(CLINIC_REF_TZ, days);
}

/**
 * Planes activos cuya `fechaFin` cae entre hoy y hoy + 7 días, de las
 * clínicas que gestiona el usuario. Visibilidad por clínica
 * (`getPacientesVisiblesEnClinica`): los admins ven todos los planes de la
 * clínica; los fisios, solo los de sus pacientes asignados. Devuelve top 10
 * ordenados por fechaFin ascendente.
 *
 * `clinicId` es opcional por compatibilidad: la app desplegada no lo envía y
 * recibe las clínicas gestionadas mezcladas; con él se acota a esa clínica.
 */
export const planesPorVencer = query({
  args: { clinicId: v.optional(v.id("clinics")) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    let clinicIds: Id<"clinics">[];
    if (args.clinicId) {
      await assertFisioInClinic(ctx, user._id, args.clinicId);
      clinicIds = [args.clinicId];
    } else {
      clinicIds = await getManagedClinicIds(ctx, user._id);
    }
    if (clinicIds.length === 0) return [];

    const hoy = fechaHoy();
    const limite = fechaDentroDe(7);
    const vence = (plan: Doc<"plans">) =>
      !!plan.fechaFin && plan.fechaFin >= hoy && plan.fechaFin <= limite;

    // 1) Recolectar los planes que vencen, según lo que el usuario ve en
    //    cada clínica.
    const planesVencen: Doc<"plans">[] = [];
    for (const clinicId of new Set(clinicIds)) {
      const visibles = await getPacientesVisiblesEnClinica(
        ctx,
        user._id,
        clinicId,
      );
      if (visibles === null) {
        const planes = await ctx.db
          .query("plans")
          .withIndex("by_clinicId_estado", (q) =>
            q.eq("clinicId", clinicId).eq("estado", "activo"),
          )
          .collect();
        planesVencen.push(...planes.filter(vence));
        continue;
      }
      for (const pacienteId of visibles) {
        const planes = await ctx.db
          .query("plans")
          .withIndex("by_pacienteId_estado", (q) =>
            q.eq("pacienteId", pacienteId).eq("estado", "activo"),
          )
          .collect();
        planesVencen.push(
          ...planes.filter((p) => p.clinicId === clinicId && vence(p)),
        );
      }
    }

    // 2) Resolver nombres de paciente en un único batch.
    const pacientes = await batchGetMap(
      ctx,
      planesVencen.map((p) => p.pacienteId),
    );
    const planesPorVencer = planesVencen.map((plan) => {
      const paciente = pacientes.get(plan.pacienteId);
      return {
        id: plan._id as string,
        titulo: plan.titulo,
        fechaFin: plan.fechaFin as string,
        pacienteNombre: paciente
          ? `${paciente.firstName} ${paciente.lastName}`.trim()
          : "",
        pacienteId: plan.pacienteId as string,
      };
    });

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
 * normalización 0-1 y el copy del delta se componen en el cliente. Los
 * fisios solo cuentan las sesiones de sus pacientes asignados.
 */
export const getActividadDiariaClinica = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args): Promise<ActividadDiariaClinica> => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    const hoy = fechaHoy();
    const inicioActual = fechaDentroDe(-9);
    const finPrevia = fechaDentroDe(-10);
    const inicioPrevia = fechaDentroDe(-19);

    const fechasActual = rangeOfDates(inicioActual, hoy);
    const fechasPrevia = rangeOfDates(inicioPrevia, finPrevia);
    // Admins: aggregate de toda la clínica. Fisios: solo las sesiones de sus
    // pacientes asignados (misma semántica: sesiones reales por fecha).
    const visibles = await getPacientesVisiblesEnClinica(
      ctx,
      user._id,
      args.clinicId,
    );
    const counts =
      visibles === null
        ? await loadActividadDiaria_aggregate(ctx, args.clinicId, [
            ...fechasActual,
            ...fechasPrevia,
          ])
        : await contarSesionesPorFecha(
            ctx,
            visibles,
            args.clinicId,
            inicioPrevia,
            hoy,
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
