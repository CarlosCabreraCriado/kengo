import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

function getISODaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export const generateNotifications = internalMutation({
  args: {
    pacienteId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const hace7Dias = getISODaysAgo(7);

    // ============= COMENTARIOS DE REGISTROS =============
    const allRecords = await ctx.db.query("planRecords").collect();
    const records = allRecords.filter(
      (r) =>
        r.completado &&
        r.notaPaciente &&
        r.notaPaciente.trim().length > 0 &&
        r.fechaHora >= hace7Dias &&
        (!args.pacienteId || r.pacienteId === args.pacienteId),
    );

    let insertedComentarios = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("physioNotifications")
        .withIndex("by_recordId", (q) => q.eq("recordId", record._id))
        .first();
      if (existing) continue;

      const membership = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", record.pacienteId))
        .first();
      if (!membership) continue;

      const planEx = await ctx.db.get(record.planExerciseId);
      if (!planEx) continue;
      const plan = await ctx.db.get(planEx.planId);

      let nombreEjercicio = planEx.ejercicioNombre;
      if (!nombreEjercicio) {
        const ex = await ctx.db.get(planEx.exerciseId);
        nombreEjercicio = ex?.nombreEjercicio;
      }

      const paciente = await ctx.db.get(record.pacienteId);
      const pacienteNombre = paciente
        ? `${paciente.firstName} ${paciente.lastName}`.trim()
        : undefined;

      await ctx.db.insert("physioNotifications", {
        tipo: "comentario",
        pacienteId: record.pacienteId,
        clinicId: membership.clinicId,
        recordId: record._id,
        fechaRegistro: record.fechaHora,
        tituloPlan: plan?.titulo,
        nombreEjercicio,
        texto: record.notaPaciente,
        dolorEscala: record.dolorEscala,
        revisada: false,
        pacienteNombre,
      });
      insertedComentarios += 1;
    }

    // ============= OBSERVACIONES DE SESIONES =============
    const allSessions = await ctx.db.query("sessions").collect();
    const sessions = allSessions.filter(
      (s) =>
        s.completada &&
        s.observacionesGenerales &&
        s.observacionesGenerales.trim().length > 0 &&
        s.fechaInicio >= hace7Dias &&
        (!args.pacienteId || s.pacienteId === args.pacienteId),
    );

    let insertedSesiones = 0;
    for (const session of sessions) {
      const existing = await ctx.db
        .query("physioNotifications")
        .withIndex("by_pacienteId", (q) =>
          q.eq("pacienteId", session.pacienteId),
        )
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .first();
      if (existing) continue;

      const membership = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", session.pacienteId))
        .first();
      if (!membership) continue;

      const paciente = await ctx.db.get(session.pacienteId);
      const pacienteNombre = paciente
        ? `${paciente.firstName} ${paciente.lastName}`.trim()
        : undefined;

      await ctx.db.insert("physioNotifications", {
        tipo: "comentario",
        pacienteId: session.pacienteId,
        clinicId: membership.clinicId,
        sessionId: session._id,
        fechaRegistro: session.fechaInicio,
        tituloPlan: "Sesión de trabajo",
        texto: session.observacionesGenerales,
        revisada: false,
        pacienteNombre,
      });
      insertedSesiones += 1;
    }

    console.log(
      `[notifications] ${insertedComentarios} comentario(s), ${insertedSesiones} sesión(es)`,
    );
    return { comentarios: insertedComentarios, sesiones: insertedSesiones };
  },
});
