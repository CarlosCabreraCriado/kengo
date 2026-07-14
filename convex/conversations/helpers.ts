import { Id } from "../_generated/dataModel";

/**
 * Suma todos los mensajes no leídos del usuario en sus conversaciones (como
 * paciente y como fisio, cross-clínica). Se usa en dos sitios:
 *  - como `badge` iOS en la push de chat (`mutations.sendMessage`), para que el
 *    icono muestre el total acumulado cuando la app está cerrada/background.
 *  - como valor de la query `getMyUnreadTotal` que el cliente espeja al badge
 *    del icono mientras la app está viva.
 *
 * Solo lee la BD, por lo que sirve tanto en contexto de query como de mutation.
 */
export async function computeUnreadBadgeForUser(
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
  for (const c of asPaciente) total += c.pacienteUnreadCount;
  for (const c of asFisio) total += c.fisioUnreadCount;
  return total;
}
