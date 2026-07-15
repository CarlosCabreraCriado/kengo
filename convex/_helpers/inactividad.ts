import { Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { getCurrentMadridDate } from "./datetime";
import { isPlanEnCurso } from "./planStatus";

type Ctx = QueryCtx | MutationCtx;

/**
 * Fecha de referencia (YYYY-MM-DD, Europe/Madrid) desde la que un paciente
 * estaba REALMENTE obligado a tener actividad en una clínica. Es la cota que
 * evita marcar como "inactivos" a pacientes recién dados de alta o con un plan
 * recién asignado: la inactividad no puede ser mayor que el tiempo que el
 * paciente lleva obligado a ejercitarse.
 *
 * Se define como la fecha MÁS RECIENTE (max) de dos cotas — el paciente solo
 * está obligado cuando ambas se cumplen a la vez:
 *   a) Inicio del plan EN CURSO más antiguo de esta clínica.
 *      `planStart = plan.fechaInicio ?? fecha(_creationTime)`.
 *   b) Fecha de alta del paciente en la clínica (`clinicMemberships._creationTime`).
 *
 * Fallback: `hoyMadrid` (⇒ 0 días de inactividad ⇒ nunca alerta) si no se
 * puede resolver ninguna cota. Consumidores: el cálculo de `inactividadDias`
 * en `snapshots.internal`, el guard de la regla diaria en `alerts.internal` y
 * la limpieza `purgeStaleInactividadAlerts`.
 */
export async function getReferenciaInactividad(
  ctx: Ctx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  hoyMadrid: string,
): Promise<string> {
  // a) Inicio del plan en curso más antiguo de esta clínica.
  const planesActivos = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "activo"),
    )
    .collect();
  let planStartMin: string | undefined;
  for (const p of planesActivos) {
    if (p.clinicId !== clinicId) continue;
    if (!isPlanEnCurso(p, hoyMadrid)) continue;
    const planStart =
      p.fechaInicio ?? getCurrentMadridDate(new Date(p._creationTime));
    if (!planStartMin || planStart < planStartMin) planStartMin = planStart;
  }

  // b) Fecha de alta del paciente en esta clínica.
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", pacienteId).eq("clinicId", clinicId),
    )
    .first();
  const altaDate = membership
    ? getCurrentMadridDate(new Date(membership._creationTime))
    : undefined;

  // La más reciente de ambas cotas (comparación lexicográfica de YYYY-MM-DD).
  const candidatos = [planStartMin, altaDate].filter(
    (d): d is string => d !== undefined,
  );
  if (candidatos.length === 0) return hoyMadrid;
  return candidatos.reduce((a, b) => (a > b ? a : b));
}
