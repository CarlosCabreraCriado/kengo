import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

async function resolvePacienteId(
  ctx: any,
  pacienteIdOrUuid: string,
  fallbackUserId: Id<"users">,
): Promise<Id<"users">> {
  if (!pacienteIdOrUuid.includes("-")) {
    return pacienteIdOrUuid as Id<"users">;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyDirectusId", (q: any) =>
      q.eq("legacyDirectusId", pacienteIdOrUuid),
    )
    .unique();
  return user?._id ?? fallbackUserId;
}

export const getByPaciente = query({
  args: {
    pacienteId: v.string(),
    fechaDesde: v.optional(v.string()),
    fechaHasta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = await resolvePacienteId(ctx, args.pacienteId, user._id);

    let results = await ctx.db
      .query("dailyCompliance")
      .withIndex("by_pacienteId_fecha", (q) => {
        const byPaciente = q.eq("pacienteId", targetId);
        return args.fechaDesde
          ? byPaciente.gte("fecha", args.fechaDesde)
          : byPaciente;
      })
      .collect();

    if (args.fechaHasta) {
      results = results.filter((r) => r.fecha <= args.fechaHasta!);
    }

    return results;
  },
});
