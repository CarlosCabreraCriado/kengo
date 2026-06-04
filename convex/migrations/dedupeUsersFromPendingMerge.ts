/**
 * Migración: dedupe de usuarios `pending` con su contraparte Better-Auth.
 *
 * Contexto del bug: `upsertFromAuth` buscaba solo por `externalId`. Cuando un
 * paciente había sido pre-creado por el admin (`externalId = pending-<email>`)
 * y luego activaba la cuenta con Better-Auth, se insertaba un segundo `users`
 * con el mismo email y un `externalId` real. A partir de ese momento, las
 * `conversations` (y otras tablas) seguían apuntando al `users` pending,
 * mientras que `getAuthenticatedUser` devolvía el nuevo — rompiendo
 * `listMessages` con "No tienes acceso a esta conversación" tras un ciclo
 * remove → re-add.
 *
 * `upsertFromAuth` ya quedó corregido para promover el pending en lugar de
 * duplicar. Esta migración limpia los casos ya partidos en BD: por cada par
 * `(U_pending, U_real)` con mismo email, re-apunta todas las referencias a
 * `U_real`, fusiona `clinicMemberships` colisionantes (puesto más alto) y
 * borra el documento pending.
 *
 * Ejecución (siempre primero en dry-run):
 *   npx convex run migrations/dedupeUsersFromPendingMerge:dryRun
 *   npx convex run migrations/dedupeUsersFromPendingMerge:apply
 *
 * También limpia `conversations` con `archivedAt !== undefined` y sus
 * `messages` (residuos del soft-delete previo a la nueva cascada).
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

type Pair = {
  pendingId: Id<"users">;
  realId: Id<"users">;
  email: string;
};

const PUESTO_RANK: Record<"admin" | "fisio" | "paciente", number> = {
  admin: 3,
  fisio: 2,
  paciente: 1,
};

export const findDuplicates = internalQuery({
  args: {},
  handler: async (ctx): Promise<Pair[]> => {
    const all: Doc<"users">[] = await ctx.db.query("users").collect();
    const byEmail = new Map<string, Doc<"users">[]>();
    for (const u of all) {
      const key = u.email.toLowerCase().trim();
      if (!key) continue;
      const arr = byEmail.get(key) ?? [];
      arr.push(u);
      byEmail.set(key, arr);
    }

    const pairs: Pair[] = [];
    for (const [email, users] of byEmail) {
      if (users.length < 2) continue;
      const pending = users.filter((u) => u.externalId.startsWith("pending-"));
      const real = users.filter((u) => !u.externalId.startsWith("pending-"));
      if (pending.length === 0 || real.length === 0) continue;
      if (real.length > 1) {
        console.warn(
          `[dedupe] email ${email}: ${real.length} usuarios no-pending; revisar manualmente`,
        );
        continue;
      }
      const realId = real[0]._id;
      for (const p of pending) pairs.push({ pendingId: p._id, realId, email });
    }
    return pairs;
  },
});

export const mergePair = internalMutation({
  args: {
    pendingId: v.id("users"),
    realId: v.id("users"),
    apply: v.boolean(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    const real = await ctx.db.get(args.realId);
    if (!pending || !real) return { ok: false, reason: "NOT_FOUND" } as const;
    if (pending._id === real._id) {
      return { ok: false, reason: "SAME_ID" } as const;
    }

    const actions: string[] = [];

    // clinicMemberships: merge si colisionan en (userId, clinicId).
    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", args.pendingId))
      .collect();
    for (const m of memberships) {
      const collision = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId_clinicId", (q) =>
          q.eq("userId", args.realId).eq("clinicId", m.clinicId),
        )
        .unique();
      if (collision) {
        const top =
          PUESTO_RANK[m.puesto] > PUESTO_RANK[collision.puesto]
            ? m.puesto
            : collision.puesto;
        const tambien =
          m.tambienEsPaciente === true ||
          collision.tambienEsPaciente === true
            ? true
            : undefined;
        actions.push(
          `merge clinicMembership clinic=${m.clinicId} → puesto=${top}`,
        );
        if (args.apply) {
          await ctx.db.patch(collision._id, {
            puesto: top,
            ...(tambien !== undefined && { tambienEsPaciente: tambien }),
          });
          await ctx.db.delete(m._id);
        }
      } else {
        actions.push(`repoint clinicMembership clinic=${m.clinicId}`);
        if (args.apply) await ctx.db.patch(m._id, { userId: args.realId });
      }
    }

    // assignments: clave única por (pacienteId, clinicId). Si colisiona,
    // borramos el del pending (el real ya cubre la asignación vigente).
    const assignmentsAsPaciente = await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("pacienteId"), args.pendingId))
      .collect();
    for (const a of assignmentsAsPaciente) {
      const collision = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", args.realId).eq("clinicId", a.clinicId),
        )
        .unique();
      if (collision) {
        actions.push(`drop pending assignment paciente clinic=${a.clinicId}`);
        if (args.apply) await ctx.db.delete(a._id);
      } else {
        actions.push(`repoint assignment.pacienteId clinic=${a.clinicId}`);
        if (args.apply) await ctx.db.patch(a._id, { pacienteId: args.realId });
      }
    }
    const assignmentsAsFisio = await ctx.db
      .query("assignments")
      .withIndex("by_fisioId_clinicId", (q) => q.eq("fisioId", args.pendingId))
      .collect();
    for (const a of assignmentsAsFisio) {
      actions.push(`repoint assignment.fisioId clinic=${a.clinicId}`);
      if (args.apply) await ctx.db.patch(a._id, { fisioId: args.realId });
    }

    // conversations: clave única por (pacienteId, fisioId, clinicId). Si
    // colisiona, fusionamos pasando los mensajes del pending al real y
    // borrando el documento pending.
    const convsAsPaciente = await ctx.db
      .query("conversations")
      .withIndex("by_pacienteId_lastMessageAt", (q) =>
        q.eq("pacienteId", args.pendingId),
      )
      .collect();
    for (const c of convsAsPaciente) {
      const collision = await ctx.db
        .query("conversations")
        .withIndex("by_paciente_fisio_clinic", (q) =>
          q
            .eq("pacienteId", args.realId)
            .eq("fisioId", c.fisioId)
            .eq("clinicId", c.clinicId),
        )
        .unique();
      if (collision) {
        actions.push(
          `merge conversation paciente clinic=${c.clinicId} fisio=${c.fisioId}`,
        );
        if (args.apply) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) =>
              q.eq("conversationId", c._id),
            )
            .collect();
          for (const m of msgs) {
            await ctx.db.patch(m._id, {
              conversationId: collision._id,
              ...(m.senderId === args.pendingId && {
                senderId: args.realId,
              }),
            });
          }
          await ctx.db.delete(c._id);
        }
      } else {
        actions.push(
          `repoint conversation.pacienteId clinic=${c.clinicId} fisio=${c.fisioId}`,
        );
        if (args.apply) {
          const patch: Partial<Doc<"conversations">> = {
            pacienteId: args.realId,
          };
          if (c.lastMessageSenderId === args.pendingId) {
            patch.lastMessageSenderId = args.realId;
          }
          await ctx.db.patch(c._id, patch);
        }
      }
    }
    const convsAsFisio = await ctx.db
      .query("conversations")
      .withIndex("by_fisioId_lastMessageAt", (q) =>
        q.eq("fisioId", args.pendingId),
      )
      .collect();
    for (const c of convsAsFisio) {
      actions.push(
        `repoint conversation.fisioId clinic=${c.clinicId} paciente=${c.pacienteId}`,
      );
      if (args.apply) {
        const patch: Partial<Doc<"conversations">> = { fisioId: args.realId };
        if (c.lastMessageSenderId === args.pendingId) {
          patch.lastMessageSenderId = args.realId;
        }
        await ctx.db.patch(c._id, patch);
      }
    }

    // messages enviados por el pending en conversaciones que no eran suyas
    // (sender pero no participante — caso raro pero posible si la
    // conversation ya estaba apuntada al real y los mensajes no).
    const msgsPending = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("senderId"), args.pendingId))
      .collect();
    for (const m of msgsPending) {
      actions.push(`repoint message.senderId`);
      if (args.apply) await ctx.db.patch(m._id, { senderId: args.realId });
    }

    // Otras tablas con referencia simple: re-apuntar sin lógica de colisión
    // (riesgo bajo en pending, pero defensivo).
    await repointSimple(
      ctx,
      args,
      actions,
      "plans",
      "pacienteId",
      "by_pacienteId",
    );
    await repointSimple(
      ctx,
      args,
      actions,
      "plans",
      "fisioId",
      "by_fisioId",
    );
    await repointSimple(
      ctx,
      args,
      actions,
      "sessions",
      "pacienteId",
      "by_pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "exerciseExecutions",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "dailyPatientRollup",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "weeklyPatientRollup",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "monthlyPatientRollup",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "patientMetricsSnapshot",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "patientMetricsSnapshot",
      "fisioId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "physioAlerts",
      "pacienteId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "physioAlerts",
      "revisadaPor",
    );
    await repointSimpleFilter(ctx, args, actions, "routines", "autorId");
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "accessCodes",
      "creadoPor",
    );
    await repointSimpleFilter(ctx, args, actions, "accessTokens", "userId");
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "accessTokens",
      "creadoPor",
    );
    await repointSimpleFilter(ctx, args, actions, "pushTokens", "userId");
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "notificationPreferences",
      "userId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "verificationCodes",
      "userId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "exerciseFavorites",
      "userId",
    );
    await repointSimpleFilter(ctx, args, actions, "clinics", "createdBy");
    await repointSimpleFilter(ctx, args, actions, "clinics", "ownerUserId");
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "clinicOwnershipAudit",
      "fromUserId",
    );
    await repointSimpleFilter(
      ctx,
      args,
      actions,
      "clinicOwnershipAudit",
      "toUserId",
    );

    actions.push(`delete pending user ${args.pendingId}`);
    if (args.apply) await ctx.db.delete(args.pendingId);

    return { ok: true, actions } as const;
  },
});

async function repointSimple(
  ctx: any,
  args: { pendingId: Id<"users">; realId: Id<"users">; apply: boolean },
  actions: string[],
  table: string,
  field: string,
  indexName: string,
): Promise<void> {
  const rows = await ctx.db
    .query(table)
    .withIndex(indexName, (q: any) => q.eq(field, args.pendingId))
    .collect();
  for (const r of rows) {
    actions.push(`repoint ${table}.${field}`);
    if (args.apply) await ctx.db.patch(r._id, { [field]: args.realId });
  }
}

// Sin índice por ese campo: hacemos filter (lento pero seguro en migration
// one-off).
async function repointSimpleFilter(
  ctx: any,
  args: { pendingId: Id<"users">; realId: Id<"users">; apply: boolean },
  actions: string[],
  table: string,
  field: string,
): Promise<void> {
  const rows = await ctx.db
    .query(table)
    .filter((q: any) => q.eq(q.field(field), args.pendingId))
    .collect();
  for (const r of rows) {
    actions.push(`repoint ${table}.${field}`);
    if (args.apply) await ctx.db.patch(r._id, { [field]: args.realId });
  }
}

export const cleanupArchivedConversations = internalMutation({
  args: { apply: v.boolean() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("conversations").collect();
    let deletedConvs = 0;
    let deletedMsgs = 0;
    for (const c of all) {
      if (c.archivedAt === undefined) continue;
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", c._id))
        .collect();
      deletedConvs++;
      deletedMsgs += msgs.length;
      if (args.apply) {
        for (const m of msgs) await ctx.db.delete(m._id);
        await ctx.db.delete(c._id);
      }
    }
    return { deletedConvs, deletedMsgs, apply: args.apply };
  },
});

type MigrationSummary = {
  apply: boolean;
  totalPairs: number;
  archivedCleanup: { deletedConvs: number; deletedMsgs: number; apply: boolean };
  summaries: Array<
    Pair & { ok: boolean; actions?: string[]; reason?: string }
  >;
};

async function runMigration(
  ctx: { runQuery: any; runMutation: any },
  apply: boolean,
): Promise<MigrationSummary> {
  const pairs: Pair[] = await ctx.runQuery(
    internal.migrations.dedupeUsersFromPendingMerge.findDuplicates,
    {},
  );

  const summaries: MigrationSummary["summaries"] = [];
  for (const pair of pairs) {
    const res = await ctx.runMutation(
      internal.migrations.dedupeUsersFromPendingMerge.mergePair,
      { pendingId: pair.pendingId, realId: pair.realId, apply },
    );
    summaries.push({ ...pair, ...res });
    console.info(`[dedupe] email=${pair.email} apply=${apply}`, res);
  }

  const archivedCleanup: MigrationSummary["archivedCleanup"] =
    await ctx.runMutation(
      internal.migrations.dedupeUsersFromPendingMerge
        .cleanupArchivedConversations,
      { apply },
    );
  console.info(`[dedupe] archived cleanup apply=${apply}`, archivedCleanup);

  return {
    apply,
    totalPairs: pairs.length,
    archivedCleanup,
    summaries,
  };
}

export const dryRun = internalAction({
  args: {},
  handler: async (ctx): Promise<MigrationSummary> => runMigration(ctx, false),
});

export const apply = internalAction({
  args: {},
  handler: async (ctx): Promise<MigrationSummary> => runMigration(ctx, true),
});
