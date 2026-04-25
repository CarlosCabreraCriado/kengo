import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";

const diaSemana = v.union(
  v.literal("L"),
  v.literal("M"),
  v.literal("X"),
  v.literal("J"),
  v.literal("V"),
  v.literal("S"),
  v.literal("D"),
);

const ejercicioPlanArgs = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  series: v.optional(v.number()),
  repeticiones: v.optional(v.number()),
  duracionSeg: v.optional(v.number()),
  descansoSeg: v.optional(v.number()),
  vecesDia: v.optional(v.number()),
  diasSemana: v.optional(v.array(diaSemana)),
  instruccionesPaciente: v.optional(v.string()),
  notasFisio: v.optional(v.string()),
});

async function insertPlanExercises(
  ctx: any,
  planId: any,
  ejercicios: Array<{
    exerciseId: any;
    sort: number;
    series?: number;
    repeticiones?: number;
    duracionSeg?: number;
    descansoSeg?: number;
    vecesDia?: number;
    diasSemana?: string[];
    instruccionesPaciente?: string;
    notasFisio?: string;
  }>,
) {
  for (const ej of ejercicios) {
    const exerciseDoc = await ctx.db.get(ej.exerciseId);
    await ctx.db.insert("planExercises", {
      planId,
      exerciseId: ej.exerciseId,
      sort: ej.sort,
      series: ej.series,
      repeticiones: ej.repeticiones,
      duracionSeg: ej.duracionSeg,
      descansoSeg: ej.descansoSeg,
      vecesDia: ej.vecesDia,
      diasSemana: ej.diasSemana,
      instruccionesPaciente: ej.instruccionesPaciente,
      notasFisio: ej.notasFisio,
      ejercicioNombre: exerciseDoc?.nombreEjercicio,
    });
  }
}

async function deletePlanExercises(ctx: any, planId: any) {
  const exercises = await ctx.db
    .query("planExercises")
    .withIndex("by_planId", (q: any) => q.eq("planId", planId))
    .collect();

  for (const ex of exercises) {
    await ctx.db.delete(ex._id);
  }

  return exercises;
}

// ─── CREATE ───

export const create = mutation({
  args: {
    titulo: v.string(),
    descripcion: v.optional(v.string()),
    pacienteId: v.id("users"),
    fechaInicio: v.optional(v.string()),
    fechaFin: v.optional(v.string()),
    ejercicios: v.array(ejercicioPlanArgs),
  },
  handler: async (ctx, args) => {
    const fisio = await getAuthenticatedUser(ctx);
    const paciente = await ctx.db.get(args.pacienteId);
    if (!paciente) throw new Error("Paciente no encontrado");

    const planId = await ctx.db.insert("plans", {
      titulo: args.titulo,
      descripcion: args.descripcion,
      estado: "borrador",
      fechaInicio: args.fechaInicio,
      fechaFin: args.fechaFin,
      pacienteId: args.pacienteId,
      fisioId: fisio._id,
      version: 1,
      pacienteNombre: `${paciente.firstName} ${paciente.lastName}`,
      fisioNombre: `${fisio.firstName} ${fisio.lastName}`,
    });

    await insertPlanExercises(ctx, planId, args.ejercicios);
    return planId;
  },
});

// ─── UPDATE ESTADO ───

export const updateEstado = mutation({
  args: {
    planId: v.id("plans"),
    estado: v.union(
      v.literal("borrador"),
      v.literal("activo"),
      v.literal("completado"),
      v.literal("cancelado"),
    ),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.patch(args.planId, { estado: args.estado });
  },
});

// ─── UPDATE (full edit: metadata + exercises replace) ───

export const update = mutation({
  args: {
    planId: v.id("plans"),
    titulo: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    fechaInicio: v.optional(v.string()),
    fechaFin: v.optional(v.string()),
    ejercicios: v.optional(v.array(ejercicioPlanArgs)),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado");

    // Ownership check
    if (plan.fisioId !== user._id) {
      throw new Error("No tienes permisos para editar este plan");
    }

    // Patch metadata
    const patch: Record<string, unknown> = {};
    if (args.titulo !== undefined) patch["titulo"] = args.titulo;
    if (args.descripcion !== undefined) patch["descripcion"] = args.descripcion;
    if (args.fechaInicio !== undefined) patch["fechaInicio"] = args.fechaInicio;
    if (args.fechaFin !== undefined) patch["fechaFin"] = args.fechaFin;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.planId, patch);
    }

    // Replace exercises if provided
    if (args.ejercicios) {
      await deletePlanExercises(ctx, args.planId);
      await insertPlanExercises(ctx, args.planId, args.ejercicios);
    }

    return args.planId;
  },
});

// ─── REMOVE (cascade delete: records → exercises → plan) ───

export const remove = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    // Get all exercises for this plan
    const exercises = await ctx.db
      .query("planExercises")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .collect();

    // Delete records for each exercise
    for (const ex of exercises) {
      const records = await ctx.db
        .query("planRecords")
        .withIndex("by_planExerciseId", (q) => q.eq("planExerciseId", ex._id))
        .collect();
      for (const rec of records) {
        await ctx.db.delete(rec._id);
      }
      await ctx.db.delete(ex._id);
    }

    // Delete the plan
    await ctx.db.delete(args.planId);
  },
});

// ─── VERSION (archive old + create new with exercises) ───

export const version = mutation({
  args: {
    oldPlanId: v.id("plans"),
    titulo: v.string(),
    descripcion: v.optional(v.string()),
    fechaInicio: v.optional(v.string()),
    fechaFin: v.optional(v.string()),
    ejercicios: v.array(ejercicioPlanArgs),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const oldPlan = await ctx.db.get(args.oldPlanId);
    if (!oldPlan) throw new Error("Plan original no encontrado");
    if (oldPlan.fisioId !== user._id) {
      throw new Error("No tienes permisos para versionar este plan");
    }

    const today = new Date().toISOString().split("T")[0]!;

    // Archive old plan
    await ctx.db.patch(args.oldPlanId, {
      estado: "completado" as const,
      fechaFin: oldPlan.fechaFin ?? today,
    });

    // Create new plan
    const newPlanId = await ctx.db.insert("plans", {
      titulo: args.titulo,
      descripcion: args.descripcion,
      estado: "activo",
      fechaInicio: args.fechaInicio ?? today,
      fechaFin: args.fechaFin,
      pacienteId: oldPlan.pacienteId,
      fisioId: user._id,
      version: (oldPlan.version ?? 1) + 1,
      planAnterior: args.oldPlanId,
      pacienteNombre: oldPlan.pacienteNombre,
      fisioNombre: `${user.firstName} ${user.lastName}`,
    });

    await insertPlanExercises(ctx, newPlanId, args.ejercicios);
    return newPlanId;
  },
});
