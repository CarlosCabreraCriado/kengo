import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { assertFisioInClinic } from "../_helpers/patientAccess";
import { assertCanAccessPaciente } from "../_helpers/authorization";

const ventana = v.union(
  v.literal("7d"),
  v.literal("15d"),
  v.literal("30d"),
);

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

    let snapshots;
    if (ordenarPor === "riskScore") {
      snapshots = await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_clinicId_ventana_riskScore", (q) =>
          q.eq("clinicId", args.clinicId).eq("ventana", args.ventana),
        )
        .order("desc")
        .take(limit);
    } else {
      const all = await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_clinicId_ventana_riskScore", (q) =>
          q.eq("clinicId", args.clinicId).eq("ventana", args.ventana),
        )
        .collect();
      snapshots = all
        .sort((a, b) => a.adherencia - b.adherencia)
        .slice(0, limit);
    }

    return snapshots;
  },
});

/**
 * Devuelve el snapshot de métricas de UN paciente para una ventana concreta.
 * Lo consume el detalle de paciente (`/mis-pacientes/:id`) para alimentar el
 * KPI de dolor con la misma fuente que el listado, garantizando que ambos
 * valores coincidan.
 */
export const getPatientMetricsByPaciente = query({
  args: {
    pacienteId: v.id("users"),
    ventana,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertCanAccessPaciente(ctx, user._id, args.pacienteId);

    return await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", args.pacienteId).eq("ventana", args.ventana),
      )
      .unique();
  },
});

/**
 * Devuelve el snapshot de métricas de una clínica para una ventana.
 * Sustituye a parte de `dashboard.queries.fisioSummary`.
 */
export const getClinicMetrics = query({
  args: {
    clinicId: v.id("clinics"),
    ventana,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    return await ctx.db
      .query("clinicMetricsSnapshot")
      .withIndex("by_clinicId_ventana", (q) =>
        q.eq("clinicId", args.clinicId).eq("ventana", args.ventana),
      )
      .unique();
  },
});
