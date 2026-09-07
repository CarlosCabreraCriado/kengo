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
  assertCanManagePlan,
} from "../_helpers/authorization";
import { membershipEsPaciente } from "../_helpers/patientAccess";
import { diaSemana, tipoEjercicio } from "../_helpers/validators";
import { normalizarMetricaEjercicio } from "../_helpers/exercises";
import { getCurrentDateInTz } from "../_helpers/datetime";
import { getPatientTz, tzOf } from "../_helpers/patientTz";
import { computeVersionDates } from "../_helpers/planVersioning";
import {
  afterPlanChainChange,
  repairBrokenChain,
} from "../_helpers/planChainRepair";
import { _syncPatientActiveStateInClinic } from "../snapshots/internal";

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

const ejercicioPlanArgs = v.object({
  exerciseId: v.id("exercises"),
  sort: v.number(),
  tipo: v.optional(tipoEjercicio),
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
    tipo?: "repeticiones" | "duracion";
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
    const { repeticiones, duracionSeg } = normalizarMetricaEjercicio(ej);
    await ctx.db.insert("planExercises", {
      planId,
      exerciseId: ej.exerciseId,
      sort: ej.sort,
      tipo: ej.tipo,
      series: ej.series,
      repeticiones,
      duracionSeg,
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
    if (!membershipEsPaciente(pacienteMembership)) {
      throw new Error(
        "El paciente no pertenece a la clínica indicada como paciente.",
      );
    }

    await requireActiveSubscription(ctx, args.clinicId);

    const paciente = await ctx.db.get(args.pacienteId);
    if (!paciente) throw new Error("Paciente no encontrado");

    // Activación evaluada en el día del PACIENTE (su TZ, fallback Madrid).
    const today = getCurrentDateInTz(tzOf(paciente));
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
      await _syncPatientActiveStateInClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
      );
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
    const user = await getAuthenticatedUser(ctx);
    const plan = await assertCanManagePlan(ctx, user._id, args.planId);
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
      await _syncPatientActiveStateInClinic(
        ctx,
        plan.pacienteId,
        plan.clinicId,
      );
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
    const user = await getAuthenticatedUser(ctx);
    const plan = await assertCanManagePlan(ctx, user._id, args.planId);
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
      // Cambiar fechas puede mover al paciente dentro/fuera de "en curso"
      // según `isPlanEnCurso(plan, hoyMadrid)`. Sincroniza el aggregate
      // `patientsWithActivePlanByClinic` para que `pacientesActivos` quede
      // coherente sin esperar al sweep diario.
      await _syncPatientActiveStateInClinic(
        ctx,
        plan.pacienteId,
        plan.clinicId,
      );
    }

    return args.planId;
  },
});

// ─── REMOVE ───
// Si el plan tiene actividad, soft-delete (cancelado) para preservar history.
// Sin actividad, hard-delete con cascade de planExercises.
//
// Si el plan es una versión sucesora (tiene `planAnterior`), eliminarlo
// DESHACE el versionado: el predecesor (que quedó `modificado` y apuntando a
// este plan) recupera su fechaFin previa y vuelve a `activo`/`completado`
// según la fecha. Sin esto el predecesor quedaba huérfano: oculto en todos
// los listados e inmutable (ver `_helpers/planChainRepair.ts`).

export const remove = mutation({
  args: { planId: v.id("plans") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    softDeleted: boolean;
    predecesorRestaurado: Id<"plans"> | null;
  }> => {
    const user = await getAuthenticatedUser(ctx);
    const plan = await assertCanManagePlan(ctx, user._id, args.planId);
    if (plan.estado === "modificado") {
      throw new Error(
        "Este plan es una versión histórica y no se puede eliminar.",
      );
    }
    await requireActiveSubscription(ctx, plan.clinicId);

    const today = getCurrentDateInTz(
      await getPatientTz(ctx, plan.pacienteId),
    );

    // Leer el predecesor ANTES de borrar: solo se restaura si la cadena es
    // la esperada (predecesor `modificado` que apunta a este plan).
    const pred = plan.planAnterior
      ? await ctx.db.get(plan.planAnterior)
      : null;
    const restauraPred =
      !!pred &&
      pred.estado === "modificado" &&
      pred.planSucesor === plan._id;
    if (pred && !restauraPred) {
      console.warn(
        `[plans.remove] predecesor ${pred._id} en estado inesperado (estado=${pred.estado}, planSucesor=${pred.planSucesor ?? "—"}); no se restaura`,
      );
    }

    const tieneActividad = await planHasActivity(ctx, args.planId);
    if (tieneActividad) {
      await ctx.db.patch(args.planId, { estado: "cancelado" });
    } else {
      await deletePlanExercises(ctx, args.planId);
      await ctx.db.delete(args.planId);
    }

    let predecesorRestaurado: Id<"plans"> | null = null;
    if (restauraPred) {
      const out = await repairBrokenChain(ctx, pred, {
        today,
        motivo: tieneActividad ? "sucesor_cancelado" : "sucesor_inexistente",
        apply: true,
        migracion: "plans.remove",
      });
      if (out.accion === "restaurado") predecesorRestaurado = pred._id;
    }

    await afterPlanChainChange(ctx, {
      pacienteId: plan.pacienteId,
      clinicId: plan.clinicId,
      today,
      // Los días en que la versión eliminada estuvo vigente se recomputan
      // contra el predecesor restaurado.
      recomputeDesde: restauraPred ? plan.fechaInicio : undefined,
    });

    return { softDeleted: tieneActividad, predecesorRestaurado };
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
    const oldPlan = await assertCanManagePlan(ctx, user._id, args.oldPlanId);
    // Un plan ya versionado no puede volver a versionarse: se rompería la
    // cadena (dos sucesores para el mismo predecesor) y el plan quedaría
    // referenciado por una versión que nunca fue la vigente.
    if (oldPlan.estado === "modificado" || oldPlan.planSucesor) {
      throw new Error(
        "Este plan ya tiene una versión más reciente. Edita esa versión en su lugar.",
      );
    }
    await requireActiveSubscription(ctx, oldPlan.clinicId);

    // Fechas efectivas: la nueva versión rige desde HOY (el día del paciente
    // en su TZ, nunca retroactiva) y el plan viejo conserva su vigencia hasta
    // ayer — los días pasados se siguen evaluando contra la versión vigente
    // entonces (`computeVersionDates`). Versionar no reescribe la historia.
    const today = getCurrentDateInTz(
      await getPatientTz(ctx, oldPlan.pacienteId),
    );
    const { nuevoInicio, oldFechaFin } = computeVersionDates(
      oldPlan,
      args.fechaInicio,
      today,
    );

    // Marcar el plan anterior como "modificado": indica que fue reemplazado
    // por una nueva versión (no que se completó naturalmente).
    // `fechaFinPreVersion` guarda la fechaFin original para poder deshacer el
    // versionado con exactitud si la versión nueva se elimina (`remove`).
    await ctx.db.patch(args.oldPlanId, {
      estado: "modificado" as const,
      fechaFin: oldFechaFin,
      fechaFinPreVersion: oldPlan.fechaFin ?? null,
    });

    // Create new plan — hereda la clínica del anterior.
    const newPlanId = await ctx.db.insert("plans", {
      titulo: args.titulo,
      descripcion: args.descripcion,
      estado: "activo",
      fechaInicio: nuevoInicio,
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
    // version() siempre crea un plan activo nuevo: sync del aggregate de
    // activos + recompute de HOY (los esperados de hoy cambian con la
    // versión nueva). Ver `afterPlanChainChange`.
    await afterPlanChainChange(ctx, {
      pacienteId: oldPlan.pacienteId,
      clinicId: oldPlan.clinicId,
      today,
    });

    return newPlanId;
  },
});
