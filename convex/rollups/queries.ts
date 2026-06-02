import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolveAndAssertPacienteAndClinic } from "../_helpers/patientAccess";

/**
 * Devuelve los rollups diarios de un paciente entre dos fechas (inclusivas).
 * Sustituye a `compliance.queries.getByPaciente`.
 *
 * Aislamiento por clínica: si llega `clinicId`, filtra estrictamente los
 * rollups de esa clínica vía el índice particionado. Los rollups legados
 * sin `clinicId` quedan excluidos (los aborda el backfill 3b).
 */
export const getDailyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desde: v.string(),
    hasta: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    if (targetClinicId) {
      return await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_clinicId_fecha", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .eq("clinicId", targetClinicId)
            .gte("fecha", args.desde)
            .lte("fecha", args.hasta),
        )
        .collect();
    }

    return await ctx.db
      .query("dailyPatientRollup")
      .withIndex("by_pacienteId_fecha", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("fecha", args.desde)
          .lte("fecha", args.hasta),
      )
      .collect();
  },
});

/**
 * Devuelve los rollups semanales de un paciente entre dos semanas ISO
 * (inclusivas, formato "YYYY-Www"). El orden es ascendente.
 *
 * Aislamiento por clínica: si llega `clinicId`, filtra estrictamente los
 * rollups particionados (sub-fase 3a). Rollups legados sin `clinicId`
 * quedan excluidos (los aborda el backfill 3b).
 */
export const getWeeklyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desdeAnioSemana: v.string(),
    hastaAnioSemana: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    if (targetClinicId) {
      return await ctx.db
        .query("weeklyPatientRollup")
        .withIndex("by_pacienteId_clinicId_anioSemana", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .eq("clinicId", targetClinicId)
            .gte("anioSemana", args.desdeAnioSemana)
            .lte("anioSemana", args.hastaAnioSemana),
        )
        .collect();
    }

    return await ctx.db
      .query("weeklyPatientRollup")
      .withIndex("by_pacienteId_anioSemana", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("anioSemana", args.desdeAnioSemana)
          .lte("anioSemana", args.hastaAnioSemana),
      )
      .collect();
  },
});

/**
 * Devuelve los rollups mensuales de un paciente entre dos meses (inclusivos,
 * formato "YYYY-MM"). El orden es ascendente.
 *
 * Aislamiento por clínica: ver nota en `getWeeklyByPaciente`.
 */
export const getMonthlyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desdeAnioMes: v.string(),
    hastaAnioMes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    if (targetClinicId) {
      return await ctx.db
        .query("monthlyPatientRollup")
        .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .eq("clinicId", targetClinicId)
            .gte("anioMes", args.desdeAnioMes)
            .lte("anioMes", args.hastaAnioMes),
        )
        .collect();
    }

    return await ctx.db
      .query("monthlyPatientRollup")
      .withIndex("by_pacienteId_anioMes", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("anioMes", args.desdeAnioMes)
          .lte("anioMes", args.hastaAnioMes),
      )
      .collect();
  },
});
