import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function insertCommentNotificationFromRecord(
  ctx: MutationCtx,
  recordId: Id<"planRecords">,
): Promise<Id<"physioNotifications"> | null> {
  const record = await ctx.db.get(recordId);
  if (!record || !record.notaPaciente?.trim()) return null;

  const existing = await ctx.db
    .query("physioNotifications")
    .withIndex("by_recordId", (q) => q.eq("recordId", recordId))
    .first();
  if (existing) return existing._id;

  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", record.pacienteId))
    .first();
  if (!membership) return null;

  const planEx = await ctx.db.get(record.planExerciseId);
  if (!planEx) return null;

  const [plan, paciente, exercise] = await Promise.all([
    ctx.db.get(planEx.planId),
    ctx.db.get(record.pacienteId),
    planEx.ejercicioNombre ? Promise.resolve(null) : ctx.db.get(planEx.exerciseId),
  ]);

  const nombreEjercicio = planEx.ejercicioNombre ?? exercise?.nombreEjercicio;
  const pacienteNombre = paciente
    ? `${paciente.firstName} ${paciente.lastName}`.trim()
    : undefined;

  return await ctx.db.insert("physioNotifications", {
    tipo: "comentario",
    pacienteId: record.pacienteId,
    clinicId: membership.clinicId,
    recordId: record._id,
    fechaRegistro: record.fechaHora,
    tituloPlan: plan?.titulo,
    nombreEjercicio,
    texto: record.notaPaciente,
    dolorEscala: record.dolorEscala,
    revisada: false,
    pacienteNombre,
  });
}

export async function insertCommentNotificationFromSession(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
): Promise<Id<"physioNotifications"> | null> {
  const session = await ctx.db.get(sessionId);
  if (!session || !session.observacionesGenerales?.trim()) return null;

  const existing = await ctx.db
    .query("physioNotifications")
    .withIndex("by_pacienteId", (q) => q.eq("pacienteId", session.pacienteId))
    .filter((q) => q.eq(q.field("sessionId"), sessionId))
    .first();
  if (existing) return existing._id;

  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", session.pacienteId))
    .first();
  if (!membership) return null;

  const paciente = await ctx.db.get(session.pacienteId);
  const pacienteNombre = paciente
    ? `${paciente.firstName} ${paciente.lastName}`.trim()
    : undefined;

  return await ctx.db.insert("physioNotifications", {
    tipo: "comentario",
    pacienteId: session.pacienteId,
    clinicId: membership.clinicId,
    sessionId: session._id,
    fechaRegistro: session.fechaInicio,
    tituloPlan: "Sesión de trabajo",
    texto: session.observacionesGenerales,
    revisada: false,
    pacienteNombre,
  });
}
