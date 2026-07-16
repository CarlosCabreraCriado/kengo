import { ConvexError, v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  checkClinicPermission,
  getAuthenticatedUser,
  requireActiveSubscription,
  requireAnyActiveSubscriptionForUser,
  tieneGestion,
} from "../_helpers/permissions";
import { assertCanAccessPaciente } from "../_helpers/authorization";
import { getManagedClinicIds } from "../_helpers/patientAccess";

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

    // Fallback por email: si un fisio creó al paciente con
    // `upsertPatientWithMembership`, el registro existe como `pending-<email>`.
    // Al activar la cuenta vía Better-Auth, no hay que duplicar el `users`
    // (eso desacopla la conversación previa y rompe `listMessages` con
    // "No tienes acceso"). Promovemos el pending al externalId real.
    const email = args.email.toLowerCase().trim();
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (byEmail) {
      if (byEmail.externalId.startsWith("pending-")) {
        await ctx.db.patch(byEmail._id, {
          externalId: args.externalId,
          email: args.email,
          firstName: args.firstName,
          lastName: args.lastName,
          emailVerified: args.emailVerified,
          searchableText,
        });
        return byEmail._id;
      }
      // Colisión: ya hay otra cuenta activa con este email vinculada a un
      // externalId distinto. No fusionamos (riesgo de mezclar identidades);
      // abortamos el sign-in para forzar resolución manual.
      throw new Error(
        "Conflicto: este email ya está vinculado a otra cuenta. Contacta con soporte.",
      );
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
 * Reglas de preservación de datos (evita que un fisio sobrescriba a otros
 * usuarios de la plataforma):
 *  - Email no existe → inserta nuevo usuario con los datos del form.
 *  - Existe pero pending (`externalId="pending-…"`) → patchea datos del form
 *    (la "creación" inicial nunca fue confirmada por el propio usuario).
 *  - Existe activo, ya es paciente en clinicId → `DUPLICADO_EN_CLINICA`.
 *  - Existe activo, es fisio/admin en clinicId → `STAFF_EN_CLINICA`.
 *  - Existe activo, sin membership en clinicId y sin `confirmReuseExisting` →
 *    `REQUIRES_CONFIRMATION` (la action debe relanzar pidiendo confirmación).
 *  - Existe activo + `confirmReuseExisting=true` → NO toca firstName/lastName/
 *    telefono; solo añade la membresía como paciente.
 *
 * Devuelve `{ userId, created }`. `created` es true solo cuando se inserta
 * un documento `users` nuevo.
 */
export const upsertPatientWithMembership = internalMutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    telefono: v.optional(v.string()),
    clinicId: v.id("clinics"),
    confirmReuseExisting: v.boolean(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    let created = false;
    if (!user) {
      const searchableText = buildSearchableText(
        args.firstName,
        args.lastName,
        email,
      );
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
      const isPending = user.externalId.startsWith("pending-");
      if (isPending) {
        // El usuario fue creado por otro fisio pero nunca activó la cuenta:
        // permitimos sobrescribir los datos con los del form actual.
        const searchableText = buildSearchableText(
          args.firstName,
          args.lastName,
          email,
        );
        await ctx.db.patch(user._id, {
          firstName: args.firstName,
          lastName: args.lastName,
          ...(args.telefono !== undefined && { telefono: args.telefono }),
          searchableText,
        });
      } else {
        // Usuario activo: comprobar membership en la clínica destino antes
        // de exigir confirmación, para que los códigos de error sean precisos.
        const existing = await ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId_clinicId", (q) =>
            q.eq("userId", user!._id).eq("clinicId", args.clinicId),
          )
          .unique();

        if (existing?.puesto === "paciente") {
          throw new ConvexError({
            code: "DUPLICADO_EN_CLINICA",
            message: "Este paciente ya está registrado en tu clínica.",
          });
        }
        if (existing && tieneGestion(existing.puesto)) {
          throw new ConvexError({
            code: "STAFF_EN_CLINICA",
            message:
              "Este email pertenece a un profesional de esta clínica.",
          });
        }

        if (!args.confirmReuseExisting) {
          throw new ConvexError({
            code: "REQUIRES_CONFIRMATION",
            message:
              "Este email ya está registrado en la plataforma. Confirma la vinculación.",
          });
        }

        // Confirmado: vinculamos sin tocar nombre/apellidos/teléfono globales.
      }
    }

    if (!user) throw new Error("Error creando usuario");

    // Garantizar membresía como paciente (idempotente para los casos pending
    // y nuevo; para "activo confirmado" se ejecuta aquí porque ya sabemos que
    // no había membresía conflictiva).
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
    // El paciente debe ser accesible por el fisio (miembro paciente de una
    // clínica que gestiona). Sin esto, un fisio podía editar datos o
    // reconciliar membresías de un paciente de una clínica ajena.
    await assertCanAccessPaciente(ctx, fisio._id, patientId);

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

    // Reconciliar membresías si se proporcionan. La reconciliación se limita
    // ESTRICTAMENTE a las clínicas que el fisio gestiona: nunca se tocan las
    // membresías del paciente en clínicas ajenas (ni se borran ni se crean).
    if (args.clinicMemberships) {
      const managedClinicIds = new Set(
        (await getManagedClinicIds(ctx, fisio._id)).map((id) => String(id)),
      );

      // Rechazar cualquier intento de crear membresía en una clínica que el
      // fisio no gestiona.
      for (const m of args.clinicMemberships) {
        if (!managedClinicIds.has(String(m.clinicId))) {
          throw new ConvexError({
            code: "NO_ACCESO",
            message:
              "No puedes modificar membresías en una clínica que no gestionas.",
          });
        }
      }

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

      // Eliminar las que ya no están, SOLO en clínicas gestionadas.
      for (const m of existing) {
        if (!managedClinicIds.has(String(m.clinicId))) continue;
        if (!desiredKeys.has(`${m.clinicId}-${m.puesto}`)) {
          await ctx.db.delete(m._id);
        }
      }

      // Crear las nuevas (ya validado que su clínica es gestionada).
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
