import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  tieneGestion,
} from "../_helpers/permissions";

export const markAsRead = mutation({
  args: { notificationId: v.id("physioNotifications") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    await ctx.db.patch(args.notificationId, {
      revisada: true,
      fechaRevision: new Date().toISOString(),
    });
  },
});

export const markAllAsRead = mutation({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    const now = new Date().toISOString();

    const unread = await ctx.db
      .query("physioNotifications")
      .withIndex("by_clinicId_revisada", (q) =>
        q.eq("clinicId", args.clinicId).eq("revisada", false),
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, {
        revisada: true,
        fechaRevision: now,
      });
    }

    return unread.length;
  },
});

export const markAllAsReadForCurrentFisio = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const now = new Date().toISOString();

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const clinicIds = memberships
      .filter((m) => tieneGestion(m.puesto))
      .map((m) => m.clinicId as Id<"clinics">);

    let total = 0;
    for (const clinicId of clinicIds) {
      const unread = await ctx.db
        .query("physioNotifications")
        .withIndex("by_clinicId_revisada", (q) =>
          q.eq("clinicId", clinicId).eq("revisada", false),
        )
        .collect();
      for (const n of unread) {
        await ctx.db.patch(n._id, { revisada: true, fechaRevision: now });
        total += 1;
      }
    }
    return total;
  },
});

export const markAllReadForPatient = mutation({
  args: { pacienteId: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    const now = new Date().toISOString();

    let targetId: Id<"users">;
    if (args.pacienteId.includes("-")) {
      const found = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", args.pacienteId),
        )
        .unique();
      if (!found) return 0;
      targetId = found._id;
    } else {
      targetId = args.pacienteId as Id<"users">;
    }

    const items = await ctx.db
      .query("physioNotifications")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", targetId))
      .collect();

    let count = 0;
    for (const n of items) {
      if (n.revisada) continue;
      await ctx.db.patch(n._id, { revisada: true, fechaRevision: now });
      count += 1;
    }
    return count;
  },
});
