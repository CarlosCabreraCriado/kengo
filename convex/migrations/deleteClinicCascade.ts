/**
 * Migración: borrado en cascada de una clínica para tareas de mantenimiento.
 *
 * Pensada para limpiar clínicas huérfanas detectadas por
 * `backfillClinicOwner` (motivo `sin_admin`): no tienen ningún admin, así
 * que no se les puede asignar `ownerUserId` y la promoción del campo a
 * no-opcional las dejaría en estado inválido.
 *
 * ⚠️ DESTRUCTIVO. Sólo invocable desde el Convex Dashboard (internal). Se
 * pide explícitamente `confirmName` (el nombre exacto de la clínica) para
 * evitar borrados accidentales: si el nombre no coincide, la mutation
 * aborta sin tocar nada.
 *
 * Tablas que se vacían (todo lo que referencia `clinicId`):
 *   - clinicMemberships
 *   - clinicFiles
 *   - clinicBilling
 *   - clinicOwnershipAudit
 *   - plans (+ planExercises)
 *   - sessions (+ exerciseExecutions vinculados por sessionId)
 *   - exerciseExecutions (por clinicId, defensa en profundidad)
 *   - dailyPatientRollup (los rollups semanal/mensual van por pacienteId
 *     sin columna `clinicId`, así que no aplican)
 *   - patientMetricsSnapshot / clinicMetricsSnapshot / exerciseUsageRollup
 *   - physioAlerts
 *   - accessCodes
 *   - assignments
 *   - conversations (+ messages vinculados por conversationId)
 *   - routines con visibilidad === "clinica" y clinicId match (+ routineExercises)
 *   - stripeWebhookEvents (clinicId opcional)
 *   - clinics (el documento principal, al final)
 *
 * NO se tocan tablas que viven por usuario (`pushTokens`, `accessTokens`,
 * `recoveryCodes`, `verificationCodes`, `exerciseFavorites`) ni `users`.
 *
 * Cómo ejecutar (desde Convex Dashboard → Functions → migrations/deleteClinicCascade):
 *
 *   1. INSPECCIONAR (sin tocar nada):
 *      run inspect { "clinicId": "jx7cf1zmy37gatpr3sd4d6wd7d85fxa1" }
 *      → Devuelve recuento por tabla y el `nombre` actual.
 *
 *   2. DRY-RUN (no borra, solo simula y registra cuánto borraría):
 *      run run { "clinicId": "jx7cf1zmy37gatpr3sd4d6wd7d85fxa1",
 *                "confirmName": "Clinica de prueba",
 *                "apply": false }
 *
 *   3. APLICAR (irreversible):
 *      run run { "clinicId": "jx7cf1zmy37gatpr3sd4d6wd7d85fxa1",
 *                "confirmName": "Clinica de prueba",
 *                "apply": true }
 */

import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { _deleteAllPatientSnapshotsForClinic } from "../snapshots/internal";

/** Cuenta documentos por tabla relacionada con la clínica. */
async function recolectarCounts(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
) {
  const [
    memberships,
    files,
    billing,
    ownershipAudit,
    plans,
    sessions,
    executions,
    dailyRollups,
    patientSnaps,
    clinicSnaps,
    exerciseRollups,
    alerts,
    accessCodes,
    assignments,
    conversations,
    routines,
    webhookEvents,
  ] = await Promise.all([
    ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("clinicFiles")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("clinicOwnershipAudit")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("plans")
      .withIndex("by_clinicId_estado", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("sessions")
      .withIndex("by_clinicId_fecha", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("exerciseExecutions")
      .withIndex("by_clinicId_fecha", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("dailyPatientRollup")
      .withIndex("by_clinicId_fecha", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_clinicId_ventana_riskScore", (q) =>
        q.eq("clinicId", clinicId),
      )
      .collect(),
    ctx.db
      .query("clinicMetricsSnapshot")
      .withIndex("by_clinicId_ventana", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("exerciseUsageRollup")
      .withIndex("by_clinicId_anioMes", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("physioAlerts")
      .withIndex("by_clinicId_estado", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("accessCodes")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("assignments")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    // conversations no tiene índice directo por clinicId — filtramos.
    ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("clinicId"), clinicId))
      .collect(),
    ctx.db
      .query("routines")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
      .collect(),
    ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_clinicId_createdMs", (q) => q.eq("clinicId", clinicId))
      .collect(),
  ]);

  // planExercises por cada plan.
  let planExercisesCount = 0;
  for (const plan of plans) {
    const list = await ctx.db
      .query("planExercises")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .collect();
    planExercisesCount += list.length;
  }

  // routineExercises por cada routine.
  let routineExercisesCount = 0;
  for (const r of routines) {
    const list = await ctx.db
      .query("routineExercises")
      .withIndex("by_routineId", (q) => q.eq("routineId", r._id))
      .collect();
    routineExercisesCount += list.length;
  }

  // messages por cada conversation.
  let messagesCount = 0;
  for (const c of conversations) {
    const list = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", c._id))
      .collect();
    messagesCount += list.length;
  }

  return {
    clinicMemberships: memberships.length,
    clinicFiles: files.length,
    clinicBilling: billing.length,
    clinicOwnershipAudit: ownershipAudit.length,
    plans: plans.length,
    planExercises: planExercisesCount,
    sessions: sessions.length,
    exerciseExecutions: executions.length,
    dailyPatientRollup: dailyRollups.length,
    patientMetricsSnapshot: patientSnaps.length,
    clinicMetricsSnapshot: clinicSnaps.length,
    exerciseUsageRollup: exerciseRollups.length,
    physioAlerts: alerts.length,
    accessCodes: accessCodes.length,
    assignments: assignments.length,
    conversations: conversations.length,
    messages: messagesCount,
    routines: routines.length,
    routineExercises: routineExercisesCount,
    stripeWebhookEvents: webhookEvents.length,
  };
}

/**
 * Inspecciona el contenido de una clínica sin tocar nada. Devuelve el
 * nombre actual y el recuento de filas en cada tabla relacionada. Útil
 * para decidir si conviene borrar o no.
 */
export const inspect = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, { clinicId }) => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) {
      return { exists: false as const };
    }
    const counts = await recolectarCounts(ctx, clinicId);
    return {
      exists: true as const,
      clinicId,
      nombre: clinic.nombre,
      createdBy: clinic.createdBy,
      ownerUserId: clinic.ownerUserId,
      counts,
    };
  },
});

/**
 * Borra una clínica y todas sus dependencias. Si `apply === false` solo
 * reporta lo que borraría sin tocar nada (dry-run).
 *
 * Requiere `confirmName` coincidente con `clinic.nombre` para evitar
 * borrados por confusión de id.
 */
export const run = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    confirmName: v.string(),
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, { clinicId, confirmName, apply = false }) => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) {
      throw new ConvexError({
        code: "CLINIC_NOT_FOUND",
        message: `Clínica ${clinicId} no existe.`,
      });
    }
    if (clinic.nombre.trim() !== confirmName.trim()) {
      throw new ConvexError({
        code: "NAME_MISMATCH",
        message: `El nombre confirmado ("${confirmName}") no coincide con el actual ("${clinic.nombre}"). Aborto sin tocar nada.`,
      });
    }

    const counts = await recolectarCounts(ctx, clinicId);

    if (!apply) {
      console.log(
        `[deleteClinicCascade DRY-RUN] clinic="${clinic.nombre}" (${clinicId}) counts:`,
        JSON.stringify(counts),
      );
      return { applied: false as const, clinicId, nombre: clinic.nombre, counts };
    }

    // === FASE DESTRUCTIVA ===
    // Orden: hijos primero, padre al final. Para tablas con sub-hijos
    // (plans→planExercises, sessions→exerciseExecutions, routines→
    // routineExercises, conversations→messages) borramos por dentro.

    await borrarPlanesYEjercicios(ctx, clinicId);
    await borrarSesionesYEjecuciones(ctx, clinicId);
    // exerciseExecutions: defensa en profundidad por si quedó alguno
    // huérfano (sesión borrada en paso anterior limpiaría los suyos, pero
    // este barrido cubre referencias directas por clinicId).
    await borrarPorIndice(
      ctx,
      "exerciseExecutions",
      "by_clinicId_fecha",
      clinicId,
    );
    await borrarPorIndice(
      ctx,
      "dailyPatientRollup",
      "by_clinicId_fecha",
      clinicId,
    );
    // patientMetricsSnapshot: purgamos también las entradas en los 3
    // DirectAggregates particionados por (clinicId, ventana). Sin esta pasada
    // el borrado masivo dejaba aggregates con `id == pacienteId` apuntando a
    // snapshots inexistentes (basura permanente en el componente, aunque el
    // namespace incluyera el clinicId muerto).
    await _deleteAllPatientSnapshotsForClinic(ctx, clinicId);
    await borrarPorIndice(
      ctx,
      "clinicMetricsSnapshot",
      "by_clinicId_ventana",
      clinicId,
    );
    await borrarPorIndice(
      ctx,
      "exerciseUsageRollup",
      "by_clinicId_anioMes",
      clinicId,
    );
    await borrarPorIndice(ctx, "physioAlerts", "by_clinicId_estado", clinicId);
    await borrarPorIndice(ctx, "accessCodes", "by_clinicId", clinicId);
    await borrarPorIndice(ctx, "assignments", "by_clinicId", clinicId);
    await borrarConversacionesYMensajes(ctx, clinicId);
    await borrarRutinasYEjercicios(ctx, clinicId);
    await borrarPorIndice(
      ctx,
      "stripeWebhookEvents",
      "by_clinicId_createdMs",
      clinicId,
    );
    await borrarPorIndice(ctx, "clinicMemberships", "by_clinicId", clinicId);
    await borrarPorIndice(ctx, "clinicFiles", "by_clinicId", clinicId);
    await borrarPorIndice(ctx, "clinicBilling", "by_clinicId", clinicId);
    await borrarPorIndice(ctx, "clinicOwnershipAudit", "by_clinicId", clinicId);

    await ctx.db.delete(clinicId);

    console.log(
      `[deleteClinicCascade APPLIED] clinic="${clinic.nombre}" (${clinicId}) counts:`,
      JSON.stringify(counts),
    );

    return { applied: true as const, clinicId, nombre: clinic.nombre, counts };
  },
});

// --- helpers ---------------------------------------------------------------

async function borrarPorIndice(
  ctx: MutationCtx,
  // Aceptamos cualquier nombre de tabla del esquema, pero como esta función
  // es interna del archivo no necesitamos un tipo más fuerte: el caller ya
  // pasa nombres conocidos.
  table:
    | "exerciseExecutions"
    | "dailyPatientRollup"
    | "clinicMetricsSnapshot"
    | "exerciseUsageRollup"
    | "physioAlerts"
    | "accessCodes"
    | "assignments"
    | "clinicMemberships"
    | "clinicFiles"
    | "clinicBilling"
    | "clinicOwnershipAudit"
    | "stripeWebhookEvents",
  indexName: string,
  clinicId: Id<"clinics">,
): Promise<void> {
  // `q.eq` con un solo campo del índice basta para iterar todas las filas
  // de esa clínica.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs = await (ctx.db.query(table) as any)
    .withIndex(indexName, (q: { eq: (f: string, v: unknown) => unknown }) =>
      q.eq("clinicId", clinicId),
    )
    .collect();
  for (const d of docs as Array<{ _id: Id<"_storage"> }>) {
    // El tipo `_id` real corresponde a la tabla; el cast a `_storage` es solo
    // para satisfacer el firmador. `ctx.db.delete` acepta cualquier `Id<T>`.
    await ctx.db.delete(d._id as unknown as Id<"clinics">);
  }
}

async function borrarPlanesYEjercicios(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  const plans = await ctx.db
    .query("plans")
    .withIndex("by_clinicId_estado", (q) => q.eq("clinicId", clinicId))
    .collect();
  for (const plan of plans) {
    const exercises = await ctx.db
      .query("planExercises")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .collect();
    for (const ex of exercises) await ctx.db.delete(ex._id);
    await ctx.db.delete(plan._id);
  }
}

async function borrarSesionesYEjecuciones(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_clinicId_fecha", (q) => q.eq("clinicId", clinicId))
    .collect();
  for (const s of sessions) {
    const executions = await ctx.db
      .query("exerciseExecutions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    for (const e of executions) await ctx.db.delete(e._id);
    await ctx.db.delete(s._id);
  }
}

async function borrarConversacionesYMensajes(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  // No hay índice directo por clinicId; usamos filter.
  const conversations = await ctx.db
    .query("conversations")
    .filter((q) => q.eq(q.field("clinicId"), clinicId))
    .collect();
  for (const c of conversations) {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", c._id))
      .collect();
    for (const m of messages) await ctx.db.delete(m._id);
    await ctx.db.delete(c._id);
  }
}

async function borrarRutinasYEjercicios(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  const routines = await ctx.db
    .query("routines")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .collect();
  for (const r of routines) {
    const exercises = await ctx.db
      .query("routineExercises")
      .withIndex("by_routineId", (q) => q.eq("routineId", r._id))
      .collect();
    for (const ex of exercises) await ctx.db.delete(ex._id);
    await ctx.db.delete(r._id);
  }
}
