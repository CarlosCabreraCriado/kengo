import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import {
  assertFisioInClinic,
  getManagedClinicIds,
} from "../_helpers/patientAccess";

const severidad = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("alta"),
);

/**
 * Lista alertas pendientes de una clínica concreta. Soporta filtro por
 * severidad. Paginada (compatible con `usePaginatedQuery`).
 */
export const listPendingByClinic = query({
  args: {
    clinicId: v.id("clinics"),
    severidad: v.optional(severidad),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    await assertFisioInClinic(ctx, user._id, args.clinicId);

    if (args.severidad) {
      return await ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado_severidad", (q) =>
          q
            .eq("clinicId", args.clinicId)
            .eq("estado", "pendiente")
            .eq("severidad", args.severidad!),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("physioAlerts")
      .withIndex("by_clinicId_estado", (q) =>
        q.eq("clinicId", args.clinicId).eq("estado", "pendiente"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Lista las alertas (de cualquier estado) asociadas a un paciente concreto.
 * Útil para la vista "comentarios del paciente" del fisio (sustituye al
 * legacy `notifications.queries.listCommentsByPatient`).
 *
 * Soporta filtro por `tipo` y `estado`. Si no se especifican, devuelve TODO
 * (pendientes + revisadas + descartadas, todos los tipos), ordenado por
 * fecha descendente.
 */
export const listByPaciente = query({
  args: {
    pacienteId: v.string(),
    tipo: v.optional(
      v.union(
        v.literal("comentario"),
        v.literal("dolor_alto"),
        v.literal("inactividad"),
        v.literal("adherencia_baja"),
        v.literal("tendencia_negativa"),
      ),
    ),
    estado: v.optional(
      v.union(
        v.literal("pendiente"),
        v.literal("revisada"),
        v.literal("descartada"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = args.pacienteId as Id<"users">;

    // Permiso: el fisio debe gestionar al menos una clínica que comparta el
    // paciente. Tomamos cualquier clinicId del paciente y validamos.
    const membership = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", targetId))
      .first();
    if (!membership) {
      return { items: [] as Doc<"physioAlerts">[], pendientes: 0, total: 0 };
    }
    await assertFisioInClinic(ctx, user._id, membership.clinicId);

    // Lectura: índice by_pacienteId_estado. Si filtra por estado, lo
    // aprovechamos directamente; si no, escaneamos los 3 estados manualmente.
    let docs: Doc<"physioAlerts">[];
    if (args.estado) {
      docs = await ctx.db
        .query("physioAlerts")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", targetId).eq("estado", args.estado!),
        )
        .order("desc")
        .collect();
    } else {
      const [pendientes, revisadas, descartadas] = await Promise.all([
        ctx.db
          .query("physioAlerts")
          .withIndex("by_pacienteId_estado", (q) =>
            q.eq("pacienteId", targetId).eq("estado", "pendiente"),
          )
          .collect(),
        ctx.db
          .query("physioAlerts")
          .withIndex("by_pacienteId_estado", (q) =>
            q.eq("pacienteId", targetId).eq("estado", "revisada"),
          )
          .collect(),
        ctx.db
          .query("physioAlerts")
          .withIndex("by_pacienteId_estado", (q) =>
            q.eq("pacienteId", targetId).eq("estado", "descartada"),
          )
          .collect(),
      ]);
      docs = [...pendientes, ...revisadas, ...descartadas];
      docs.sort((a, b) => b.fechaGeneracion.localeCompare(a.fechaGeneracion));
    }

    // Filtro por tipo (en memoria; sin índice dedicado).
    if (args.tipo) {
      docs = docs.filter((d) => d.tipo === args.tipo);
    }

    const pendientes = docs.filter((d) => d.estado === "pendiente").length;
    return { items: docs, pendientes, total: docs.length };
  },
});

/**
 * Lista alertas pendientes de TODAS las clínicas en las que el fisio actual
 * tiene rol de gestión. Útil cuando el frontend no quiere preocuparse de la
 * clínica concreta.
 */
export const listForCurrentFisio = query({
  args: {
    paginationOpts: paginationOptsValidator,
    severidad: v.optional(severidad),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const clinicIds = await getManagedClinicIds(ctx, user._id);

    if (clinicIds.length === 0) {
      return { page: [] as Doc<"physioAlerts">[], isDone: true, continueCursor: "" };
    }

    // Si el fisio gestiona una sola clínica, delegamos en la query indexada.
    if (clinicIds.length === 1) {
      const clinicId = clinicIds[0];
      if (args.severidad) {
        return await ctx.db
          .query("physioAlerts")
          .withIndex("by_clinicId_estado_severidad", (q) =>
            q
              .eq("clinicId", clinicId)
              .eq("estado", "pendiente")
              .eq("severidad", args.severidad!),
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
      return await ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "pendiente"),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    // Multi-clínica: union manual sin paginar (el caso típico es 1-2 clínicas).
    const all: Doc<"physioAlerts">[] = [];
    const clinicIdSet = new Set<Id<"clinics">>(clinicIds);
    for (const clinicId of clinicIdSet) {
      const docs = await ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "pendiente"),
        )
        .order("desc")
        .collect();
      for (const d of docs) {
        if (args.severidad && d.severidad !== args.severidad) continue;
        all.push(d);
      }
    }
    all.sort((a, b) => b._creationTime - a._creationTime);
    return { page: all, isDone: true, continueCursor: "" };
  },
});
