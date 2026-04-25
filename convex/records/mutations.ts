import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { getHoyMadrid } from "../compliance/internal";

const recordArgs = {
  planExerciseId: v.id("planExercises"),
  sessionId: v.optional(v.id("sessions")),
  fechaHora: v.string(),
  fecha: v.string(),
  completado: v.boolean(),
  repeticionesRealizadas: v.optional(v.number()),
  duracionRealSeg: v.optional(v.number()),
  dolorEscala: v.optional(v.number()),
  esfuerzoEscala: v.optional(v.number()),
  notaPaciente: v.optional(v.string()),
};

export const create = mutation({
  args: recordArgs,
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const id = await ctx.db.insert("planRecords", {
      planExerciseId: args.planExerciseId,
      pacienteId: user._id,
      sessionId: args.sessionId,
      fechaHora: args.fechaHora,
      fecha: args.fecha,
      completado: args.completado,
      repeticionesRealizadas: args.repeticionesRealizadas,
      duracionRealSeg: args.duracionRealSeg,
      dolorEscala: args.dolorEscala,
      esfuerzoEscala: args.esfuerzoEscala,
      notaPaciente: args.notaPaciente,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.calculateDailyCompliance,
      { fecha: getHoyMadrid(), pacienteId: user._id },
    );

    if (args.notaPaciente && args.notaPaciente.trim().length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.internal.generateNotifications,
        { pacienteId: user._id },
      );
    }

    return id;
  },
});

export const createBatch = mutation({
  args: {
    records: v.array(v.object(recordArgs)),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const ids = [];
    let hasComentario = false;

    for (const rec of args.records) {
      const id = await ctx.db.insert("planRecords", {
        planExerciseId: rec.planExerciseId,
        pacienteId: user._id,
        sessionId: rec.sessionId,
        fechaHora: rec.fechaHora,
        fecha: rec.fecha,
        completado: rec.completado,
        repeticionesRealizadas: rec.repeticionesRealizadas,
        duracionRealSeg: rec.duracionRealSeg,
        dolorEscala: rec.dolorEscala,
        esfuerzoEscala: rec.esfuerzoEscala,
        notaPaciente: rec.notaPaciente,
      });
      ids.push(id);
      if (rec.notaPaciente && rec.notaPaciente.trim().length > 0) {
        hasComentario = true;
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.calculateDailyCompliance,
      { fecha: getHoyMadrid(), pacienteId: user._id },
    );

    if (hasComentario) {
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.internal.generateNotifications,
        { pacienteId: user._id },
      );
    }

    return ids;
  },
});
