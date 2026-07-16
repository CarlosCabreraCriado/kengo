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
