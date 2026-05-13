import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Devuelve todos los push tokens registrados para un usuario.
 * Internal: solo se invoca desde la action `sendPushToUser`.
 */
export const getTokensForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Candidatos para el recordatorio diario: pacienteIds únicos que tienen al
 * menos un plan activo y cuyo `dailyPatientRollup` del día actual NO esté ya
 * marcado como `completado` o `descanso`. Se filtra también por pacientes
 * con al menos un push token registrado para no programar envíos vacíos.
 */
export const getReminderCandidates = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const plansActivos = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();

    const uniquePacienteIds = Array.from(
      new Set(plansActivos.map((p) => p.pacienteId)),
    ) as Id<"users">[];

    const candidatos: Id<"users">[] = [];
    for (const pacienteId of uniquePacienteIds) {
      const rollup = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_fecha", (q) =>
          q.eq("pacienteId", pacienteId).eq("fecha", today),
        )
        .unique();

      if (
        rollup &&
        (rollup.estadoDia === "completado" ||
          rollup.estadoDia === "descanso")
      ) {
        continue;
      }

      const tieneToken = await ctx.db
        .query("pushTokens")
        .withIndex("by_userId", (q) => q.eq("userId", pacienteId))
        .first();
      if (!tieneToken) continue;

      candidatos.push(pacienteId);
    }
    return candidatos;
  },
});
