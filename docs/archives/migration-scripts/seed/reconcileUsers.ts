import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

import usersData from "./data/directus_users.json";

type ReconcilePatch = {
  telefono?: string;
  direccion?: string;
  postal?: string;
  numeroColegiado?: string;
};

export const reconcileBatch = internalMutation({
  args: {
    users: v.array(
      v.object({
        legacyDirectusId: v.string(),
        telefono: v.optional(v.string()),
        direccion: v.optional(v.string()),
        postal: v.optional(v.string()),
        numeroColegiado: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const isEmpty = (val?: string | null) =>
      val === undefined || val === null || val.trim() === "";

    let touched = 0;
    let skipped = 0;
    let notFound = 0;

    for (const src of args.users) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", src.legacyDirectusId),
        )
        .unique();

      if (!u) {
        notFound++;
        continue;
      }

      const patch: ReconcilePatch = {};
      if (!isEmpty(src.telefono)) patch.telefono = src.telefono;
      if (!isEmpty(src.direccion)) patch.direccion = src.direccion;
      if (!isEmpty(src.postal)) patch.postal = src.postal;
      if (!isEmpty(src.numeroColegiado))
        patch.numeroColegiado = src.numeroColegiado;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(u._id, patch);
        touched++;
      } else {
        skipped++;
      }
    }

    return { touched, skipped, notFound };
  },
});

export const reconcile = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ touched: number; skipped: number; notFound: number }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = (usersData as any).directus_users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((u: any) => u.status === "active" && u.email)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => ({
        legacyDirectusId: u.id as string,
        telefono:
          u.telefono && typeof u.telefono === "string" && u.telefono.trim()
            ? u.telefono.trim()
            : undefined,
        direccion: u.direccion ?? undefined,
        postal: u.postal ?? undefined,
        numeroColegiado: u.numero_colegiado ?? undefined,
      }));

    const BATCH = 50;
    let touched = 0;
    let skipped = 0;
    let notFound = 0;

    for (let i = 0; i < active.length; i += BATCH) {
      const batch = active.slice(i, i + BATCH);
      const r: { touched: number; skipped: number; notFound: number } =
        await ctx.runMutation(
          internal.seed.reconcileUsers.reconcileBatch,
          { users: batch },
        );
      touched += r.touched;
      skipped += r.skipped;
      notFound += r.notFound;
    }

    console.log(
      `[reconcileUsers] touched=${touched} skipped=${skipped} notFound=${notFound}`,
    );
    return { touched, skipped, notFound };
  },
});
