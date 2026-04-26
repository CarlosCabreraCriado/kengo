import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

// Helper: resolve a pacienteId that may be a Convex ID or a legacy UUID
async function resolvePacienteId(
  ctx: any,
  pacienteIdOrUuid: string | undefined,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteIdOrUuid) return fallbackUserId;

  // If it looks like a Convex ID (contains table prefix), use directly
  // Convex IDs are like "k17abc..." while UUIDs are "xxxxxxxx-xxxx-..."
  if (!pacienteIdOrUuid.includes("-")) {
    return pacienteIdOrUuid as Id<"users">;
  }

  // It's a legacy UUID — resolve via legacyDirectusId index
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyDirectusId", (q: any) =>
      q.eq("legacyDirectusId", pacienteIdOrUuid),
    )
    .unique();

  return user?._id ?? fallbackUserId;
}

// Helper: embed exercise data (nombre, descripción, portada, video) en un planExercise
async function enrichPlanExercise(ctx: any, pe: any) {
  const exercise = pe.exerciseId ? await ctx.db.get(pe.exerciseId) : null;
  return {
    ...pe,
    ejercicio: exercise
      ? {
          _id: exercise._id,
          legacyId: exercise.legacyId,
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
    const targetId = await resolvePacienteId(ctx, args.pacienteId, user._id);

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

// ─── GET BY LEGACY ID (with exercises) ───

export const getByLegacyId = query({
  args: { legacyId: v.number() },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();
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
    const targetId = await resolvePacienteId(ctx, args.pacienteId, user._id);
    const today = getTodayString();

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", targetId).eq("estado", "activo"),
      )
      .collect();

    // Filter by date: fechaInicio <= today AND fechaFin >= today
    const filtered = activePlans.filter((p) => {
      if (p.fechaInicio && p.fechaInicio > today) return false;
      if (p.fechaFin && p.fechaFin < today) return false;
      return true;
    });

    // Enrich with exercises
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
    const targetId = await resolvePacienteId(ctx, args.pacienteId, user._id);
    const today = getTodayString();

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", targetId).eq("estado", "activo"),
      )
      .collect();

    // Filter: fechaFin >= today (or no end date)
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
    planId: v.optional(v.id("plans")),
    planLegacyId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let planId: Id<"plans"> | null = args.planId ?? null;
    if (!planId && args.planLegacyId !== undefined) {
      const plan = await ctx.db
        .query("plans")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", args.planLegacyId))
        .unique();
      planId = plan?._id ?? null;
    }
    if (!planId) return [];

    return await loadPlanExercises(ctx, planId!);
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
      const record = await ctx.db
        .query("planRecords")
        .withIndex("by_planExerciseId", (q) => q.eq("planExerciseId", ex._id))
        .first();
      if (record) return true;
    }

    return false;
  },
});
