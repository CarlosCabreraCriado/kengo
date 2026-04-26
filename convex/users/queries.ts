import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  esPaciente,
  tieneGestion,
  puestoToNumber,
  puestoToNombre,
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
          id_clinica: clinic.legacyId ?? 0,
          id_puesto: puestoToNumber(m.puesto),
          puesto: puestoToNombre(m.puesto),
          convexClinicId: clinic._id,
          nombre: clinic.nombre,
        };
      }),
    );

    const clinicasFiltered = clinicas.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    );

    const hasFisioAccess = memberships.some((m) => tieneGestion(m.puesto));
    const hasPacienteAccess = memberships.some((m) => esPaciente(m.puesto));

    const hasInlineDetalle =
      user.dni !== undefined ||
      user.telefono !== undefined ||
      user.direccion !== undefined ||
      user.postal !== undefined;

    const legacyDetalle = hasInlineDetalle
      ? null
      : await ctx.db
          .query("userDetails")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();

    const detalle = hasInlineDetalle
      ? {
          dni: user.dni ?? "",
          telefono: user.telefono ?? "",
          direccion: user.direccion ?? "",
          postal: user.postal ?? "",
        }
      : legacyDetalle
        ? {
            dni: legacyDetalle.dni ?? "",
            telefono: legacyDetalle.telefono ?? "",
            direccion: legacyDetalle.direccion ?? "",
            postal: legacyDetalle.postal ?? "",
          }
        : null;

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

export const getByLegacyId = query({
  args: { legacyDirectusId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_legacyDirectusId", (q) =>
        q.eq("legacyDirectusId", args.legacyDirectusId),
      )
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
          id_clinica: clinic.legacyId ?? 0,
          id_puesto: puestoToNumber(m.puesto),
          puesto: puestoToNombre(m.puesto),
          convexClinicId: clinic._id,
          nombre: clinic.nombre,
        };
      }),
    );

    const hasInlineDetalle =
      user.dni !== undefined ||
      user.telefono !== undefined ||
      user.direccion !== undefined ||
      user.postal !== undefined;

    const legacyDetalle = hasInlineDetalle
      ? null
      : await ctx.db
          .query("userDetails")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();

    const detalle = hasInlineDetalle
      ? {
          dni: user.dni ?? "",
          telefono: user.telefono ?? "",
          direccion: user.direccion ?? "",
          postal: user.postal ?? "",
        }
      : legacyDetalle
        ? {
            dni: legacyDetalle.dni ?? "",
            telefono: legacyDetalle.telefono ?? "",
            direccion: legacyDetalle.direccion ?? "",
            postal: legacyDetalle.postal ?? "",
          }
        : null;

    return {
      ...user,
      clinicas: clinicas.filter((c): c is NonNullable<typeof c> => c !== null),
      detalle,
    };
  },
});

async function resolveClinicIds(
  ctx: any,
  clinicLegacyIds?: number[],
  clinicIds?: Id<"clinics">[],
): Promise<Id<"clinics">[]> {
  if (clinicIds && clinicIds.length > 0) return clinicIds;
  if (!clinicLegacyIds || clinicLegacyIds.length === 0) return [];

  const clinics = await Promise.all(
    clinicLegacyIds.map((legacyId) =>
      ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q: any) => q.eq("legacyId", legacyId))
        .unique(),
    ),
  );
  return clinics
    .filter((c: any): c is { _id: Id<"clinics"> } => c !== null)
    .map((c: any) => c._id);
}

/**
 * Lista pacientes (puesto=2) de una o varias clínicas. Deduplica por userId
 * cuando un paciente pertenece a múltiples clínicas del fisio.
 */
export const listPatientsByClinic = query({
  args: {
    clinicLegacyId: v.optional(v.number()),
    clinicId: v.optional(v.id("clinics")),
    clinicLegacyIds: v.optional(v.array(v.number())),
    clinicIds: v.optional(v.array(v.id("clinics"))),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const legacyIds =
      args.clinicLegacyIds ??
      (args.clinicLegacyId !== undefined ? [args.clinicLegacyId] : undefined);
    const ids =
      args.clinicIds ?? (args.clinicId ? [args.clinicId] : undefined);

    const resolvedIds = await resolveClinicIds(ctx, legacyIds, ids);
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

    let filtered: any[];

    if (args.search && args.search.trim().length > 0) {
      // Usar el search index full-text y luego filtrar por las clínicas
      // permitidas en memoria. El take(500) acota el resultado del search.
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
 * Lista fisios+admins (puesto=1 o 4) de una o varias clínicas. Deduplica.
 */
export const listFisiosByClinic = query({
  args: {
    clinicLegacyId: v.optional(v.number()),
    clinicId: v.optional(v.id("clinics")),
    clinicLegacyIds: v.optional(v.array(v.number())),
    clinicIds: v.optional(v.array(v.id("clinics"))),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    const legacyIds =
      args.clinicLegacyIds ??
      (args.clinicLegacyId !== undefined ? [args.clinicLegacyId] : undefined);
    const ids =
      args.clinicIds ?? (args.clinicId ? [args.clinicId] : undefined);

    const resolvedIds = await resolveClinicIds(ctx, legacyIds, ids);
    if (resolvedIds.length === 0) return [];

    const allMemberships = await Promise.all(
      resolvedIds.map((cid) =>
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_clinicId", (q) => q.eq("clinicId", cid))
          .collect(),
      ),
    );

    // Filtrar gestión y deduplicar por userId, preservando admin sobre fisio.
    const byUserId = new Map<Id<"users">, number>();
    for (const m of allMemberships.flat()) {
      if (!tieneGestion(m.puesto)) continue;
      const numericPuesto = puestoToNumber(m.puesto);
      const existing = byUserId.get(m.userId);
      if (!existing || numericPuesto > existing) {
        byUserId.set(m.userId, numericPuesto);
      }
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
