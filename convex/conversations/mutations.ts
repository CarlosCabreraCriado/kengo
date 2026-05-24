import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  requireActiveSubscription,
} from "../_helpers/permissions";

const MAX_MESSAGE_LENGTH = 4000;
const PREVIEW_LENGTH = 200;

async function findExistingConversation(
  ctx: any,
  pacienteId: Id<"users">,
  fisioId: Id<"users">,
  clinicId: Id<"clinics">,
) {
  return await ctx.db
    .query("conversations")
    .withIndex("by_paciente_fisio_clinic", (q: any) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("fisioId", fisioId)
        .eq("clinicId", clinicId),
    )
    .unique();
}

export const startConversationWithPatient = mutation({
  args: {
    pacienteId: v.id("users"),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const fisio = await getAuthenticatedUser(ctx);

    let clinicId: Id<"clinics"> | null = null;

    if (args.clinicId) {
      const assignment = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", args.pacienteId).eq("clinicId", args.clinicId!),
        )
        .unique();

      if (!assignment || assignment.fisioId !== fisio._id) {
        throw new Error(
          "No puedes iniciar una conversación con este paciente: no eres su fisio asignado.",
        );
      }
      clinicId = args.clinicId;
    } else {
      const candidates = await ctx.db
        .query("assignments")
        .filter((q) => q.eq(q.field("pacienteId"), args.pacienteId))
        .collect();
      const mine = candidates.find((a) => a.fisioId === fisio._id);
      if (!mine) {
        throw new Error(
          "No tienes a este paciente asignado en ninguna clínica.",
        );
      }
      clinicId = mine.clinicId;
    }

    const existing = await findExistingConversation(
      ctx,
      args.pacienteId,
      fisio._id,
      clinicId,
    );
    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      pacienteId: args.pacienteId,
      fisioId: fisio._id,
      clinicId,
      pacienteUnreadCount: 0,
      fisioUnreadCount: 0,
    });
  },
});

export const startConversationWithFisio = mutation({
  args: {},
  handler: async (ctx) => {
    const paciente = await getAuthenticatedUser(ctx);

    const assignments = await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("pacienteId"), paciente._id))
      .collect();

    if (assignments.length === 0) return null;

    const assignment = assignments[0];

    const existing = await findExistingConversation(
      ctx,
      paciente._id,
      assignment.fisioId,
      assignment.clinicId,
    );
    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      pacienteId: paciente._id,
      fisioId: assignment.fisioId,
      clinicId: assignment.clinicId,
      pacienteUnreadCount: 0,
      fisioUnreadCount: 0,
    });
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthenticatedUser(ctx);

    const trimmed = args.text.trim();
    if (trimmed.length === 0) {
      throw new Error("El mensaje no puede estar vacío");
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `El mensaje supera el máximo de ${MAX_MESSAGE_LENGTH} caracteres`,
      );
    }

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) {
      throw new Error("Conversación no encontrada");
    }
    if (conv.pacienteId !== me._id && conv.fisioId !== me._id) {
      throw new Error("No tienes acceso a esta conversación");
    }

    // Aislamiento de billing en chat (Bloque F): si la clínica está
    // suspendida, los fisios/admin pierden la capacidad de enviar
    // mensajes (deben reactivar el pago), pero los pacientes siguen
    // pudiendo escribir y leer con normalidad. La regla viene de la
    // decisión #17 del plan production-ready: el paciente no controla
    // el billing de la clínica, no debe sufrir su impago.
    if (me._id !== conv.pacienteId) {
      await requireActiveSubscription(ctx, conv.clinicId);
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      text: trimmed,
    });

    const receiverIsPaciente = me._id === conv.fisioId;
    const now = Date.now();

    await ctx.db.patch(args.conversationId, {
      lastMessageText: trimmed.slice(0, PREVIEW_LENGTH),
      lastMessageAt: now,
      lastMessageSenderId: me._id,
      pacienteUnreadCount: receiverIsPaciente
        ? conv.pacienteUnreadCount + 1
        : conv.pacienteUnreadCount,
      fisioUnreadCount: receiverIsPaciente
        ? conv.fisioUnreadCount
        : conv.fisioUnreadCount + 1,
    });

    const receiverId = receiverIsPaciente ? conv.pacienteId : conv.fisioId;
    const senderName = `${me.firstName} ${me.lastName}`.trim();
    const badge = await computeUnreadBadgeForUser(ctx, receiverId);
    await ctx.scheduler.runAfter(0, internal.push.actions.sendPushToUser, {
      userId: receiverId,
      title: senderName || "Nuevo mensaje",
      body: trimmed.slice(0, 140),
      data: {
        type: "chat_message",
        conversationId: args.conversationId,
      },
      notificationKey: "chat",
      badge,
    });

    return messageId;
  },
});

// Suma todos los mensajes no leídos del usuario en sus conversaciones no
// archivadas. Usado como `badge` iOS en la push de chat para que el icono
// muestre el total acumulado, no el de la conversación concreta.
async function computeUnreadBadgeForUser(
  ctx: any,
  userId: Id<"users">,
): Promise<number> {
  const [asPaciente, asFisio] = await Promise.all([
    ctx.db
      .query("conversations")
      .withIndex("by_pacienteId_lastMessageAt", (q: any) =>
        q.eq("pacienteId", userId),
      )
      .collect(),
    ctx.db
      .query("conversations")
      .withIndex("by_fisioId_lastMessageAt", (q: any) =>
        q.eq("fisioId", userId),
      )
      .collect(),
  ]);

  let total = 0;
  for (const c of asPaciente) {
    if (c.archivedAt !== undefined) continue;
    total += c.pacienteUnreadCount;
  }
  for (const c of asFisio) {
    if (c.archivedAt !== undefined) continue;
    total += c.fisioUnreadCount;
  }
  return total;
}

export const markAsRead = mutation({
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

    const iAmPaciente = me._id === conv.pacienteId;

    const allMsgs = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const unread = allMsgs.filter(
      (m) => m.senderId !== me._id && m.readAt === undefined,
    );

    const now = Date.now();
    await Promise.all(unread.map((m) => ctx.db.patch(m._id, { readAt: now })));

    await ctx.db.patch(args.conversationId, {
      pacienteUnreadCount: iAmPaciente ? 0 : conv.pacienteUnreadCount,
      fisioUnreadCount: iAmPaciente ? conv.fisioUnreadCount : 0,
    });

    return null;
  },
});
