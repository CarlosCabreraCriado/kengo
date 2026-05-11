/**
 * Mutation auxiliar de `migrations/deleteUserByEmail`. Hace el borrado en
 * cascada de todos los registros del usuario dentro de Convex y devuelve los
 * datos necesarios (externalId, avatarKey) para que el action orquestador
 * limpie después Better-Auth y R2.
 *
 * Se separa del action para que el borrado en Convex ocurra dentro de una
 * única transacción y para no forzar runtime Node en una mutation.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type DeleteStats = {
  clinicsReassigned: number;
  clinicsOrphaned: number;
  conversations: number;
  messages: number;
  plans: number;
  planExercises: number;
  routines: number;
  routineExercises: number;
  sessions: number;
  exerciseExecutions: number;
  dailyRollups: number;
  weeklyRollups: number;
  monthlyRollups: number;
  patientSnapshots: number;
  physioAlertsDeleted: number;
  physioAlertsCleared: number;
  assignments: number;
  exerciseFavorites: number;
  accessTokens: number;
  accessCodes: number;
  verificationCodes: number;
  recoveryCodes: number;
  clinicMemberships: number;
};

export const collectAndDeleteConvex = internalMutation({
  args: { email: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    externalId: string;
    avatarKey: string | null;
    stats: DeleteStats;
  }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new Error(`USER_NOT_FOUND: ${args.email}`);
    }

    const userId = user._id;
    const externalId = user.externalId;
    const avatarKey = user.avatar ?? null;

    const stats: DeleteStats = {
      clinicsReassigned: 0,
      clinicsOrphaned: 0,
      conversations: 0,
      messages: 0,
      plans: 0,
      planExercises: 0,
      routines: 0,
      routineExercises: 0,
      sessions: 0,
      exerciseExecutions: 0,
      dailyRollups: 0,
      weeklyRollups: 0,
      monthlyRollups: 0,
      patientSnapshots: 0,
      physioAlertsDeleted: 0,
      physioAlertsCleared: 0,
      assignments: 0,
      exerciseFavorites: 0,
      accessTokens: 0,
      accessCodes: 0,
      verificationCodes: 0,
      recoveryCodes: 0,
      clinicMemberships: 0,
    };

    // 1. Reasignar `clinics.createdBy` cuando el usuario fue creator.
    //    Si no hay otro admin/fisio en la clínica, dejamos la clínica con
    //    createdBy huérfano (no la borramos: puede contener datos reales).
    const allClinics: Doc<"clinics">[] = await ctx.db.query("clinics").collect();
    for (const clinic of allClinics) {
      if (clinic.createdBy !== userId) continue;

      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();
      const otroAdmin = memberships.find(
        (m) => m.userId !== userId && m.puesto === "admin",
      );
      const otroFisio = memberships.find(
        (m) => m.userId !== userId && m.puesto === "fisio",
      );
      const reemplazo = otroAdmin ?? otroFisio;

      if (reemplazo) {
        await ctx.db.patch(clinic._id, { createdBy: reemplazo.userId });
        stats.clinicsReassigned++;
      } else {
        stats.clinicsOrphaned++;
        console.warn(
          `[deleteUserByEmail] clínica ${clinic._id} sin reemplazo para createdBy. Queda huérfana.`,
        );
      }
    }

    // 2. Conversaciones (paciente o fisio) + sus mensajes en cascada.
    const convsAsPaciente = await ctx.db
      .query("conversations")
      .withIndex("by_pacienteId_lastMessageAt", (q) =>
        q.eq("pacienteId", userId),
      )
      .collect();
    const convsAsFisio = await ctx.db
      .query("conversations")
      .withIndex("by_fisioId_lastMessageAt", (q) => q.eq("fisioId", userId))
      .collect();
    const allConvs = new Map<Id<"conversations">, Doc<"conversations">>();
    for (const c of [...convsAsPaciente, ...convsAsFisio]) {
      allConvs.set(c._id, c);
    }
    for (const conv of allConvs.values()) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      for (const m of msgs) {
        await ctx.db.delete(m._id);
        stats.messages++;
      }
      await ctx.db.delete(conv._id);
      stats.conversations++;
    }

    // 3. Planes (paciente o fisio) + sus planExercises en cascada.
    const plansAsPaciente = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", userId))
      .collect();
    const plansAsFisio = await ctx.db
      .query("plans")
      .withIndex("by_fisioId", (q) => q.eq("fisioId", userId))
      .collect();
    const allPlans = new Map<Id<"plans">, Doc<"plans">>();
    for (const p of [...plansAsPaciente, ...plansAsFisio]) {
      allPlans.set(p._id, p);
    }
    for (const plan of allPlans.values()) {
      const pes = await ctx.db
        .query("planExercises")
        .withIndex("by_planId", (q) => q.eq("planId", plan._id))
        .collect();
      for (const pe of pes) {
        await ctx.db.delete(pe._id);
        stats.planExercises++;
      }
      await ctx.db.delete(plan._id);
      stats.plans++;
    }

    // 4. Rutinas (autor) + routineExercises en cascada.
    const routines = await ctx.db
      .query("routines")
      .withIndex("by_autorId", (q) => q.eq("autorId", userId))
      .collect();
    for (const routine of routines) {
      const rxs = await ctx.db
        .query("routineExercises")
        .withIndex("by_routineId", (q) => q.eq("routineId", routine._id))
        .collect();
      for (const rx of rxs) {
        await ctx.db.delete(rx._id);
        stats.routineExercises++;
      }
      await ctx.db.delete(routine._id);
      stats.routines++;
    }

    // 5. Sesiones (paciente).
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
      stats.sessions++;
    }

    // 6. Ejecuciones de ejercicio (paciente).
    const execs = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_pacienteId_fecha", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const e of execs) {
      await ctx.db.delete(e._id);
      stats.exerciseExecutions++;
    }

    // 7. Rollups diarios / semanales / mensuales (paciente).
    const dailies = await ctx.db
      .query("dailyPatientRollup")
      .withIndex("by_pacienteId_fecha", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const d of dailies) {
      await ctx.db.delete(d._id);
      stats.dailyRollups++;
    }

    const weeklies = await ctx.db
      .query("weeklyPatientRollup")
      .withIndex("by_pacienteId_anioSemana", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const w of weeklies) {
      await ctx.db.delete(w._id);
      stats.weeklyRollups++;
    }

    const monthlies = await ctx.db
      .query("monthlyPatientRollup")
      .withIndex("by_pacienteId_anioMes", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const m of monthlies) {
      await ctx.db.delete(m._id);
      stats.monthlyRollups++;
    }

    // 8. Snapshots por paciente (como paciente o como fisio).
    const snapsAsPaciente = await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) => q.eq("pacienteId", userId))
      .collect();
    for (const s of snapsAsPaciente) {
      await ctx.db.delete(s._id);
      stats.patientSnapshots++;
    }
    // Snapshots donde el usuario es fisio (sin índice solo por fisioId).
    const allSnaps = await ctx.db.query("patientMetricsSnapshot").collect();
    for (const s of allSnaps) {
      if (s.fisioId === userId) {
        await ctx.db.delete(s._id);
        stats.patientSnapshots++;
      }
    }

    // 9. Alertas: borrar si paciente; limpiar revisadaPor si solo es revisor.
    const alertsAsPaciente = await ctx.db
      .query("physioAlerts")
      .withIndex("by_pacienteId_estado", (q) => q.eq("pacienteId", userId))
      .collect();
    const deletedAlertIds = new Set<Id<"physioAlerts">>();
    for (const a of alertsAsPaciente) {
      await ctx.db.delete(a._id);
      deletedAlertIds.add(a._id);
      stats.physioAlertsDeleted++;
    }
    const allAlerts = await ctx.db.query("physioAlerts").collect();
    for (const a of allAlerts) {
      if (deletedAlertIds.has(a._id)) continue;
      if (a.revisadaPor === userId) {
        await ctx.db.patch(a._id, { revisadaPor: undefined });
        stats.physioAlertsCleared++;
      }
    }

    // 10. Asignaciones (paciente o fisio).
    const assignsAsPaciente = await ctx.db
      .query("assignments")
      .withIndex("by_pacienteId_clinicId", (q) => q.eq("pacienteId", userId))
      .collect();
    const assignsAsFisio = await ctx.db
      .query("assignments")
      .withIndex("by_fisioId_clinicId", (q) => q.eq("fisioId", userId))
      .collect();
    const allAssigns = new Map<Id<"assignments">, Doc<"assignments">>();
    for (const a of [...assignsAsPaciente, ...assignsAsFisio]) {
      allAssigns.set(a._id, a);
    }
    for (const a of allAssigns.values()) {
      await ctx.db.delete(a._id);
      stats.assignments++;
    }

    // 11. Favoritos.
    const favorites = await ctx.db
      .query("exerciseFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const f of favorites) {
      await ctx.db.delete(f._id);
      stats.exerciseFavorites++;
    }

    // 12. Access tokens (userId y creadoPor).
    const tokensAsUser = await ctx.db
      .query("accessTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const allTokens = await ctx.db.query("accessTokens").collect();
    const tokenIds = new Set<Id<"accessTokens">>();
    for (const t of tokensAsUser) tokenIds.add(t._id);
    for (const t of allTokens) {
      if (t.creadoPor === userId) tokenIds.add(t._id);
    }
    for (const tid of tokenIds) {
      await ctx.db.delete(tid);
      stats.accessTokens++;
    }

    // 13. Códigos de acceso (creadoPor) — sin índice, scan completo.
    const allAccessCodes = await ctx.db.query("accessCodes").collect();
    for (const c of allAccessCodes) {
      if (c.creadoPor === userId) {
        await ctx.db.delete(c._id);
        stats.accessCodes++;
      }
    }

    // 14. Códigos de verificación.
    const verCodes = await ctx.db
      .query("verificationCodes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const v of verCodes) {
      await ctx.db.delete(v._id);
      stats.verificationCodes++;
    }

    // 15. Códigos de recuperación (por email).
    const recCodes = await ctx.db
      .query("recoveryCodes")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .collect();
    for (const r of recCodes) {
      await ctx.db.delete(r._id);
      stats.recoveryCodes++;
    }

    // 16. Membresías de clínica.
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
      stats.clinicMemberships++;
    }

    // 17. Documento `users` (al final, cuando ya no quedan referencias).
    await ctx.db.delete(userId);

    return { userId, externalId, avatarKey, stats };
  },
});
