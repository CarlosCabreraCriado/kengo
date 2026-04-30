import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { batchGetMap } from "../_helpers/batchGet";
import { getDiaSemana, getMadridDateOffset } from "../_helpers/datetime";
import { getExpectedExercisesForPatientOnDate } from "../_helpers/expectedExercises";

function resolvePacienteId(
  pacienteId: string | undefined,
  fallbackUserId: Id<"users">,
): Id<"users"> {
  if (!pacienteId) return fallbackUserId;
  return pacienteId as Id<"users">;
}

function fullName(user: any): string {
  if (!user) return "";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

// Adjunta `pacienteNombre`/`fisioNombre` derivados al vuelo. Sustituye a la
// denormalización previa en schema.
async function attachUserNames(ctx: any, plans: any[]) {
  const userIds = [
    ...plans.map((p) => p.pacienteId),
    ...plans.map((p) => p.fisioId),
  ];
  const usersMap = await batchGetMap<"users">(ctx, userIds);
  return plans.map((p) => ({
    ...p,
    pacienteNombre: fullName(usersMap.get(p.pacienteId)),
    fisioNombre: fullName(usersMap.get(p.fisioId)),
  }));
}

// Carga los planExercises de cada plan + el catálogo de exercises asociado
// en lote, evitando el patrón N+1 anterior (1 query por plan + 1 por ejercicio).
async function enrichPlans(ctx: any, plans: any[]) {
  const allPlanExercises = await Promise.all(
    plans.map((p) =>
      ctx.db
        .query("planExercises")
        .withIndex("by_planId_sort", (q: any) => q.eq("planId", p._id))
        .collect(),
    ),
  );

  const exerciseIds = allPlanExercises
    .flat()
    .map((pe: any) => pe.exerciseId)
    .filter(Boolean);
  const userIds = [
    ...plans.map((p) => p.pacienteId),
    ...plans.map((p) => p.fisioId),
  ];
  const [exercisesMap, usersMap] = await Promise.all([
    batchGetMap<"exercises">(ctx, exerciseIds),
    batchGetMap<"users">(ctx, userIds),
  ]);

  return plans.map((plan, i) => {
    const ejercicios = (allPlanExercises[i] ?? []).map((pe: any) => {
      const exercise = pe.exerciseId
        ? exercisesMap.get(pe.exerciseId) ?? null
        : null;
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
    });
    return {
      ...plan,
      ejercicios,
      pacienteNombre: fullName(usersMap.get(plan.pacienteId)),
      fisioNombre: fullName(usersMap.get(plan.fisioId)),
    };
  });
}

async function enrichPlan(ctx: any, plan: any) {
  const [enriched] = await enrichPlans(ctx, [plan]);
  return enriched;
}

async function loadPlanExercises(ctx: any, planId: any) {
  const exercises = await ctx.db
    .query("planExercises")
    .withIndex("by_planId_sort", (q: any) => q.eq("planId", planId))
    .collect();
  const exerciseIds = exercises
    .map((pe: any) => pe.exerciseId)
    .filter(Boolean);
  const exercisesMap = await batchGetMap<"exercises">(ctx, exerciseIds);
  return exercises.map((pe: any) => {
    const exercise = pe.exerciseId
      ? exercisesMap.get(pe.exerciseId) ?? null
      : null;
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
  });
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

    let plans;
    if (args.estado) {
      plans = await ctx.db
        .query("plans")
        .withIndex("by_fisioId_estado", (q) =>
          q.eq("fisioId", user._id).eq("estado", args.estado!),
        )
        .collect();
    } else {
      const all = await ctx.db
        .query("plans")
        .withIndex("by_fisioId", (q) => q.eq("fisioId", user._id))
        .collect();
      plans = all.filter((p) => p.estado !== "cancelado");
    }
    return await attachUserNames(ctx, plans);
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

    let plans;
    if (args.estado) {
      plans = await ctx.db
        .query("plans")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", targetId).eq("estado", args.estado!),
        )
        .collect();
    } else {
      const all = await ctx.db
        .query("plans")
        .withIndex("by_pacienteId", (q) => q.eq("pacienteId", targetId))
        .collect();
      plans = all.filter((p) => p.estado !== "cancelado");
    }
    return await attachUserNames(ctx, plans);
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

    return await enrichPlans(ctx, filtered);
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

    return await enrichPlans(ctx, filtered);
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

// ─── GET NEXT SESSION FOR PATIENT ───

export const getNextSessionForPatient = query({
  args: {
    pacienteId: v.optional(v.string()),
    maxDaysLookahead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = resolvePacienteId(args.pacienteId, user._id);
    const lookahead = args.maxDaysLookahead ?? 30;

    for (let offset = 1; offset <= lookahead; offset++) {
      const fecha = getMadridDateOffset(offset);
      const diaSemana = getDiaSemana(fecha);
      const expected = await getExpectedExercisesForPatientOnDate(
        ctx,
        targetId,
        fecha,
        diaSemana,
      );
      if (expected.length === 0) continue;

      const planIds = Array.from(new Set(expected.map((e) => e.planId)));
      const planes = await Promise.all(planIds.map((id) => ctx.db.get(id)));
      const planConFechaMasAntigua = planes
        .filter((p): p is Doc<"plans"> => p !== null)
        .sort((a, b) =>
          (a.fechaInicio ?? "").localeCompare(b.fechaInicio ?? ""),
        )[0];

      const totalEjercicios = expected.reduce(
        (acc, e) => acc + e.vecesDia,
        0,
      );

      return {
        fecha,
        diaSemana,
        planTitulo: planConFechaMasAntigua?.titulo ?? null,
        totalEjercicios,
      };
    }
    return null;
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
