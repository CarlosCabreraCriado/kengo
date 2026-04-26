import { v } from "convex/values";
import { mutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { insertCommentNotificationFromRecord } from "../_helpers/notifications";
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

async function getDenormalizedFields(
  ctx: MutationCtx,
  planExerciseId: Id<"planExercises">,
): Promise<{
  planId?: Id<"plans">;
  tituloPlan?: string;
  nombreEjercicio?: string;
}> {
  const planExercise = await ctx.db.get(planExerciseId);
  if (!planExercise) return {};

  const nombreEjercicio =
    planExercise.ejercicioNombre ??
    (await ctx.db.get(planExercise.exerciseId))?.nombreEjercicio;
  const plan = await ctx.db.get(planExercise.planId);

  return {
    planId: planExercise.planId,
    tituloPlan: plan?.titulo,
    nombreEjercicio,
  };
}

export const create = mutation({
  args: recordArgs,
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const denorm = await getDenormalizedFields(ctx, args.planExerciseId);

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
      ...denorm,
    });

    if (args.completado && args.notaPaciente?.trim()) {
      await insertCommentNotificationFromRecord(ctx, id);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.calculateDailyCompliance,
      { fecha: getHoyMadrid(), pacienteId: user._id },
    );

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

    // Cache de denormalización por planExerciseId para evitar lookups repetidos
    // cuando hay varios records del mismo ejercicio.
    const denormCache = new Map<
      Id<"planExercises">,
      Awaited<ReturnType<typeof getDenormalizedFields>>
    >();

    for (const rec of args.records) {
      let denorm = denormCache.get(rec.planExerciseId);
      if (!denorm) {
        denorm = await getDenormalizedFields(ctx, rec.planExerciseId);
        denormCache.set(rec.planExerciseId, denorm);
      }

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
        ...denorm,
      });
      ids.push(id);
      if (rec.completado && rec.notaPaciente?.trim()) {
        await insertCommentNotificationFromRecord(ctx, id);
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.compliance.internal.calculateDailyCompliance,
      { fecha: getHoyMadrid(), pacienteId: user._id },
    );

    return ids;
  },
});
