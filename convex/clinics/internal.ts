import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Lookup interno del nombre de una clínica por id. Útil desde acciones
 * Node (templates de email) sin exponer una query pública adicional.
 */
export const getById = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) return null;
    return { _id: clinic._id, nombre: clinic.nombre };
  },
});
