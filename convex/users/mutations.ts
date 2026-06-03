import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  checkClinicPermission,
  getAuthenticatedUser,
  requireActiveSubscription,
  requireAnyActiveSubscriptionForUser,
} from "../_helpers/permissions";

function buildSearchableText(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  return [firstName ?? "", lastName ?? "", email ?? ""]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean)
    .join(" ");
}

export const upsertFromAuth = internalMutation({
  args: {
    externalId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    emailVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    const searchableText = buildSearchableText(
      args.firstName,
      args.lastName,
      args.email,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        emailVerified: args.emailVerified,
        searchableText,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      externalId: args.externalId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      emailVerified: args.emailVerified,
      searchableText,
    });
  },
});

/**
 * Actualiza datos del perfil del usuario autenticado (campos no sensibles).
 */
export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    numeroColegiado: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const patch: Record<string, unknown> = {};
    if (args.firstName !== undefined) patch["firstName"] = args.firstName;
    if (args.lastName !== undefined) patch["lastName"] = args.lastName;
    if (args.email !== undefined)
      patch["email"] = args.email.toLowerCase().trim();
    if (args.telefono !== undefined) patch["telefono"] = args.telefono;
    if (args.direccion !== undefined) patch["direccion"] = args.direccion;
    if (args.postal !== undefined) patch["postal"] = args.postal;
    if (args.numeroColegiado !== undefined)
      patch["numeroColegiado"] = args.numeroColegiado;

    if (Object.keys(patch).length === 0) return user._id;

    if (
      args.firstName !== undefined ||
      args.lastName !== undefined ||
      args.email !== undefined
    ) {
      patch["searchableText"] = buildSearchableText(
        args.firstName ?? user.firstName,
        args.lastName ?? user.lastName,
        (args.email ?? user.email)?.toLowerCase().trim(),
      );
    }

    await ctx.db.patch(user._id, patch);
    return user._id;
  },
});

/**
 * Actualiza el avatar del usuario autenticado.
 * El cliente sube el archivo a R2 vía `storage/actions.generateUploadUrl` y
 * pasa la `key` resultante (ej. `avatars/<uuid>.jpg`) que se renderiza
 * después con `assetUrl(key)`.
 */
export const updateAvatar = mutation({
  args: {
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await ctx.db.patch(user._id, { avatar: args.key ?? undefined });
    return user._id;
  },
});

/**
 * Crea (o actualiza) el documento de usuario y su clinicMembership como paciente.
 * NO crea la cuenta Better-Auth ni envía email — eso es responsabilidad de la
 * action `createPatient` que orquesta todo.
 *
 * Si ya existe un usuario con el email, se reutiliza y solo se asegura la
 * membresía. Devuelve el `userId` Convex y un flag `created` indicando si fue
 * inserción nueva.
 */
export const upsertPatientWithMembership = internalMutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    telefono: v.optional(v.string()),
    clinicId: v.id("clinics"),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    const searchableText = buildSearchableText(
      args.firstName,
      args.lastName,
      email,
    );

    let created = false;
    if (!user) {
      const userId = await ctx.db.insert("users", {
        externalId: `pending-${email}`,
        email,
        emailVerified: false,
        firstName: args.firstName,
        lastName: args.lastName,
        telefono: args.telefono,
        searchableText,
      });
      user = await ctx.db.get(userId);
      created = true;
    } else {
      // Actualizar datos básicos por si cambiaron
      await ctx.db.patch(user._id, {
        firstName: args.firstName,
        lastName: args.lastName,
        ...(args.telefono !== undefined && { telefono: args.telefono }),
        searchableText,
      });
    }

    if (!user) throw new Error("Error creando usuario");

    // Garantizar membresía como paciente (puesto=2)
    const existingMembership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", user!._id).eq("clinicId", args.clinicId),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("clinicMemberships", {
        userId: user._id,
        clinicId: args.clinicId,
        puesto: "paciente",
      });
    }

    return { userId: user._id as Id<"users">, created };
  },
});

/**
 * Actualiza datos básicos de un paciente y reconcilia sus membresías de clínica.
 * Mutation regular llamable desde el frontend (con permisos del fisio).
 */
export const updatePatient = mutation({
  args: {
    patientId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    /**
     * Clínica activa del fisio en el frontend. Cuando se proporciona se
     * valida estrictamente contra esa clínica (regla multiclínica: la activa
     * manda). Si no se pasa, fallback al chequeo "any" — deuda transitoria.
     */
    clinicId: v.optional(v.id("clinics")),
    clinicMemberships: v.optional(
      v.array(
        v.object({
          clinicId: v.id("clinics"),
          puesto: v.union(
            v.literal("fisio"),
            v.literal("paciente"),
            v.literal("admin"),
          ),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const fisio = await getAuthenticatedUser(ctx);
    if (args.clinicId) {
      await checkClinicPermission(ctx, fisio._id, args.clinicId, [
        "fisio",
        "admin",
      ]);
      await requireActiveSubscription(ctx, args.clinicId);
    } else {
      await requireAnyActiveSubscriptionForUser(ctx, fisio._id);
    }
    const patientId: Id<"users"> = args.patientId;

    // Patch de datos básicos
    const patch: Record<string, unknown> = {};
    if (args.firstName !== undefined) patch["firstName"] = args.firstName;
    if (args.lastName !== undefined) patch["lastName"] = args.lastName;
    if (args.email !== undefined)
      patch["email"] = args.email.toLowerCase().trim();
    if (args.telefono !== undefined) patch["telefono"] = args.telefono;

    if (
      args.firstName !== undefined ||
      args.lastName !== undefined ||
      args.email !== undefined
    ) {
      const current = await ctx.db.get(patientId);
      if (current) {
        patch["searchableText"] = buildSearchableText(
          args.firstName ?? current.firstName,
          args.lastName ?? current.lastName,
          (args.email ?? current.email)?.toLowerCase().trim(),
        );
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(patientId, patch);
    }

    // Reconciliar membresías si se proporcionan
    if (args.clinicMemberships) {
      const existing = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_userId", (q) => q.eq("userId", patientId!))
        .collect();

      const desiredKeys = new Set(
        args.clinicMemberships.map((m) => `${m.clinicId}-${m.puesto}`),
      );
      const existingKeys = new Set(
        existing.map((m) => `${m.clinicId}-${m.puesto}`),
      );

      // Eliminar las que ya no están
      for (const m of existing) {
        if (!desiredKeys.has(`${m.clinicId}-${m.puesto}`)) {
          await ctx.db.delete(m._id);
        }
      }

      // Crear las nuevas
      for (const m of args.clinicMemberships) {
        if (!existingKeys.has(`${m.clinicId}-${m.puesto}`)) {
          await ctx.db.insert("clinicMemberships", {
            userId: patientId,
            clinicId: m.clinicId,
            puesto: m.puesto,
            tambienEsPaciente:
              m.puesto === "fisio" || m.puesto === "admin" ? true : undefined,
          });
        }
      }
    }

    return patientId;
  },
});
