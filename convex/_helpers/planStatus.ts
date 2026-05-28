import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { esPaciente } from "./permissions";

type Ctx = QueryCtx | MutationCtx;

/**
 * Devuelve true si el plan está "en curso" en la fecha indicada
 * (`hoyMadrid` en formato YYYY-MM-DD, zona Europe/Madrid):
 *   - `plan.estado === 'activo'`
 *   - `plan.fechaInicio` es nula **o** `<= hoyMadrid`
 *   - `plan.fechaFin` es nula **o** `>= hoyMadrid`
 *
 * Es la única definición canónica de "plan en curso". Consumidores:
 *   - `plans.queries.listEnCursoPacientesInClinics`
 *   - `snapshots.internal.recomputeClinicForWindow`
 */
export function isPlanEnCurso(
  plan: Pick<Doc<"plans">, "estado" | "fechaInicio" | "fechaFin">,
  hoyMadrid: string,
): boolean {
  if (plan.estado !== "activo") return false;
  if (plan.fechaInicio && plan.fechaInicio > hoyMadrid) return false;
  if (plan.fechaFin && plan.fechaFin < hoyMadrid) return false;
  return true;
}

/**
 * Resuelve si un paciente tiene al menos un plan en curso (ver
 * `isPlanEnCurso`). Usa el índice `by_pacienteId_estado` para evitar
 * recorrer todos los planes del paciente.
 */
export async function pacienteTienePlanEnCurso(
  ctx: Ctx,
  pacienteId: Id<"users">,
  hoyMadrid: string,
): Promise<boolean> {
  const planesActivos = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "activo"),
    )
    .collect();
  return planesActivos.some((p) => isPlanEnCurso(p, hoyMadrid));
}

/**
 * Cuenta cuántos pacientes de la clínica tienen al menos un plan en curso.
 * Equivale a la cardinalidad de `plans.queries.listEnCursoPacientesInClinics`
 * para una sola clínica.
 */
export async function countPacientesEnCursoEnClinica(
  ctx: Ctx,
  clinicId: Id<"clinics">,
  hoyMadrid: string,
): Promise<number> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .collect();
  const pacienteIds = Array.from(
    new Set(
      memberships.filter((m) => esPaciente(m.puesto)).map((m) => m.userId),
    ),
  );
  const flags = await Promise.all(
    pacienteIds.map((pid) => pacienteTienePlanEnCurso(ctx, pid, hoyMadrid)),
  );
  return flags.filter(Boolean).length;
}
