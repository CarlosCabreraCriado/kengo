import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { batchGetMap } from "../_helpers/batchGet";
import { computeUnreadBadgeForUser } from "./helpers";

export const listMyConversations = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthenticatedUser(ctx);

    const [asPaciente, asFisio] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_pacienteId_lastMessageAt", (q) =>
          q.eq("pacienteId", me._id),
        )
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_fisioId_lastMessageAt", (q) =>
          q.eq("fisioId", me._id),
        )
        .collect(),
    ]);

    const dedup = new Map<Id<"conversations">, (typeof asPaciente)[number]>();
    for (const c of [...asPaciente, ...asFisio]) {
      dedup.set(c._id, c);
    }
    const all = Array.from(dedup.values());

    all.sort((a, b) => {
      const aTime = a.lastMessageAt ?? 0;
      const bTime = b.lastMessageAt ?? 0;
      return bTime - aTime;
    });

    const otherIds = all.map((c) =>
      c.pacienteId === me._id ? c.fisioId : c.pacienteId,
    );
    const clinicIds = all.map((c) => c.clinicId);
    const [usersMap, clinicsMap] = await Promise.all([
      batchGetMap<"users">(ctx, otherIds),
      batchGetMap<"clinics">(ctx, clinicIds),
    ]);

    return all.map((c) => {
      const iAmPaciente = c.pacienteId === me._id;
      const otherId = iAmPaciente ? c.fisioId : c.pacienteId;
      const other = usersMap.get(otherId);
      const clinic = clinicsMap.get(c.clinicId);
      const myUnreadCount = iAmPaciente
        ? c.pacienteUnreadCount
        : c.fisioUnreadCount;

      return {
        _id: c._id,
        _creationTime: c._creationTime,
        clinicId: c.clinicId,
        clinicName: clinic?.nombreComercial ?? clinic?.nombre ?? null,
        otherUserId: otherId,
        otherFirstName: other?.firstName ?? "",
        otherLastName: other?.lastName ?? "",
        otherAvatar: other?.avatar ?? null,
        lastMessageText: c.lastMessageText ?? null,
        lastMessageAt: c.lastMessageAt ?? null,
        lastMessageSenderId: c.lastMessageSenderId ?? null,
        myUnreadCount,
        iAmFisio: !iAmPaciente,
        patientStats: null as null | {
          adherence: number;
          lastPainScale: number;
          activePlan: string;
          age: number;
        },
      };
    });
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await getAuthenticatedUser(ctx);

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) {
      throw new Error("Conversación no encontrada");
    }
    if (conv.pacienteId !== me._id && conv.fisioId !== me._id) {
      throw new Error("No tienes acceso a esta conversación");
    }
    // Defensa en profundidad: si el usuario perdió la membresía en la clínica
    // de la conversación (expulsión, baja), no puede seguir leyendo aunque
    // figure como pacienteId/fisioId del documento.
    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", me._id).eq("clinicId", conv.clinicId),
      )
      .unique();
    if (!membership) {
      throw new Error("No tienes acceso a esta conversación");
    }

    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();

    return msgs.map((m) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      conversationId: m.conversationId,
      senderId: m.senderId,
      text: m.text,
      readAt: m.readAt ?? null,
    }));
  },
});

/**
 * Total de mensajes no leídos del usuario autenticado (suma cross-clínica,
 * como paciente y como fisio). Query ligera y reactiva: el cliente la espeja
 * al badge del icono de la app (`BadgeSyncService`). Coincide con el valor que
 * la push de chat manda como `badge` iOS.
 */
export const getMyUnreadTotal = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthenticatedUser(ctx);
    return await computeUnreadBadgeForUser(ctx, me._id);
  },
});
