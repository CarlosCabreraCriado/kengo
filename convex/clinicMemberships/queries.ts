import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_PACIENTE,
  PUESTO_ADMINISTRADOR,
} from "../_helpers/permissions";

const PUESTO_NOMBRES: Record<number, string> = {
  [PUESTO_FISIOTERAPEUTA]: "fisioterapeuta",
  [PUESTO_PACIENTE]: "paciente",
  [PUESTO_ADMINISTRADOR]: "administrador",
};

/**
 * Lista membresías de un usuario con datos de clínica anidados.
 * Reemplaza GET /directus/items/usuarios_clinicas?filter[id_usuario].
 */
export const listByUser = query({
  args: {
    userId: v.optional(v.id("users")),
    userLegacyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await getAuthenticatedUser(ctx);

    let userId: Id<"users"> | null = args.userId ?? null;
    if (!userId && args.userLegacyId) {
      const u = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", args.userLegacyId!),
        )
        .unique();
      userId = u?._id ?? null;
    }
    if (!userId) userId = requester._id;

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId!))
      .collect();

    const enriched = await Promise.all(
      memberships.map(async (m) => {
        const clinic = await ctx.db.get(m.clinicId);
        return {
          _id: m._id,
          id_usuario: userId,
          id_clinica: clinic?.legacyId ?? 0,
          convexClinicId: m.clinicId,
          id_puesto: m.puesto,
          puesto: PUESTO_NOMBRES[m.puesto] ?? null,
          nombreClinica: clinic?.nombre ?? null,
        };
      }),
    );

    return enriched;
  },
});
