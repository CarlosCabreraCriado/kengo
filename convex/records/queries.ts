import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

async function resolvePacienteId(
  ctx: any,
  pacienteIdOrUuid: string | undefined,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteIdOrUuid) return fallbackUserId;
  if (!pacienteIdOrUuid.includes("-")) {
    return pacienteIdOrUuid as Id<"users">;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyDirectusId", (q: any) =>
      q.eq("legacyDirectusId", pacienteIdOrUuid),
    )
    .unique();
  return user?._id ?? fallbackUserId;
}

export const listByPacienteAndDate = query({
  args: {
    pacienteId: v.optional(v.string()),
    fecha: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    return await ctx.db
      .query("planRecords")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();
  },
});

/**
 * Lista registros de un paciente entre dos fechas (inclusivas).
 * Si no se proporciona `hasta`, devuelve hasta hoy.
 * Reemplaza GET /directus/items/planes_registros con filtro fecha_hora rango.
 */
export const listByPacienteInRange = query({
  args: {
    pacienteId: v.optional(v.string()),
    desde: v.string(),
    hasta: v.optional(v.string()),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    const hasta = args.hasta ?? new Date().toISOString().split("T")[0]!;

    const records = await ctx.db
      .query("planRecords")
      .withIndex("by_pacienteId_fecha", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("fecha", args.desde)
          .lte("fecha", hasta),
      )
      .collect();

    if (args.soloCompletados) {
      return records.filter((r) => r.completado);
    }
    return records;
  },
});

/**
 * Lista registros de un paciente en una fecha con planExercise + exercise + plan
 * embebidos. Reemplaza GET /directus/items/planes_registros con expand fields.
 */
export const listByPacienteAndDateExpanded = query({
  args: {
    pacienteId: v.optional(v.string()),
    fecha: v.string(),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    const records = await ctx.db
      .query("planRecords")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).eq("fecha", args.fecha),
      )
      .collect();

    const filtered = args.soloCompletados
      ? records.filter((r) => r.completado)
      : records;

    const expanded = await Promise.all(
      filtered.map(async (r) => {
        const planExercise = r.planExerciseId
          ? await ctx.db.get(r.planExerciseId)
          : null;
        const exercise = planExercise?.exerciseId
          ? await ctx.db.get(planExercise.exerciseId)
          : null;
        const plan = planExercise?.planId
          ? await ctx.db.get(planExercise.planId)
          : null;

        return {
          _id: r._id,
          fechaHora: r.fechaHora,
          completado: r.completado,
          repeticionesRealizadas: r.repeticionesRealizadas,
          duracionRealSeg: r.duracionRealSeg,
          dolorEscala: r.dolorEscala,
          esfuerzoEscala: r.esfuerzoEscala,
          notaPaciente: r.notaPaciente,
          planExercise: planExercise
            ? {
                _id: planExercise._id,
                legacyId: planExercise.legacyId,
                sort: planExercise.sort,
                series: planExercise.series,
                repeticiones: planExercise.repeticiones,
                duracionSeg: planExercise.duracionSeg,
                instruccionesPaciente: planExercise.instruccionesPaciente,
                exercise: exercise
                  ? {
                      _id: exercise._id,
                      legacyId: exercise.legacyId,
                      nombreEjercicio: exercise.nombreEjercicio,
                      portada: exercise.portada,
                    }
                  : null,
                plan: plan
                  ? {
                      _id: plan._id,
                      legacyId: plan.legacyId,
                      titulo: plan.titulo,
                    }
                  : null,
              }
            : null,
        };
      }),
    );

    return expanded;
  },
});

/**
 * Lista registros de un paciente desde una fecha hasta hoy.
 * Variante conveniente para gráficas de actividad.
 */
export const listByPacienteSinceDate = query({
  args: {
    pacienteId: v.optional(v.string()),
    desde: v.string(),
    soloCompletados: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetUserId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    const records = await ctx.db
      .query("planRecords")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", targetUserId).gte("fecha", args.desde),
      )
      .collect();

    if (args.soloCompletados) {
      return records.filter((r) => r.completado);
    }
    return records;
  },
});
