import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

function resolvePacienteId(
  pacienteId: string | undefined,
  fallbackUserId: Id<"users">,
): Id<"users"> {
  if (!pacienteId) return fallbackUserId;
  return pacienteId as Id<"users">;
}

// Helper: embed exercise data (nombre, descripción, portada, video) en un planExercise
async function enrichPlanExercise(ctx: any, pe: any) {
  const exercise = pe.exerciseId ? await ctx.db.get(pe.exerciseId) : null;
  return {
    ...pe,
    ejercicio: exercise
      ? {
          _id: exercise._id,
          nombreEjercicio: exercise.nombreEjercicio,
          descripcion: exercise.descripcion,
          portada: exercise.portada,
          video: exercise.video,
        }
      : null,
  };
}

// Helper: load exercises for a plan, sorted by sort field, embebiendo datos del ejercicio
async function loadPlanExercises(ctx: any, planId: any) {
  const exercises = await ctx.db
    .query("planExercises")
    .withIndex("by_planId_sort", (q: any) => q.eq("planId", planId))
    .collect();
  return await Promise.all(exercises.map((pe: any) => enrichPlanExercise(ctx, pe)));
}

// Helper: enrich plan with exercises array
async function enrichPlan(ctx: any, plan: any) {
  const exercises = await loadPlanExercises(ctx, plan._id);
  return { ...plan, ejercicios: exercises };
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ─── LIST BY FISIO ───

export const listByFisio = query({
  args: {
    estado: v.optional(
      v.union(
        v.literal("borrador"),
        v.literal("activo"),
        v.literal("completado"),
        v.literal("cancelado"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    if (args.estado) {
      return await ctx.db
        .query("plans")
        .withIndex("by_fisioId_estado", (q) =>
          q.eq("fisioId", user._id).eq("estado", args.estado!),
        )
        .collect();
    }

    const all = await ctx.db
      .query("plans")
      .withIndex("by_fisioId", (q) => q.eq("fisioId", user._id))
      .collect();
    return all.filter((p) => p.estado !== "cancelado");
  },
});

// ─── LIST BY PACIENTE ───

export const listByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    estado: v.optional(
      v.union(
        v.literal("borrador"),
        v.literal("activo"),
        v.literal("completado"),
        v.literal("cancelado"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = resolvePacienteId(args.pacienteId, user._id);

    if (args.estado) {
      return await ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", targetId).eq("estado", args.estado!),
        )
        .collect();
    }

    const all = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", targetId))
      .collect();
    return all.filter((p) => p.estado !== "cancelado");
  },
});

// ─── GET BY ID (with exercises) ───

export const getById = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan) return null;
    return enrichPlan(ctx, plan);
  },
});

// ─── GET ACTIVE PLANS FOR PATIENT TODAY ───

export const getActiveForPatientToday = query({
  args: {
    pacienteId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = resolvePacienteId(args.pacienteId, user._id);
    const today = getTodayString();

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", targetId).eq("estado", "activo"),
      )
      .collect();

    const filtered = activePlans.filter((p) => {
      if (p.fechaInicio && p.fechaInicio > today) return false;
      if (p.fechaFin && p.fechaFin < today) return false;
      return true;
    });

    const results = [];
    for (const plan of filtered) {
      results.push(await enrichPlan(ctx, plan));
    }
    return results;
  },
});

// ─── GET ACTIVE AND FUTURE PLANS ───

export const getActiveAndFuture = query({
  args: {
    pacienteId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = resolvePacienteId(args.pacienteId, user._id);
    const today = getTodayString();

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", targetId).eq("estado", "activo"),
      )
      .collect();

    const filtered = activePlans.filter((p) => {
      if (p.fechaFin && p.fechaFin < today) return false;
      return true;
    });

    const results = [];
    for (const plan of filtered) {
      results.push(await enrichPlan(ctx, plan));
    }
    return results;
  },
});

// ─── LIST EXERCISES BY PLAN ID (con datos de ejercicio embebidos) ───

export const listExercisesByPlanId = query({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    return await loadPlanExercises(ctx, args.planId);
  },
});

// ─── CHECK PLAN HAS ACTIVITY ───

export const checkPlanHasActivity = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("planExercises")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .collect();

    for (const ex of exercises) {
      const execution = await ctx.db
        .query("exerciseExecutions")
        .withIndex("by_planExerciseId", (q) => q.eq("planExerciseId", ex._id))
        .first();
      if (execution) return true;
    }

    return false;
  },
});
