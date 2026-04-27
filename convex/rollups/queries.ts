import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolvePacienteId } from "../_helpers/patientAccess";

/**
 * Devuelve los rollups diarios de un paciente entre dos fechas (inclusivas).
 * Sustituye a `compliance.queries.getByPaciente`.
 */
export const getDailyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    desde: v.string(),
    hasta: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

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
 */
export const getWeeklyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    desdeAnioSemana: v.string(),
    hastaAnioSemana: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

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
 */
export const getMonthlyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    desdeAnioMes: v.string(),
    hastaAnioMes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

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
