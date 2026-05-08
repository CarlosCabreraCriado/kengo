import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
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
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    assertHexColor(args.colorPrimario, "colorPrimario");
    assertHexColor(args.colorSecundario, "colorSecundario");

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
      createdBy: user._id,
    });

    await ctx.db.insert("clinicMemberships", {
      userId: user._id,
      clinicId,
      puesto: "admin",
    });

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

    return { orphanedKeys };
  },
});
