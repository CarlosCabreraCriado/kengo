/**
 * Devuelve un informe detallado de los planes que siguen sin `clinicId`,
 * con nombres y clínicas asociadas a paciente y fisio. Pensado como paso
 * previo a `patchPlanClinicId` cuando ninguno de los backfills automáticos
 * resolvió el plan.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/inspectPendingPlans:run
 *   npx convex run migrations/inspectPendingPlans:run --prod
 *
 * Salida (por plan):
 *   {
 *     planId,
 *     planTitulo,
 *     planEstado,
 *     paciente: { id, nombre, email, clinicas: [{ id, nombre, puesto }] },
 *     fisio:    { id, nombre, email, clinicas: [{ id, nombre, puesto }] },
 *     clinicasCompartidas: [{ id, nombre, puestoPaciente, puestoFisio }]
 *   }
 */

import { internalQuery } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

type UserSummary = {
  id: Id<"users">;
  nombre: string;
  email: string;
  clinicas: { id: Id<"clinics">; nombre: string; puesto: string }[];
};

function nombreUsuario(u: Doc<"users"> | null): string {
  if (!u) return "(desconocido)";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "(sin nombre)";
}

export const run = internalQuery({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    const pendientes = plans.filter((p) => !p.clinicId);

    const informe = await Promise.all(
      pendientes.map(async (plan) => {
        const [paciente, fisio] = await Promise.all([
          ctx.db.get(plan.pacienteId),
          ctx.db.get(plan.fisioId),
        ]);

        const memPaciente = await ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.pacienteId))
          .collect();
        const memFisio = await ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.fisioId))
          .collect();

        const clinicaIds = Array.from(
          new Set([
            ...memPaciente.map((m) => m.clinicId),
            ...memFisio.map((m) => m.clinicId),
          ]),
        );
        const clinicasMap = new Map<Id<"clinics">, Doc<"clinics"> | null>();
        await Promise.all(
          clinicaIds.map(async (cid) => {
            clinicasMap.set(cid, await ctx.db.get(cid));
          }),
        );

        const summary = (
          mems: Doc<"clinicMemberships">[],
          u: Doc<"users"> | null,
        ): UserSummary => ({
          id: u?._id ?? ("" as Id<"users">),
          nombre: nombreUsuario(u),
          email: u?.email ?? "",
          clinicas: mems.map((m) => ({
            id: m.clinicId,
            nombre: clinicasMap.get(m.clinicId)?.nombre ?? "(clínica borrada)",
            puesto: m.puesto,
          })),
        });

        const pacIds = new Set(memPaciente.map((m) => m.clinicId));
        const compartidas = memFisio
          .filter((m) => pacIds.has(m.clinicId))
          .map((m) => {
            const pMem = memPaciente.find((p) => p.clinicId === m.clinicId);
            return {
              id: m.clinicId,
              nombre:
                clinicasMap.get(m.clinicId)?.nombre ?? "(clínica borrada)",
              puestoFisio: m.puesto,
              puestoPaciente: pMem?.puesto ?? "(sin puesto)",
            };
          });

        return {
          planId: plan._id,
          planTitulo: plan.titulo,
          planEstado: plan.estado,
          fechaCreacion: new Date(plan._creationTime).toISOString(),
          paciente: summary(memPaciente, paciente),
          fisio: summary(memFisio, fisio),
          clinicasCompartidas: compartidas,
        };
      }),
    );

    console.log(
      `[inspectPendingPlans] total=${informe.length}`,
    );
    console.log(JSON.stringify(informe, null, 2));
    return informe;
  },
});
