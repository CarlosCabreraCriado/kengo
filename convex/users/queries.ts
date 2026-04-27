import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  esPaciente,
  tieneGestion,
} from "../_helpers/permissions";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
      .unique();

    if (!user) return null;

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const clinicas = await Promise.all(
      memberships.map(async (m) => {
        const clinic = await ctx.db.get(m.clinicId);
        if (!clinic) return null;
        return {
          clinicId: clinic._id,
          puesto: m.puesto,
          nombre: clinic.nombre,
        };
      }),
    );

    const clinicasFiltered = clinicas.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    );

    const hasFisioAccess = memberships.some((m) => tieneGestion(m.puesto));
    const hasPacienteAccess = memberships.some((m) => esPaciente(m.puesto));

    const detalle = {
      dni: user.dni ?? "",
      telefono: user.telefono ?? "",
      direccion: user.direccion ?? "",
      postal: user.postal ?? "",
    };

    return {
      ...user,
      clinicas: clinicasFiltered,
      esFisio: hasFisioAccess,
      esPaciente: hasPacienteAccess || !hasFisioAccess,
      detalle,
    };
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Lista pacientes (puesto="paciente") de una o varias clínicas. Deduplica
 * por userId cuando un paciente pertenece a múltiples clínicas del fisio.
 */
export const listPatientsByClinic = query({
  args: {
    clinicId: v.optional(v.id("clinics")),
    clinicIds: v.optional(v.array(v.id("clinics"))),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const resolvedIds =
      args.clinicIds ?? (args.clinicId ? [args.clinicId] : []);
    if (resolvedIds.length === 0) {
      return { results: [], total: 0 };
    }

    const allMemberships = await Promise.all(
      resolvedIds.map((cid) =>
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_clinicId", (q) => q.eq("clinicId", cid))
          .collect(),
      ),
    );

    const allowedUserIds = new Set<Id<"users">>(
      allMemberships
        .flat()
        .filter((m) => esPaciente(m.puesto))
        .map((m) => m.userId),
    );

    let filtered: Array<{
      _id: Id<"users">;
      _creationTime: number;
      firstName: string;
      lastName: string;
      [k: string]: unknown;
    }>;

    if (args.search && args.search.trim().length > 0) {
      const term = args.search.trim().toLowerCase();
      const searchHits = await ctx.db
        .query("users")
        .withSearchIndex("search_users", (q) => q.search("searchableText", term))
        .take(500);
      filtered = searchHits.filter((u) => allowedUserIds.has(u._id));
    } else {
      const userIds = Array.from(allowedUserIds);
      const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
      filtered = users.filter((u): u is NonNullable<typeof u> => u !== null);
    }

    filtered.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      ),
    );

    const total = filtered.length;
    const offset = args.offset ?? 0;
    const limit = args.limit ?? filtered.length;
    const results = filtered.slice(offset, offset + limit);

    return { results, total };
  },
});

/**
 * Lista fisios+admins de una o varias clínicas. Deduplica por userId,
 * preservando admin sobre fisio.
 */
export const listFisiosByClinic = query({
  args: {
    clinicId: v.optional(v.id("clinics")),
    clinicIds: v.optional(v.array(v.id("clinics"))),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const resolvedIds =
      args.clinicIds ?? (args.clinicId ? [args.clinicId] : []);
    if (resolvedIds.length === 0) return [];

    const allMemberships = await Promise.all(
      resolvedIds.map((cid) =>
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_clinicId", (q) => q.eq("clinicId", cid))
          .collect(),
      ),
    );

    // Preferimos "admin" sobre "fisio" cuando un usuario tiene ambos puestos
    // en la misma colección de clínicas.
    const byUserId = new Map<Id<"users">, "fisio" | "admin">();
    for (const m of allMemberships.flat()) {
      if (!tieneGestion(m.puesto)) continue;
      const current = byUserId.get(m.userId);
      if (current === "admin") continue;
      byUserId.set(m.userId, m.puesto as "fisio" | "admin");
    }

    const userEntries = Array.from(byUserId.entries());
    const users = await Promise.all(
      userEntries.map(([userId]) => ctx.db.get(userId)),
    );

    return users
      .map((u, i) => (u ? { ...u, puesto: userEntries[i][1] } : null))
      .filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
