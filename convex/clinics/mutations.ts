import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  assertOwnerIsAdmin,
  assertOwnerOnClinic,
  getAuthenticatedUser,
  checkClinicPermission,
} from "../_helpers/permissions";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function assertHexColor(value: string | undefined, field: string) {
  if (value === undefined) return;
  if (!HEX_COLOR.test(value)) {
    throw new Error(`${field} debe ser un color hex válido (#RRGGBB)`);
  }
}

export const create = mutation({
  args: {
    nombre: v.string(),
    nombreComercial: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    web: v.optional(v.string()),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
    // R2 key (`logos/<uuid>.<ext>`) ya subida, a vincular como logo de la clínica.
    logo: v.optional(v.string()),
    // Keys de R2 ya subidas (prefix `clinic-files/`) a vincular como galería.
    addImageKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertHexColor(args.colorPrimario, "colorPrimario");
    assertHexColor(args.colorSecundario, "colorSecundario");

    if (args.logo !== undefined && !args.logo.startsWith("logos/")) {
      throw new Error("Key de logo inválida");
    }

    const clinicId = await ctx.db.insert("clinics", {
      nombre: args.nombre,
      nombreComercial: args.nombreComercial,
      telefono: args.telefono,
      email: args.email,
      web: args.web,
      direccion: args.direccion,
      postal: args.postal,
      nif: args.nif,
      colorPrimario: args.colorPrimario,
      colorSecundario: args.colorSecundario,
      logo: args.logo,
      createdBy: user._id,
      // El creador queda automáticamente como propietario (único responsable
      // del billing). Mantiene la invariante "siempre hay exactamente un
      // owner por clínica" desde la creación, sin pasar por backfill.
      ownerUserId: user._id,
    });

    await ctx.db.insert("clinicMemberships", {
      userId: user._id,
      clinicId,
      puesto: "admin",
      tambienEsPaciente: true,
    });

    if (args.addImageKeys && args.addImageKeys.length > 0) {
      for (const key of args.addImageKeys) {
        if (!key.startsWith("clinic-files/")) {
          throw new Error("Key de imagen inválida");
        }
        await ctx.db.insert("clinicFiles", {
          clinicId,
          fileId: key,
        });
      }
    }

    // Encolar creación del customer + suscripción con trial en Stripe.
    // Si falla no afecta a la creación de la clínica (se podrá reintentar
    // desde la pantalla de suscripción en sesiones futuras).
    await ctx.scheduler.runAfter(
      0,
      internal.billing.actions.startTrialForClinic,
      { clinicId },
    );

    return clinicId;
  },
});

export const update = mutation({
  args: {
    clinicId: v.id("clinics"),
    nombre: v.optional(v.string()),
    nombreComercial: v.optional(v.union(v.string(), v.null())),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    web: v.optional(v.union(v.string(), v.null())),
    direccion: v.optional(v.string()),
    postal: v.optional(v.string()),
    nif: v.optional(v.string()),
    colorPrimario: v.optional(v.string()),
    colorSecundario: v.optional(v.string()),
    // R2 key (`logos/<uuid>.<ext>`) o null para eliminar el logo.
    logo: v.optional(v.union(v.string(), v.null())),
    // Keys de R2 ya subidas (prefix `clinic-files/`) a vincular como galería.
    addImageKeys: v.optional(v.array(v.string())),
    // IDs de `clinicFiles` a desvincular (sus keys se devuelven en orphanedKeys).
    removeImageIds: v.optional(v.array(v.id("clinicFiles"))),
  },
  handler: async (ctx, args): Promise<{ orphanedKeys: string[] }> => {
    const user = await getAuthenticatedUser(ctx);
    await checkClinicPermission(ctx, user._id, args.clinicId, ["admin"]);
    assertHexColor(args.colorPrimario, "colorPrimario");
    assertHexColor(args.colorSecundario, "colorSecundario");

    const current = await ctx.db.get(args.clinicId);
    if (!current) throw new Error("Clínica no encontrada");

    const orphanedKeys: string[] = [];

    // Logo reemplazado o eliminado: la key antigua queda huérfana.
    if (args.logo !== undefined && current.logo && current.logo !== args.logo) {
      orphanedKeys.push(current.logo);
    }

    // Eliminar imágenes de galería (verifica pertenencia a la clínica).
    if (args.removeImageIds && args.removeImageIds.length > 0) {
      for (const id of args.removeImageIds) {
        const file = await ctx.db.get(id);
        if (!file) continue;
        if (file.clinicId !== args.clinicId) {
          throw new Error("Imagen no pertenece a la clínica");
        }
        orphanedKeys.push(file.fileId);
        await ctx.db.delete(id);
      }
    }

    // Añadir nuevas imágenes de galería (valida prefix por defensa en profundidad).
    if (args.addImageKeys && args.addImageKeys.length > 0) {
      for (const key of args.addImageKeys) {
        if (!key.startsWith("clinic-files/")) {
          throw new Error("Key de imagen inválida");
        }
        await ctx.db.insert("clinicFiles", {
          clinicId: args.clinicId,
          fileId: key,
        });
      }
    }

    // Patch de campos planos. `null` se traduce a undefined para borrar
    // el campo opcional del documento (Convex no acepta null en v.optional).
    const { clinicId, addImageKeys, removeImageIds, ...fields } = args;
    void addImageKeys;
    void removeImageIds;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === "clinicId" || value === undefined) continue;
      patch[key] = value === null ? undefined : value;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(clinicId, patch);
    }

    // Borrado de las keys huérfanas en R2 desde el servidor, dentro de este
    // flujo ya autorizado (admin de la clínica) y con keys que provienen de
    // los datos de la propia clínica. Antes el frontend borraba vía una acción
    // pública `deleteObject` invocable con cualquier key (S-3 de la auditoría).
    if (orphanedKeys.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.storage.actions.deleteOrphanedObjects,
        { keys: orphanedKeys },
      );
    }

    return { orphanedKeys };
  },
});

/**
 * Transfiere la propiedad (responsabilidad de billing) de la clínica a otro
 * miembro. Solo invocable por el propietario actual y solo a un miembro con
 * `puesto = "admin"`. Si el destinatario no es admin todavía, debe ser
 * promocionado primero (no podemos hacerlo aquí porque el flujo de
 * promoción puede tener sus propias reglas).
 *
 * El cambio queda registrado en `clinicOwnershipAudit` con `via: "self"`
 * para trazabilidad.
 *
 * Errores:
 *   - `OWNER_REQUIRED`: el caller no es el owner actual.
 *   - `OWNER_MUST_BE_ADMIN`: `toUserId` no es admin de la clínica.
 *   - `OWNER_TRANSFER_NOOP`: `toUserId` ya es el owner.
 */
export const transferOwnership = mutation({
  args: {
    clinicId: v.id("clinics"),
    toUserId: v.id("users"),
  },
  handler: async (
    ctx,
    { clinicId, toUserId },
  ): Promise<{
    ok: true;
    previousOwnerId: import("../_generated/dataModel").Id<"users">;
    newOwnerId: import("../_generated/dataModel").Id<"users">;
  }> => {
    const me = await getAuthenticatedUser(ctx);
    await assertOwnerOnClinic(ctx, clinicId, me._id);

    if (toUserId === me._id) {
      throw new ConvexError({
        code: "OWNER_TRANSFER_NOOP",
        message: "Ya eres el propietario de la clínica.",
      });
    }

    await assertOwnerIsAdmin(ctx, clinicId, toUserId);

    await ctx.db.patch(clinicId, { ownerUserId: toUserId });

    await ctx.db.insert("clinicOwnershipAudit", {
      clinicId,
      fromUserId: me._id,
      toUserId,
      via: "self",
      createdAt: Date.now(),
    });

    // Los emails de notificación (al antiguo y al nuevo owner) se enviarán
    // desde el Bloque G del plan production-ready, cuando estén disponibles
    // las templates correspondientes.

    return { ok: true, previousOwnerId: me._id, newOwnerId: toUserId };
  },
});

/**
 * Variante de soporte para casos extremos: el propietario desaparece sin
 * transferir y un miembro de la clínica solicita reclamar la propiedad.
 * Solo invocable desde el Convex Dashboard tras verificación externa por
 * parte del equipo de Kengo (email corporativo, llamada, documentación).
 *
 * Requiere `reason` y `executedByAdminEmail` para trazabilidad legal.
 */
export const forceTransferOwnership = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    toUserId: v.id("users"),
    reason: v.string(),
    executedByAdminEmail: v.string(),
  },
  handler: async (
    ctx,
    { clinicId, toUserId, reason, executedByAdminEmail },
  ) => {
    const clinic = await ctx.db.get(clinicId);
    if (!clinic) throw new Error("Clínica no encontrada");

    // No exigimos que `toUserId` sea admin previamente — soporte puede estar
    // resolviendo un caso de owner desaparecido y haber promocionado a otro
    // miembro justo antes. Pero registramos su `puesto` actual en el audit
    // para que quede claro qué membership tenía.
    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId_clinicId", (q) =>
        q.eq("userId", toUserId).eq("clinicId", clinicId),
      )
      .unique();
    if (!membership) {
      throw new Error(
        "El nuevo propietario debe ser miembro de la clínica antes de la transferencia forzada.",
      );
    }

    await ctx.db.patch(clinicId, { ownerUserId: toUserId });

    await ctx.db.insert("clinicOwnershipAudit", {
      clinicId,
      fromUserId: clinic.ownerUserId,
      toUserId,
      via: "support",
      reason,
      executedByAdminEmail,
      createdAt: Date.now(),
    });

    console.log(
      `[forceTransferOwnership] clinic=${clinicId} from=${clinic.ownerUserId ?? "<none>"} to=${toUserId} by=${executedByAdminEmail} reason="${reason}"`,
    );

    return { ok: true };
  },
});
