import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { assertCanAccessClinic } from "../_helpers/authorization";

export const getRequesterByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const resolveUser = internalQuery({
  args: { idOrUuid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.idOrUuid as Id<"users">);
  },
});

/**
 * Resuelve al requester (por externalId de Better-Auth) y comprueba que es
 * fisio/admin de `clinicId`. Devuelve el `userId` Convex para que la action
 * caller pueda continuar sin volver a buscarlo.
 *
 * Llamado por `createPatient` para cerrar el gap de no validar el rol del
 * fisio antes de tocar la clínica.
 */
export const assertCanCreatePatientInClinic = internalQuery({
  args: { externalId: v.string(), clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const requester = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    if (!requester) throw new Error("Usuario fisio no encontrado");
    await assertCanAccessClinic(ctx, requester._id, args.clinicId, [
      "fisio",
      "admin",
    ]);
    return requester._id;
  },
});
