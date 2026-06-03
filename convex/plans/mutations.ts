import { v } from "convex/values";
import { mutation } from "../_helpers/mutationWithTriggers";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  PUESTOS_GESTION,
  requireActiveSubscription,
} from "../_helpers/permissions";
import {
  assertCanAccessClinic,
  getPlanIfOwned,
} from "../_helpers/authorization";
import { diaSemana } from "../_helpers/validators";
import { getCurrentMadridDate } from "../_helpers/datetime";
import { _purgeAggregatesForInactivePatient } from "../snapshots/internal";

// Encola una push al paciente avisando de que tiene un plan nuevo o
// recién activado. Llamar SOLO cuando el plan pase a `estado === "activo"`
// (visible para el paciente). Idempotencia: el cliente decide su deep-link
// vía `data.type = "new_plan"`.
async function schedulePushNuevoPlan(
  ctx: any,
  pacienteId: Id<"users">,
  planId: Id<"plans">,
  titulo: string,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.push.actions.sendPushToUser, {
    userId: pacienteId,
    title: "Nuevo plan disponible",
    body: titulo.trim() || "Tu fisio te ha asignado un nuevo plan",
    data: {
      type: "new_plan",
      planId,
    },
    notificationKey: "newPlan",
  });
}

// Refresca el snapshot agregado de la clínica tras un cambio en planes:
// el conteo `pacientesActivos` depende de la combinación estado+fechas, así
// que cualquier mutación de plan que toque esos campos debe encolar este
// recompute para que el KPI del dashboard del fisio quede sincronizado con
// el listado de pacientes sin esperar al cron diario.
async function scheduleRecomputeClinic(
  ctx: any,
  clinicId: Id<"clinics">,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.snapshots.internal.recomputeClinic, {
    clinicId,
  });
}

const ejercicioPlanArgs = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  series: v.optional(v.number()),
  repeticiones: v.optional(v.number()),
  duracionSeg: v.optional(v.number()),
  descansoSeg: v.optional(v.number()),
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
    diasSemana?: string[];
    instruccionesPaciente?: string;
    notasFisio?: string;
  }>,
) {
  for (const ej of ejercicios) {
    await ctx.db.insert("planExercises", {
      planId,
      exerciseId: ej.exerciseId,
      sort: ej.sort,
      series: ej.series,
      repeticiones: ej.repeticiones,
      duracionSeg: ej.duracionSeg,
      descansoSeg: ej.descansoSeg,
      diasSemana: ej.diasSemana,
      instruccionesPaciente: ej.instruccionesPaciente,
      notasFisio: ej.notasFisio,
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
    clinicId: v.id("clinics"),
    fechaInicio: v.optional(v.string()),
    fechaFin: v.optional(v.string()),
    ejercicios: v.array(ejercicioPlanArgs),
  },
  handler: async (ctx, args) => {
    const fisio = await getAuthenticatedUser(ctx);

    await assertCanAccessClinic(ctx, fisio._id, args.clinicId, PUESTOS_GESTION);

    const pacienteMembership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", args.pacienteId).eq("clinicId", args.clinicId),
      )
      .unique();
    if (!pacienteMembership || pacienteMembership.puesto !== "paciente") {
      throw new Error(
        "El paciente no pertenece a la clínica indicada como paciente.",
      );
    }

    await requireActiveSubscription(ctx, args.clinicId);

    const paciente = await ctx.db.get(args.pacienteId);
    if (!paciente) throw new Error("Paciente no encontrado");

    const today = getCurrentMadridDate();
    const estadoInicial: "activo" | "borrador" =
      args.fechaInicio && args.fechaFin && args.fechaFin >= today
        ? "activo"
        : "borrador";

    const planId = await ctx.db.insert("plans", {
      titulo: args.titulo,
      descripcion: args.descripcion,
      estado: estadoInicial,
      fechaInicio: args.fechaInicio,
      fechaFin: args.fechaFin,
      pacienteId: args.pacienteId,
      fisioId: fisio._id,
      clinicId: args.clinicId,
      version: 1,
    });

    await insertPlanExercises(ctx, planId, args.ejercicios);

    if (estadoInicial === "activo") {
      await schedulePushNuevoPlan(ctx, args.pacienteId, planId, args.titulo);
      await scheduleRecomputeClinic(ctx, args.clinicId);
    }

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
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado");
    if (plan.estado === "modificado") {
      throw new Error(
        "Este plan es una versión histórica y no se puede modificar.",
      );
    }
    await requireActiveSubscription(ctx, plan.clinicId);
    if (args.estado === "activo") {
      if (!plan.fechaInicio || !plan.fechaFin) {
        throw new Error(
          "Un plan activo requiere fechaInicio y fechaFin definidas.",
        );
      }
    }
    const estadoAnterior = plan.estado;
    await ctx.db.patch(args.planId, { estado: args.estado });

    if (args.estado === "activo" && estadoAnterior !== "activo") {
      await schedulePushNuevoPlan(
        ctx,
        plan.pacienteId,
        args.planId,
        plan.titulo,
      );
    }
    if (estadoAnterior !== args.estado) {
      await _purgeAggregatesForInactivePatient(
        ctx,
        plan.pacienteId,
        plan.clinicId,
      );
      await scheduleRecomputeClinic(ctx, plan.clinicId);
    }
  },
});

async function planHasActivity(ctx: any, planId: any): Promise<boolean> {
  const anyExecution = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_planId", (q: any) => q.eq("planId", planId))
    .first();
  return anyExecution !== null;
}

// ─── UPDATE (metadata siempre; ejercicios solo si no hay actividad) ───

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
    await getAuthenticatedUser(ctx);
    const plan = await getPlanIfOwned(ctx, args.planId);
    if (plan.estado === "modificado") {
      throw new Error(
        "Este plan es una versión histórica y no se puede editar.",
      );
    }
    await requireActiveSubscription(ctx, plan.clinicId);

    if (args.ejercicios) {
      if (await planHasActivity(ctx, args.planId)) {
        throw new Error(
          "El plan tiene registros del paciente. Crea una nueva versión en lugar de editarlo.",
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (args.titulo !== undefined) patch["titulo"] = args.titulo;
    if (args.descripcion !== undefined) patch["descripcion"] = args.descripcion;
    if (args.fechaInicio !== undefined) patch["fechaInicio"] = args.fechaInicio;
    if (args.fechaFin !== undefined) patch["fechaFin"] = args.fechaFin;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.planId, patch);
    }

    if (args.ejercicios) {
      await deletePlanExercises(ctx, args.planId);
      await insertPlanExercises(ctx, args.planId, args.ejercicios);
    }

    if (args.fechaInicio !== undefined || args.fechaFin !== undefined) {
      await scheduleRecomputeClinic(ctx, plan.clinicId);
    }

    return args.planId;
  },
});

// ─── REMOVE ───
// Si el plan tiene actividad, soft-delete (cancelado) para preservar history.
// Sin actividad, hard-delete con cascade de planExercises.

export const remove = mutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const plan = await getPlanIfOwned(ctx, args.planId);
    if (plan.estado === "modificado") {
      throw new Error(
        "Este plan es una versión histórica y no se puede eliminar.",
      );
    }
    await requireActiveSubscription(ctx, plan.clinicId);

    const exercises = await ctx.db
      .query("planExercises")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .collect();

    if (await planHasActivity(ctx, args.planId)) {
      await ctx.db.patch(args.planId, { estado: "cancelado" });
      await _purgeAggregatesForInactivePatient(
        ctx,
        plan.pacienteId,
        plan.clinicId,
      );
      await scheduleRecomputeClinic(ctx, plan.clinicId);
      return { softDeleted: true };
    }

    for (const ex of exercises) {
      await ctx.db.delete(ex._id);
    }
    await ctx.db.delete(args.planId);
    await _purgeAggregatesForInactivePatient(
      ctx,
      plan.pacienteId,
      plan.clinicId,
    );
    await scheduleRecomputeClinic(ctx, plan.clinicId);
    return { softDeleted: false };
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
    const oldPlan = await getPlanIfOwned(ctx, args.oldPlanId, user._id);
    await requireActiveSubscription(ctx, oldPlan.clinicId);

    const today = new Date().toISOString().split("T")[0]!;

    // Marcar el plan anterior como "modificado": indica que fue reemplazado
    // por una nueva versión (no que se completó naturalmente).
    await ctx.db.patch(args.oldPlanId, {
      estado: "modificado" as const,
      fechaFin: oldPlan.fechaFin ?? today,
    });

    // Create new plan — hereda la clínica del anterior.
    const newPlanId = await ctx.db.insert("plans", {
      titulo: args.titulo,
      descripcion: args.descripcion,
      estado: "activo",
      fechaInicio: args.fechaInicio ?? today,
      fechaFin: args.fechaFin,
      pacienteId: oldPlan.pacienteId,
      fisioId: user._id,
      clinicId: oldPlan.clinicId,
      version: (oldPlan.version ?? 1) + 1,
      planAnterior: args.oldPlanId,
    });

    // Cierra el enlace bidireccional: el plan modificado apunta a su sucesor.
    await ctx.db.patch(args.oldPlanId, { planSucesor: newPlanId });

    await insertPlanExercises(ctx, newPlanId, args.ejercicios);

    await schedulePushNuevoPlan(
      ctx,
      oldPlan.pacienteId,
      newPlanId,
      args.titulo,
    );
    // Aunque version() siempre crea un plan activo nuevo (no-op esperado),
    // se invoca por consistencia con el resto de mutations que tocan
    // plans.estado. El check interno devuelve purgadas: 0.
    await _purgeAggregatesForInactivePatient(
      ctx,
      oldPlan.pacienteId,
      oldPlan.clinicId,
    );
    await scheduleRecomputeClinic(ctx, oldPlan.clinicId);

    return newPlanId;
  },
});
