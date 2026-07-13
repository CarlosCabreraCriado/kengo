import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { mutation } from "../_helpers/mutationWithTriggers";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { getClinicIdForPatient } from "../_helpers/expectedExercises";
import {
  openOrResumeImpl,
  recomputeAggregatesAndCheckAutoCloseImpl,
} from "../sessions/internal";
import { getCurrentMadridDate } from "../_helpers/datetime";

/**
 * Defensa híbrida contra clientes desfasados: si el cliente envió una `fecha`
 * distinta a la fecha actual del calendario Europe/Madrid (típicamente porque
 * usaba `new Date().toISOString().split('T')[0]`, que devuelve UTC), la
 * forzamos a la fecha canónica y dejamos un log con `tz_mismatch` para
 * detectar builds antiguas en producción.
 *
 * Devuelve la fecha corregida que se debe persistir.
 */
function enforceMadridFecha(
  pacienteId: Id<"users">,
  fechaRecibida: string,
): string {
  const expected = getCurrentMadridDate();
  if (fechaRecibida !== expected) {
    console.warn(
      `[tz_mismatch] paciente=${pacienteId} fecha_recibida=${fechaRecibida} ` +
        `fecha_esperada=${expected} — cliente desfasado o antiguo. Forzando fecha Madrid.`,
    );
    return expected;
  }
  return fechaRecibida;
}

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

interface ExecutionEntrada {
  planExerciseId: Id<"planExercises">;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  esfuerzoEscala?: number;
  notaPaciente?: string;
}

/**
 * Inserta o reutiliza la ejecución de un ejercicio dentro de una sesión.
 *
 * Idempotencia por IDENTIDAD para completadas: si ya existe una execution
 * completada para `(sessionId, planExerciseId)`, se parchea con los últimos
 * valores (solo los campos definidos — un reintento sin feedback no borra la
 * nota/dolor ya guardados) y `fechaHora` nueva, devolviendo el id canónico.
 * Así los reintentos del cliente con distinto `fechaHora` no crean filas
 * duplicadas que inflen los contadores.
 *
 * Las no-completadas mantienen el dedup por terna exacta
 * `(sessionId, planExerciseId, fechaHora)` (comportamiento previo).
 */
async function upsertExecutionImpl(
  ctx: MutationCtx,
  params: {
    sessionId: Id<"sessions">;
    pacienteId: Id<"users">;
    planId: Id<"plans">;
    clinicId: Id<"clinics">;
    fecha: string;
    entrada: ExecutionEntrada;
  },
): Promise<Id<"exerciseExecutions">> {
  const { sessionId, pacienteId, planId, clinicId, fecha, entrada } = params;

  const existentes = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .filter((q) => q.eq(q.field("planExerciseId"), entrada.planExerciseId))
    .collect();

  if (entrada.completado) {
    const previa = existentes.find((e) => e.completado);
    if (previa) {
      const patch: Partial<{
        fechaHora: string;
        repeticionesRealizadas: number;
        duracionRealSeg: number;
        dolorEscala: number;
        esfuerzoEscala: number;
        notaPaciente: string;
      }> = { fechaHora: entrada.fechaHora };
      if (entrada.repeticionesRealizadas !== undefined)
        patch.repeticionesRealizadas = entrada.repeticionesRealizadas;
      if (entrada.duracionRealSeg !== undefined)
        patch.duracionRealSeg = entrada.duracionRealSeg;
      if (entrada.dolorEscala !== undefined)
        patch.dolorEscala = entrada.dolorEscala;
      if (entrada.esfuerzoEscala !== undefined)
        patch.esfuerzoEscala = entrada.esfuerzoEscala;
      if (entrada.notaPaciente !== undefined)
        patch.notaPaciente = entrada.notaPaciente;
      await ctx.db.patch(previa._id, patch);
      return previa._id;
    }
  } else {
    const dup = existentes.find((e) => e.fechaHora === entrada.fechaHora);
    if (dup) return dup._id;
  }

  return await ctx.db.insert("exerciseExecutions", {
    sessionId,
    planExerciseId: entrada.planExerciseId,
    pacienteId,
    planId,
    clinicId,
    fecha,
    fechaHora: entrada.fechaHora,
    completado: entrada.completado,
    repeticionesRealizadas: entrada.repeticionesRealizadas,
    duracionRealSeg: entrada.duracionRealSeg,
    dolorEscala: entrada.dolorEscala,
    esfuerzoEscala: entrada.esfuerzoEscala,
    notaPaciente: entrada.notaPaciente,
  });
}

/**
 * Inserta una ejecución del paciente autenticado. Crea/reanuda la sesión
 * del día, recompute agregados (auto-cierra si completa todo), genera
 * alerta de comentario si hay nota.
 *
 * Idempotente por IDENTIDAD `(sessionId, planExerciseId)` para completadas
 * (ver `upsertExecutionImpl`); por terna con `fechaHora` para el resto.
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

      const fecha = enforceMadridFecha(user._id, entrada.fecha);
      const sessionId = await openOrResumeImpl(ctx, user._id, fecha);

      const executionId = await upsertExecutionImpl(ctx, {
        sessionId,
        pacienteId: user._id,
        planId,
        clinicId,
        fecha,
        entrada,
      });
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

/**
 * Aplica feedback (dolor/esfuerzo/nota) a `exerciseExecutions` ya existentes
 * y recomputa los agregados de cada sesión afectada una sola vez al final.
 *
 * Diseñado para el cierre de la sesión cuando el frontend ya insertó las
 * executions al instante (sin feedback) y ahora aplica los datos del paciente
 * en un solo round-trip. Convex ejecuta la mutation en una transacción, así
 * que si una entrada falla, todas las anteriores se revierten.
 */
export const applyFeedbackBatch = mutation({
  args: {
    entradas: v.array(
      v.object({
        executionId: v.id("exerciseExecutions"),
        dolorEscala: v.optional(v.number()),
        esfuerzoEscala: v.optional(v.number()),
        notaPaciente: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Id<"exerciseExecutions">[]> => {
    const user = await getAuthenticatedUser(ctx);
    if (args.entradas.length === 0) return [];

    const sesionesAfectadas = new Set<Id<"sessions">>();
    const ids: Id<"exerciseExecutions">[] = [];

    for (const entrada of args.entradas) {
      const execution = await ctx.db.get(entrada.executionId);
      if (!execution) {
        throw new Error(`execution no encontrada: ${entrada.executionId}`);
      }
      if (execution.pacienteId !== user._id) {
        throw new Error(
          `unauthorized: execution ${entrada.executionId} no pertenece al paciente autenticado`,
        );
      }

      const tieneNotaPrevia = !!execution.notaPaciente?.trim();
      const notaNueva = !tieneNotaPrevia && !!entrada.notaPaciente?.trim();

      const patch: {
        dolorEscala?: number;
        esfuerzoEscala?: number;
        notaPaciente?: string;
      } = {};
      if (entrada.dolorEscala !== undefined) patch.dolorEscala = entrada.dolorEscala;
      if (entrada.esfuerzoEscala !== undefined) patch.esfuerzoEscala = entrada.esfuerzoEscala;
      if (entrada.notaPaciente !== undefined) patch.notaPaciente = entrada.notaPaciente;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(entrada.executionId, patch);
      }

      sesionesAfectadas.add(execution.sessionId);
      ids.push(entrada.executionId);

      // Alerta de comentario solo si la nota es nueva y la execution está
      // marcada como completada. `createCommentAlert` ya es idempotente por
      // `exerciseExecutionId`, pero comprobamos aquí para evitar el round-trip.
      if (notaNueva && execution.completado) {
        await ctx.runMutation(internal.alerts.internal.createCommentAlert, {
          pacienteId: user._id,
          sessionId: execution.sessionId,
          exerciseExecutionId: entrada.executionId,
          texto: entrada.notaPaciente!,
        });
      }
    }

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

  const fecha = enforceMadridFecha(pacienteId, args.fecha);

  const sessionId = await openOrResumeImpl(ctx, pacienteId, fecha);

  const executionId = await upsertExecutionImpl(ctx, {
    sessionId,
    pacienteId,
    planId,
    clinicId,
    fecha,
    entrada: args,
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

