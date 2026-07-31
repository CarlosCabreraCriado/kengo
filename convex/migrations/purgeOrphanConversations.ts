/**
 * Purga conversaciones huérfanas: aquellas cuyo paciente o fisio ya no tiene
 * membresía vigente en la clínica de la conversación.
 *
 * Por qué: las cascadas de `clinicMemberships` borran la conversación al
 * perder la membresía, pero los datos anteriores a esas cascadas (o de
 * cascadas interrumpidas) quedaron como residuo. Esas conversaciones contaban
 * en el badge de iOS (`computeUnreadBadgeForUser`) y eran imposibles de abrir
 * o marcar leídas (`listMessages`/`markAsRead` exigen membresía) — el badge
 * quedaba atascado para siempre. El filtro por membresía en las queries ya
 * las excluye; esta migración elimina el residuo de BD.
 *
 * Cómo ejecutar (el CLI self-hosted opera DIRECTO sobre producción):
 *   1. Dry-run (por defecto, solo lista candidatas en el log):
 *      npx convex run migrations/purgeOrphanConversations:run
 *   2. Revisar el log y, solo entonces, borrar de verdad:
 *      npx convex run migrations/purgeOrphanConversations:run '{"dryRun": false}'
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { deleteConversationWithMessages } from "../conversations/helpers";

async function hasMembership(
  ctx: any,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<boolean> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q: any) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();
  return membership !== null;
}

export const run = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }): Promise<void> => {
    const convs = await ctx.db.query("conversations").collect();
    let orphans = 0;

    for (const c of convs) {
      const [pacienteOk, fisioOk] = await Promise.all([
        hasMembership(ctx, c.pacienteId, c.clinicId),
        hasMembership(ctx, c.fisioId, c.clinicId),
      ]);
      if (pacienteOk && fisioOk) continue;

      orphans++;
      console.log(
        `[orphan] ${c._id} clinic=${c.clinicId} paciente=${pacienteOk} ` +
          `fisio=${fisioOk} unread(pac=${c.pacienteUnreadCount}, ` +
          `fisio=${c.fisioUnreadCount})`,
      );
      if (!dryRun) await deleteConversationWithMessages(ctx, c._id);
    }

    console.log(
      `[purgeOrphanConversations] ${orphans}/${convs.length} huérfanas ` +
        (dryRun
          ? "detectadas (dry-run: nada borrado). Repetir con '{\"dryRun\": false}' para purgar."
          : "borradas junto con sus mensajes."),
    );
  },
});
