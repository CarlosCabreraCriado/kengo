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
          id_puesto: m.puesto,
          puesto: PUESTO_NOMBRES[m.puesto] ?? null,
          convexClinicId: clinic._id,
          nombre: clinic.nombre,
        };
      }),
    );

    const clinicasFiltered = clinicas.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    );

    const hasFisioAccess = clinicasFiltered.some(
      (c) =>
        c.id_puesto === PUESTO_FISIOTERAPEUTA ||
        c.id_puesto === PUESTO_ADMINISTRADOR,
    );
    const hasPacienteAccess = clinicasFiltered.some(
      (c) => c.id_puesto === PUESTO_PACIENTE,
    );

    const detalle = await ctx.db
      .query("userDetails")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    return {
      ...user,
      clinicas: clinicasFiltered,
      esFisio: hasFisioAccess,
      esPaciente: hasPacienteAccess || !hasFisioAccess,
      detalle: detalle
        ? {
            dni: detalle.dni ?? "",
            telefono: detalle.telefono ?? "",
            direccion: detalle.direccion ?? "",
            postal: detalle.postal ?? "",
          }
        : null,
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
          id_puesto: m.puesto,
          puesto: PUESTO_NOMBRES[m.puesto] ?? null,
          convexClinicId: clinic._id,
          nombre: clinic.nombre,
        };
      }),
    );

    const detalle = await ctx.db
      .query("userDetails")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    return {
      ...user,
      clinicas: clinicas.filter((c): c is NonNullable<typeof c> => c !== null),
      detalle: detalle
        ? {
            dni: detalle.dni ?? "",
            telefono: detalle.telefono ?? "",
            direccion: detalle.direccion ?? "",
            postal: detalle.postal ?? "",
          }
        : null,
    };
  },
});

/**
 * Lista pacientes (puesto=2) de una clínica.
 * Soporta búsqueda por nombre/email, paginación offset.
 * Reemplaza GET /directus/users con filtro por id_puesto=2 y clínica.
 */
export const listPatientsByClinic = query({
  args: {
    clinicLegacyId: v.optional(v.number()),
    clinicId: v.optional(v.id("clinics")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    let clinicId: Id<"clinics"> | null = args.clinicId ?? null;
    if (!clinicId && args.clinicLegacyId !== undefined) {
      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", args.clinicLegacyId))
        .unique();
      clinicId = clinic?._id ?? null;
    }

    if (!clinicId) {
      return { results: [], total: 0 };
    }

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId!))
      .filter((q) => q.eq(q.field("puesto"), PUESTO_PACIENTE))
      .collect();

    const users = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user;
      }),
    );

    let filtered = users.filter(
      (u): u is NonNullable<typeof u> => u !== null,
    );

    // Filtro búsqueda por nombre/email (case-insensitive)
    if (args.search && args.search.trim().length > 0) {
      const term = args.search.trim().toLowerCase();
      filtered = filtered.filter((u) => {
        const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
        return (
          fullName.includes(term) ||
          (u.email ?? "").toLowerCase().includes(term)
        );
      });
    }

    // Sort por nombre asc para estabilidad
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
 * Lista fisios+admins (puesto=1 o 4) de una clínica.
 */
export const listFisiosByClinic = query({
  args: {
    clinicLegacyId: v.optional(v.number()),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);

    let clinicId: Id<"clinics"> | null = args.clinicId ?? null;
    if (!clinicId && args.clinicLegacyId !== undefined) {
      const clinic = await ctx.db
        .query("clinics")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", args.clinicLegacyId))
        .unique();
      clinicId = clinic?._id ?? null;
    }

    if (!clinicId) return [];

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId!))
      .filter((q) =>
        q.or(
          q.eq(q.field("puesto"), PUESTO_FISIOTERAPEUTA),
          q.eq(q.field("puesto"), PUESTO_ADMINISTRADOR),
        ),
      )
      .collect();

    const users = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;
        return { ...user, puesto: m.puesto };
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
