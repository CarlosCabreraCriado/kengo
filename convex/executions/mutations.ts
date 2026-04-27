import { v } from "convex/values";
import { mutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { getClinicIdForPatient } from "../_helpers/expectedExercises";
import {
  openOrResumeImpl,
  recomputeAggregatesAndCheckAutoCloseImpl,
} from "../sessions/internal";

const exerciseExecutionArgs = {
  planExerciseId: v.id("planExercises"),
  fechaHora: v.string(),
  fecha: v.string(),
  completado: v.boolean(),
  repeticionesRealizadas: v.optional(v.number()),
  duracionRealSeg: v.optional(v.number()),
  dolorEscala: v.optional(v.number()),
  esfuerzoEscala: v.optional(v.number()),
  notaPaciente: v.optional(v.string()),
};

/**
 * Inserta una ejecución del paciente autenticado. Crea/reanuda la sesión
 * del día, recompute agregados (auto-cierra si completa todo), genera
 * alerta de comentario si hay nota.
 *
 * Idempotente por `(sessionId, planExerciseId, fechaHora)`.
 */
export const create = mutation({
  args: exerciseExecutionArgs,
  handler: async (ctx, args): Promise<Id<"exerciseExecutions">> => {
    const user = await getAuthenticatedUser(ctx);
    return await createImpl(ctx, user._id, args);
  },
});

/**
 * Versión batch optimizada: inserta varias ejecuciones, hace 1 sola
 * recomputación al final por (sesión) y 1 trigger de alerta por nota.
 */
export const createBatch = mutation({
  args: {
    entradas: v.array(v.object(exerciseExecutionArgs)),
  },
  handler: async (ctx, args): Promise<Id<"exerciseExecutions">[]> => {
    const user = await getAuthenticatedUser(ctx);
    if (args.entradas.length === 0) return [];

    const clinicId = await getClinicIdForPatient(ctx, user._id);
    if (!clinicId) throw new Error("Paciente sin clínica asignada");

    const ids: Id<"exerciseExecutions">[] = [];
    const sesionesAfectadas = new Set<Id<"sessions">>();

    // Cache local: planExerciseId → planId, para evitar lookups repetidos.
    const planIdCache = new Map<Id<"planExercises">, Id<"plans">>();

    for (const entrada of args.entradas) {
      let planId = planIdCache.get(entrada.planExerciseId);
      if (!planId) {
        const planExercise = await ctx.db.get(entrada.planExerciseId);
        if (!planExercise) {
          throw new Error(
            `planExercise no encontrado: ${entrada.planExerciseId}`,
          );
        }
        planId = planExercise.planId;
        planIdCache.set(entrada.planExerciseId, planId);
      }

      const sessionId = await openOrResumeImpl(ctx, user._id, entrada.fecha);

      // Idempotencia: ya existe execution con esta terna?
      const dup = await ctx.db
        .query("exerciseExecutions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .filter((q) =>
          q.and(
            q.eq(q.field("planExerciseId"), entrada.planExerciseId),
            q.eq(q.field("fechaHora"), entrada.fechaHora),
          ),
        )
        .first();

      let executionId: Id<"exerciseExecutions">;
      if (dup) {
        executionId = dup._id;
      } else {
        executionId = await ctx.db.insert("exerciseExecutions", {
          sessionId,
          planExerciseId: entrada.planExerciseId,
          pacienteId: user._id,
          planId,
          clinicId,
          fecha: entrada.fecha,
          fechaHora: entrada.fechaHora,
          completado: entrada.completado,
          repeticionesRealizadas: entrada.repeticionesRealizadas,
          duracionRealSeg: entrada.duracionRealSeg,
          dolorEscala: entrada.dolorEscala,
          esfuerzoEscala: entrada.esfuerzoEscala,
          notaPaciente: entrada.notaPaciente,
        });
      }
      ids.push(executionId);
      sesionesAfectadas.add(sessionId);

      // Alerta de comentario si hay nota.
      if (entrada.completado && entrada.notaPaciente?.trim()) {
        await ctx.runMutation(internal.alerts.internal.createCommentAlert, {
          pacienteId: user._id,
          sessionId,
          exerciseExecutionId: executionId,
          texto: entrada.notaPaciente,
        });
      }
    }

    // 1 recompute por sesión afectada al final del batch.
    for (const sessionId of sesionesAfectadas) {
      await recomputeAggregatesAndCheckAutoCloseImpl(ctx, sessionId);
    }

    return ids;
  },
});

async function createImpl(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  args: {
    planExerciseId: Id<"planExercises">;
    fechaHora: string;
    fecha: string;
    completado: boolean;
    repeticionesRealizadas?: number;
    duracionRealSeg?: number;
    dolorEscala?: number;
    esfuerzoEscala?: number;
    notaPaciente?: string;
  },
): Promise<Id<"exerciseExecutions">> {
  const planExercise = await ctx.db.get(args.planExerciseId);
  if (!planExercise) throw new Error("planExercise no encontrado");
  const planId = planExercise.planId;

  const clinicId = await getClinicIdForPatient(ctx, pacienteId);
  if (!clinicId) throw new Error("Paciente sin clínica asignada");

  const sessionId = await openOrResumeImpl(ctx, pacienteId, args.fecha);

  // Idempotencia.
  const dup = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .filter((q) =>
      q.and(
        q.eq(q.field("planExerciseId"), args.planExerciseId),
        q.eq(q.field("fechaHora"), args.fechaHora),
      ),
    )
    .first();
  if (dup) return dup._id;

  const executionId = await ctx.db.insert("exerciseExecutions", {
    sessionId,
    planExerciseId: args.planExerciseId,
    pacienteId,
    planId,
    clinicId,
    fecha: args.fecha,
    fechaHora: args.fechaHora,
    completado: args.completado,
    repeticionesRealizadas: args.repeticionesRealizadas,
    duracionRealSeg: args.duracionRealSeg,
    dolorEscala: args.dolorEscala,
    esfuerzoEscala: args.esfuerzoEscala,
    notaPaciente: args.notaPaciente,
  });

  await recomputeAggregatesAndCheckAutoCloseImpl(ctx, sessionId);

  if (args.completado && args.notaPaciente?.trim()) {
    await ctx.runMutation(internal.alerts.internal.createCommentAlert, {
      pacienteId,
      sessionId,
      exerciseExecutionId: executionId,
      texto: args.notaPaciente,
    });
  }

  return executionId;
}

