import { v } from "convex/values";
import { query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertFisioInClinic,
  getSharedClinicIdsForPaciente,
} from "../_helpers/patientAccess";
import { assertCanAccessPaciente } from "../_helpers/authorization";
import {
  contarSesionesPorFecha,
  getPacientesVisiblesEnClinica,
  pendingAlertsVisiblesEnClinica,
} from "../_helpers/fisioScope";
import { pacienteTienePlanEnCursoEnClinica } from "../_helpers/planStatus";
import { getPatientToday } from "../_helpers/patientTz";
import { CLINIC_REF_TZ, getDateOffsetInTz } from "../_helpers/datetime";
import { patientsByClinicAdherencia } from "../aggregates/patientsByClinicAdherencia";

const ventana = v.union(
  v.literal("7d"),
  v.literal("15d"),
  v.literal("30d"),
);

type Ventana = "7d" | "15d" | "30d";

/**
 * Devuelve los snapshots de pacientes de una clínica para una ventana
 * concreta. Permite ordenar por riskScore (desc) o adherencia (asc) y
 * limitar el número de resultados.
 *
 * Sustituye a `dashboard.queries.patientMetrics` (que recorría F·P·D).
 */
export const getPatientMetrics = query({
  args: {
    clinicId: v.id("clinics"),
    ventana,
    ordenarPor: v.optional(
      v.union(v.literal("riskScore"), v.literal("adherencia")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    const ordenarPor = args.ordenarPor ?? "riskScore";
    const limit = args.limit ?? 100;

    if (ordenarPor === "riskScore") {
      return await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_clinicId_ventana_riskScore", (q) =>
          q.eq("clinicId", args.clinicId).eq("ventana", args.ventana),
        )
        .order("desc")
        .take(limit);
    }
    return await loadByAdherenciaAggregate(
      ctx,
      args.clinicId,
      args.ventana,
      limit,
    );
  },
});

/**
 * Lectura de snapshots ordenados por adherencia (asc) leyendo del
 * DirectAggregate `patientsByClinicAdherencia`. O(log n + k) donde k = limit.
 *
 * El aggregate se mantiene sincronizado por `recomputePatientForWindow` (H5)
 * tras cada upsert del snapshot. La paginación devuelve directamente la
 * primera página con tamaño `limit`; para limits típicos (100-200) no se
 * requiere iterar páginas adicionales.
 *
 * Cambio funcional respecto a la implementación pre-H1: los pacientes con
 * `adherencia == null` (sin ventana medible — todo descanso o sin
 * ejecuciones) quedan EXCLUIDOS del listado ordenado por adherencia. Antes
 * aparecían al final del orden con sortKey ficticio 101; ahora no aparecen
 * porque el aggregate no los almacena. Otros ordenados (riskScore) los
 * siguen mostrando.
 */
async function loadByAdherenciaAggregate(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
  ventana: Ventana,
  limit: number,
): Promise<Doc<"patientMetricsSnapshot">[]> {
  const { page } = await patientsByClinicAdherencia.paginate(ctx, {
    namespace: [clinicId, ventana],
    pageSize: limit,
    order: "asc",
  });

  const snapshots = await Promise.all(
    page.map(async (item) => {
      return await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_pacienteId_ventana", (q) =>
          q.eq("pacienteId", item.id).eq("ventana", ventana),
        )
        .filter((q) => q.eq(q.field("clinicId"), clinicId))
        .first();
    }),
  );

  return snapshots.filter(
    (s): s is Doc<"patientMetricsSnapshot"> => s !== null,
  );
}

/**
 * Devuelve el snapshot de métricas de UN paciente para una ventana concreta.
 * Lo consume el detalle de paciente (`/mis-pacientes/:id`) para alimentar el
 * KPI de dolor con la misma fuente que el listado, garantizando que ambos
 * valores coincidan.
 *
 * Tras la fase 3a el snapshot está particionado por
 * `(pacienteId, clinicId, ventana)`. El argumento `clinicId` es opcional
 * por compatibilidad con callers antiguos: si se pasa, devuelve
 * exactamente el snapshot de esa clínica; si no, devuelve el primero que
 * encuentre (puede ser cualquiera de las clínicas del paciente). El TODO
 * de propagar `clinicId` desde Angular queda como deuda separada.
 */
export const getPatientMetricsByPaciente = query({
  args: {
    pacienteId: v.id("users"),
    ventana,
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertCanAccessPaciente(ctx, user._id, args.pacienteId);

    const base = ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", args.pacienteId).eq("ventana", args.ventana),
      );
    if (args.clinicId !== undefined) {
      const clinicId = args.clinicId;
      if (user._id !== args.pacienteId) {
        await getSharedClinicIdsForPaciente(
          ctx,
          user._id,
          args.pacienteId,
          clinicId,
        );
      }
      return await base
        .filter((q) => q.eq(q.field("clinicId"), clinicId))
        .first();
    }
    if (user._id === args.pacienteId) return await base.first();
    // Fisio sin clínica (clientes antiguos): nunca el snapshot de una clínica
    // que no comparte con el paciente.
    const compartidas = await getSharedClinicIdsForPaciente(
      ctx,
      user._id,
      args.pacienteId,
    );
    const snaps = await base.collect();
    return snaps.find((s) => compartidas.includes(s.clinicId)) ?? null;
  },
});

/**
 * Devuelve el snapshot de métricas de una clínica para una ventana.
 * Sustituye a parte de `dashboard.queries.fisioSummary`.
 *
 * Los admins reciben el snapshot precalculado de toda la clínica. Los fisios
 * reciben el mismo shape calculado al vuelo sobre sus pacientes asignados
 * (`computeMetricsForPacientes`).
 */
export const getClinicMetrics = query({
  args: {
    clinicId: v.id("clinics"),
    ventana,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    const snapshot = await ctx.db
      .query("clinicMetricsSnapshot")
      .withIndex("by_clinicId_ventana", (q) =>
        q.eq("clinicId", args.clinicId).eq("ventana", args.ventana),
      )
      .unique();

    const visibles = await getPacientesVisiblesEnClinica(
      ctx,
      user._id,
      args.clinicId,
    );
    if (visibles === null) return snapshot;

    const metricas = await computeMetricsForPacientes(
      ctx,
      user._id,
      args.clinicId,
      args.ventana,
      visibles,
    );
    return {
      ...metricas,
      _id: snapshot?._id ?? (`fisio:${args.clinicId}` as Id<"clinicMetricsSnapshot">),
      _creationTime: snapshot?._creationTime ?? Date.now(),
      clinicId: args.clinicId,
      ventana: args.ventana,
      actualizadoEn: Date.now(),
    };
  },
});

/**
 * Réplica de `recomputeClinicForWindow` (`snapshots/internal.ts`) restringida
 * a un conjunto de pacientes:
 *  - pacientesActivos: puesto `paciente` en la clínica y plan en curso en
 *    ella (misma regla que `patientsWithActivePlanByClinic`).
 *  - adherenciaPromedio / dolorMedio: medias de los `patientMetricsSnapshot`
 *    de los activos con valor definido (los aggregates solo contienen
 *    pacientes activos).
 *  - sesionesUltimos7d: sesiones reales de los últimos 7 días.
 *  - alertasPendientes: las que el usuario ve en la clínica.
 */
async function computeMetricsForPacientes(
  ctx: QueryCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  ventana: Ventana,
  pacienteIds: Set<Id<"users">>,
) {
  const adherencias: number[] = [];
  const dolores: number[] = [];
  let pacientesActivos = 0;

  for (const pacienteId of pacienteIds) {
    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", pacienteId).eq("clinicId", clinicId),
      )
      .unique();
    if (membership?.puesto !== "paciente") continue;

    const hoy = await getPatientToday(ctx, pacienteId);
    if (!(await pacienteTienePlanEnCursoEnClinica(ctx, pacienteId, clinicId, hoy))) {
      continue;
    }
    pacientesActivos += 1;

    const snap = await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", pacienteId).eq("ventana", ventana),
      )
      .filter((q) => q.eq(q.field("clinicId"), clinicId))
      .first();
    if (snap?.adherencia !== undefined) adherencias.push(snap.adherencia);
    if (snap?.dolorPromedio !== undefined) dolores.push(snap.dolorPromedio);
  }

  const suma = (xs: number[]) => xs.reduce((acc, x) => acc + x, 0);
  const adherenciaPromedio =
    adherencias.length === 0
      ? 0
      : Math.round(suma(adherencias) / adherencias.length);
  const dolorMedio =
    dolores.length === 0
      ? undefined
      : Math.round((suma(dolores) / dolores.length) * 100) / 100;

  const desde7 = getDateOffsetInTz(CLINIC_REF_TZ, -6);
  const hasta = getDateOffsetInTz(CLINIC_REF_TZ, 0);
  const sesiones = await contarSesionesPorFecha(
    ctx,
    pacienteIds,
    clinicId,
    desde7,
    hasta,
  );
  let sesionesUltimos7d = 0;
  for (const n of sesiones.values()) sesionesUltimos7d += n;

  const alertasPendientes = (
    await pendingAlertsVisiblesEnClinica(ctx, userId, clinicId)
  ).length;

  return {
    pacientesActivos,
    adherenciaPromedio,
    dolorMedio,
    sesionesUltimos7d,
    alertasPendientes,
  };
}
