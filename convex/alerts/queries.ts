import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { pendingAlertsVisiblesEnClinica } from "../_helpers/fisioScope";
import {
  assertFisioInClinic,
  getManagedClinicIds,
  getSharedClinicIdsForPaciente,
} from "../_helpers/patientAccess";

const severidad = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("alta"),
);

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
      ),
    ),
    estado: v.optional(
      v.union(
        v.literal("pendiente"),
        v.literal("revisada"),
        v.literal("descartada"),
      ),
    ),
    // Clínica activa del fisio. Opcional para clientes antiguos: sin ella se
    // devuelven las alertas de todas las clínicas que comparten.
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const targetId = args.pacienteId as Id<"users">;

    // Permiso y aislamiento: solo las alertas de clínicas que el fisio
    // gestiona y en las que el paciente está. Antes se tomaba la primera
    // membresía del paciente, que en un paciente multiclínica podía ser una
    // clínica ajena al fisio y la query fallaba.
    const clinicas = new Set<Id<"clinics">>(
      await getSharedClinicIdsForPaciente(
        ctx,
        user._id,
        targetId,
        args.clinicId,
      ),
    );

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

    docs = docs.filter((d) => clinicas.has(d.clinicId));

    // Filtro por tipo (en memoria; sin índice dedicado).
    if (args.tipo) {
      docs = docs.filter((d) => d.tipo === args.tipo);
    }

    const pendientes = docs.filter((d) => d.estado === "pendiente").length;
    return { items: docs, pendientes, total: docs.length };
  },
});

/**
 * Lista alertas pendientes que debe ver el usuario actual en sus clínicas
 * gestionadas.
 *
 * Visibilidad: los **admins** ven todas las alertas de la clínica; los
 * **fisios** solo ven las de pacientes de los que son responsables
 * (`assignments`). Los pacientes sin fisio responsable solo aparecen para
 * admins. Ver `pendingAlertsVisiblesEnClinica` (`_helpers/fisioScope.ts`).
 *
 * Si `clinicId` se proporciona, restringe el resultado a esa clínica (tras
 * validar que el usuario es miembro con rol de gestión). Sin `clinicId`,
 * agrega todas las clínicas gestionadas. `paginationOpts` se conserva por
 * compatibilidad de API; el resultado se devuelve en una única página.
 */
export const listForCurrentFisio = query({
  args: {
    paginationOpts: paginationOptsValidator,
    severidad: v.optional(severidad),
    clinicId: v.optional(v.id("clinics")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Caso aislado por clínica activa: validamos pertenencia y delegamos al
    // helper que restringe por fisio responsable (admins ven todo).
    if (args.clinicId) {
      await assertFisioInClinic(ctx, user._id, args.clinicId);
      const page = await pendingAlertsVisiblesEnClinica(
        ctx,
        user._id,
        args.clinicId,
        args.severidad,
      );
      return { page, isDone: true, continueCursor: "" };
    }

    const clinicIds = await getManagedClinicIds(ctx, user._id);

    if (clinicIds.length === 0) {
      return { page: [] as Doc<"physioAlerts">[], isDone: true, continueCursor: "" };
    }

    // Multi-clínica (legacy): union manual de las alertas que ve el usuario en
    // cada clínica gestionada, aplicando el mismo filtro por responsable.
    const all: Doc<"physioAlerts">[] = [];
    const clinicIdSet = new Set<Id<"clinics">>(clinicIds);
    for (const clinicId of clinicIdSet) {
      const docs = await pendingAlertsVisiblesEnClinica(
        ctx,
        user._id,
        clinicId,
        args.severidad,
      );
      all.push(...docs);
    }
    all.sort((a, b) => b._creationTime - a._creationTime);
    return { page: all, isDone: true, continueCursor: "" };
  },
});
