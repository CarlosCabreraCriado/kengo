import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

/**
 * Ids de las clínicas donde el usuario tiene membresía vigente. Una sola
 * lectura indexada (`clinicMemberships.by_userId`); un usuario tiene pocas
 * membresías, así que el coste es marginal.
 */
export async function getMemberClinicIdSet(
  ctx: any,
  userId: Id<"users">,
): Promise<Set<Id<"clinics">>> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  return new Set<Id<"clinics">>(memberships.map((m: any) => m.clinicId));
}

/**
 * Suma todos los mensajes no leídos del usuario en sus conversaciones (como
 * paciente y como fisio, cross-clínica). Se usa en dos sitios:
 *  - como `badge` iOS en la push de chat (`mutations.sendMessage`), para que el
 *    icono muestre el total acumulado cuando la app está cerrada/background.
 *  - como valor de la query `getMyUnreadTotal` que el cliente espeja al badge
 *    del icono mientras la app está viva.
 *
 * Solo cuenta conversaciones de clínicas con membresía vigente: `markAsRead`
 * exige membresía, así que una huérfana jamás podría marcarse leída y
 * contarla dejaría el badge atascado para siempre. Las cascadas de
 * `clinicMemberships` ya borran conversaciones al perder la membresía; este
 * filtro es defensa en profundidad frente a datos legacy o cascadas
 * interrumpidas.
 *
 * Solo lee la BD, por lo que sirve tanto en contexto de query como de mutation.
 */
export async function computeUnreadBadgeForUser(
  ctx: any,
  userId: Id<"users">,
): Promise<number> {
  const [asPaciente, asFisio, memberClinics] = await Promise.all([
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
    getMemberClinicIdSet(ctx, userId),
  ]);

  let total = 0;
  for (const c of asPaciente) {
    if (memberClinics.has(c.clinicId)) total += c.pacienteUnreadCount;
  }
  for (const c of asFisio) {
    if (memberClinics.has(c.clinicId)) total += c.fisioUnreadCount;
  }
  return total;
}

/**
 * Borra una conversación junto con todos sus mensajes. Convex no cascadea,
 * así que iteramos `messages` por `by_conversationId` antes de borrar el
 * documento de `conversations`. La usan las cascadas de membresía y la
 * migración `purgeOrphanConversations`.
 */
export async function deleteConversationWithMessages(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
): Promise<void> {
  const msgs = await ctx.db
    .query("messages")
    .withIndex("by_conversationId", (q) =>
      q.eq("conversationId", conversationId),
    )
    .collect();
  for (const m of msgs) await ctx.db.delete(m._id);
  await ctx.db.delete(conversationId);
}
