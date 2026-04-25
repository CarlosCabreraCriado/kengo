import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

import detalleData from "./data/detalle_usuario.json";

export const insertUserDetailsBatch = internalMutation({
  args: {
    entries: v.array(
      v.object({
        userLegacyId: v.string(),
        dni: v.optional(v.string()),
        fechaNacimiento: v.optional(v.string()),
        sexo: v.optional(v.string()),
        direccion: v.optional(v.string()),
        postal: v.optional(v.string()),
        telefono: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let notFound = 0;

    for (const entry of args.entries) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", entry.userLegacyId),
        )
        .unique();

      if (!user) {
        notFound++;
        continue;
      }

      const existing = await ctx.db
        .query("userDetails")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();

      const payload = {
        userId: user._id,
        dni: entry.dni,
        fechaNacimiento: entry.fechaNacimiento,
        sexo: entry.sexo,
        direccion: entry.direccion,
        postal: entry.postal,
        telefono: entry.telefono,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated++;
      } else {
        await ctx.db.insert("userDetails", payload);
        created++;
      }
    }

    return { created, updated, notFound };
  },
});

export const seed = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    total: number;
    created: number;
    updated: number;
    notFound: number;
  }> => {
    const rows = (detalleData as any).detalle_usuario as Array<{
      id_detalle_usuario: number;
      id_usuario: string;
      dni: string | null;
      fecha_nacimiento: string | null;
      direccion: string | null;
      postal: string | null;
      telefono: string | null;
      sexo: string | null;
    }>;

    console.log(`[seedUserDetails] Procesando ${rows.length} filas`);

    const entries = rows
      .filter((r) => !!r.id_usuario)
      .map((r) => ({
        userLegacyId: r.id_usuario,
        dni: r.dni ?? undefined,
        fechaNacimiento: r.fecha_nacimiento ?? undefined,
        sexo: r.sexo ?? undefined,
        direccion: r.direccion ?? undefined,
        postal: r.postal ?? undefined,
        telefono: r.telefono ?? undefined,
      }));

    const BATCH_SIZE = 50;
    let created = 0;
    let updated = 0;
    let notFound = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const result: { created: number; updated: number; notFound: number } =
        await ctx.runMutation(
          internal.seed.seedUserDetails.insertUserDetailsBatch,
          { entries: batch },
        );
      created += result.created;
      updated += result.updated;
      notFound += result.notFound;
    }

    console.log(
      `[seedUserDetails] Total: ${entries.length}, creados: ${created}, actualizados: ${updated}, no encontrados: ${notFound}`,
    );

    return { total: entries.length, created, updated, notFound };
  },
});
