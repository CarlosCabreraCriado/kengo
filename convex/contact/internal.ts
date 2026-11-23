import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// Ventana deslizante simple para el formulario público de contacto: máximo
// MAX_EN_VENTANA envíos por bucket (IP) cada VENTANA_MS. Suficiente para frenar
// abuso de spam vía Resend sin infra de rate-limiting dedicada.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_EN_VENTANA = 5;

export const hitContactRateLimit = internalMutation({
  args: { bucket: v.string() },
  handler: async (ctx, { bucket }): Promise<{ allowed: boolean }> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("contactRateLimit")
      .withIndex("by_bucket", (q) => q.eq("bucket", bucket))
      .unique();

    // Sin registro o ventana expirada → reiniciar el contador.
    if (!existing || now - existing.windowStartMs > VENTANA_MS) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStartMs: now });
      } else {
        await ctx.db.insert("contactRateLimit", {
          bucket,
          count: 1,
          windowStartMs: now,
        });
      }
      return { allowed: true };
    }

    if (existing.count >= MAX_EN_VENTANA) {
      return { allowed: false };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true };
  },
});

// Alta de un lead del formulario «Te llamamos» de la landing. La validación
// (listas cerradas, RGPD, formatos) ya se hizo en `validarLead`; aquí solo se
// persiste, antes de intentar el aviso por email, para no perder el lead si
// Resend falla.
export const createLead = internalMutation({
  args: {
    nombre: v.string(),
    clinica: v.string(),
    numFisios: v.union(
      v.literal("1"),
      v.literal("2-4"),
      v.literal("5-9"),
      v.literal("10+"),
    ),
    ciudad: v.string(),
    telefono: v.string(),
    email: v.string(),
    preferenciaContacto: v.union(
      v.literal("telefono"),
      v.literal("whatsapp"),
      v.literal("email"),
    ),
    privacidadVersion: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("leads", {
      ...args,
      origen: "demo-form",
      estado: "nuevo",
      createdAt: Date.now(),
    });
  },
});
