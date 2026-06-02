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
 * menos un plan activo y cuyos `dailyPatientRollup` del día actual no estén
 * todos completos.
 *
 * Tras la partición por clínica (fase 3a), un paciente puede tener N rollups
 * el mismo día (uno por clínica con actividad). Política decidida con el
 * usuario: 1 push por paciente — se envía si CUALQUIER rollup no está
 * "completado" o "descanso". Si TODOS sus rollups del día están en uno de
 * esos estados (o el paciente no tiene rollup), no se manda push.
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
      const rollups = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_fecha", (q) =>
          q.eq("pacienteId", pacienteId).eq("fecha", today),
        )
        .collect();

      // Si tiene rollups y TODOS son completado/descanso, no necesita push.
      if (
        rollups.length > 0 &&
        rollups.every(
          (r) => r.estadoDia === "completado" || r.estadoDia === "descanso",
        )
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
