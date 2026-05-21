import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { assertCanAccessClinic } from "../_helpers/authorization";
import { batchGet, batchGetMap } from "../_helpers/batchGet";

export const myClinicsList = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const uniqueClinicIds = Array.from(
      new Set(memberships.map((m) => m.clinicId)),
    );
    const [clinicsMap, allFiles] = await Promise.all([
      batchGetMap(ctx, uniqueClinicIds),
      Promise.all(
        uniqueClinicIds.map((clinicId) =>
          ctx.db
            .query("clinicFiles")
            .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
            .collect(),
        ),
      ),
    ]);

    const filesByClinic = new Map(
      uniqueClinicIds.map((id, i) => [id, allFiles[i] ?? []]),
    );

    return memberships
      .map((m) => {
        const clinic = clinicsMap.get(m.clinicId);
        if (!clinic) return null;
        const imagenes = (filesByClinic.get(m.clinicId) ?? []).map((f) => ({
          id: f._id,
          fileId: f.fileId,
        }));
        return { ...clinic, puesto: m.puesto, imagenes };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

export const getMembers = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertCanAccessClinic(ctx, user._id, args.clinicId);

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    const users = await batchGet(
      ctx,
      memberships.map((m) => m.userId),
    );

    return memberships
      .map((m, i) => {
        const user = users[i];
        return user ? { ...user, puesto: m.puesto } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});
