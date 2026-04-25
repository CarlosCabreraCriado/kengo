import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

const PUESTO_FISIO = 1;
const PUESTO_ADMIN = 4;

export const listByClinic = query({
  args: {
    clinicId: v.id("clinics"),
    soloNoRevisadas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.soloNoRevisadas) {
      return await ctx.db
        .query("physioNotifications")
        .withIndex("by_clinicId_revisada", (q) =>
          q.eq("clinicId", args.clinicId).eq("revisada", false),
        )
        .collect();
    }

    return await ctx.db
      .query("physioNotifications")
      .withIndex("by_clinicId_revisada", (q) =>
        q.eq("clinicId", args.clinicId),
      )
      .collect();
  },
});

export const countUnread = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("physioNotifications")
      .withIndex("by_clinicId_revisada", (q) =>
        q.eq("clinicId", args.clinicId).eq("revisada", false),
      )
      .collect();

    return unread.length;
  },
});

export const listForCurrentFisio = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const clinicIds = memberships
      .filter(
        (m) => m.puesto === PUESTO_FISIO || m.puesto === PUESTO_ADMIN,
      )
      .map((m) => m.clinicId as Id<"clinics">);

    if (clinicIds.length === 0) {
      return {
        notificaciones: [] as Array<{
          id: string;
          fuente: string;
          categoria: "comentario_paciente";
          emisor_nombre: string;
          emisor_avatar: string | null;
          emisor_id: string;
          titulo: string;
          texto: string | null;
          fecha: string;
          leida: boolean;
          ruta_destino: string;
        }>,
        pendientes: 0,
        total: 0,
      };
    }

    const all = [];
    for (const clinicId of clinicIds) {
      const items = await ctx.db
        .query("physioNotifications")
        .withIndex("by_clinicId_revisada", (q) => q.eq("clinicId", clinicId))
        .collect();
      for (const n of items) all.push(n);
    }

    all.sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

    const notificaciones = await Promise.all(
      all.map(async (n) => {
        const paciente = await ctx.db.get(n.pacienteId);
        const emisorId = paciente?.legacyDirectusId ?? n.pacienteId;
        const titulo = n.tituloPlan
          ? n.nombreEjercicio
            ? `${n.tituloPlan} · ${n.nombreEjercicio}`
            : n.tituloPlan
          : n.nombreEjercicio ?? "Comentario";
        return {
          id: n._id as string,
          fuente: "kengo",
          categoria: "comentario_paciente" as const,
          emisor_nombre:
            n.pacienteNombre
            ?? (paciente
              ? `${paciente.firstName} ${paciente.lastName}`.trim()
              : ""),
          emisor_avatar: null,
          emisor_id: emisorId,
          titulo,
          texto: n.texto ?? null,
          fecha: n.fechaRegistro,
          leida: n.revisada,
          ruta_destino: `/mis-pacientes/${emisorId}`,
        };
      }),
    );

    const pendientes = notificaciones.filter((n) => !n.leida).length;

    return {
      notificaciones,
      pendientes,
      total: notificaciones.length,
    };
  },
});

export const listCommentsByPatient = query({
  args: { pacienteId: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    let targetId: Id<"users">;
    if (args.pacienteId.includes("-")) {
      const found = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", args.pacienteId),
        )
        .unique();
      if (!found) {
        return { comentarios: [], pendientes: 0, total: 0 };
      }
      targetId = found._id;
    } else {
      targetId = args.pacienteId as Id<"users">;
    }

    const items = await ctx.db
      .query("physioNotifications")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", targetId))
      .collect();

    items.sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));

    const comentarios = items.map((n) => ({
      id: n._id as string,
      tipo: n.tipo,
      paciente: (targetId as string),
      id_clinica: n.clinicId as string,
      id_registro: (n.recordId as string | undefined) ?? null,
      id_sesion: (n.sessionId as string | undefined) ?? null,
      fecha_registro: n.fechaRegistro,
      titulo_plan: n.tituloPlan ?? null,
      nombre_ejercicio: n.nombreEjercicio ?? null,
      texto: n.texto ?? null,
      dolor_escala: n.dolorEscala ?? null,
      revisada: n.revisada,
      fecha_revision: n.fechaRevision ?? null,
      date_created: new Date(n._creationTime).toISOString(),
    }));

    const pendientes = comentarios.filter((c) => !c.revisada).length;

    return {
      comentarios,
      pendientes,
      total: comentarios.length,
    };
  },
});
