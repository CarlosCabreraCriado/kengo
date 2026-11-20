import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { esAdmin, tieneGestion } from "./permissions";

type AnyCtx = QueryCtx | MutationCtx;

type Severidad = "info" | "warn" | "alta";

/**
 * Pacientes cuya información ve `userId` dentro de `clinicId`:
 *  - `null` → admin de la clínica (incluye al propietario): ve toda la clínica.
 *  - `Set`  → fisio: solo los pacientes de los que es responsable
 *    (`assignments.fisioId === userId`). Los pacientes sin responsable no
 *    aparecen para ningún fisio.
 *
 * Sin membresía de gestión devuelve un Set vacío; el caller debe validar
 * acceso antes (p. ej. `assertFisioInClinic`).
 */
export async function getPacientesVisiblesEnClinica(
  ctx: AnyCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<Set<Id<"users">> | null> {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();
  if (!membership || !tieneGestion(membership.puesto)) return new Set();
  if (esAdmin(membership.puesto)) return null;

  const asignaciones = await ctx.db
    .query("assignments")
    .withIndex("by_fisioId_clinicId", (q) =>
      q.eq("fisioId", userId).eq("clinicId", clinicId),
    )
    .collect();
  return new Set(asignaciones.map((a) => a.pacienteId));
}

/**
 * `true` si `userId` puede actuar sobre los datos de `pacienteId` en
 * `clinicId` (marcar alertas como revisadas, etc.): admin de la clínica o
 * fisio responsable del paciente.
 */
export async function puedeGestionarPaciente(
  ctx: AnyCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  pacienteId: Id<"users">,
): Promise<boolean> {
  const visibles = await getPacientesVisiblesEnClinica(ctx, userId, clinicId);
  return visibles === null || visibles.has(pacienteId);
}

/**
 * Alertas pendientes de UNA clínica que debe ver `userId`, aplicando
 * `getPacientesVisiblesEnClinica`. Orden: más recientes primero.
 */
export async function pendingAlertsVisiblesEnClinica(
  ctx: AnyCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  severidadFiltro?: Severidad,
): Promise<Doc<"physioAlerts">[]> {
  const base = severidadFiltro
    ? ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado_severidad", (q) =>
          q
            .eq("clinicId", clinicId)
            .eq("estado", "pendiente")
            .eq("severidad", severidadFiltro),
        )
    : ctx.db
        .query("physioAlerts")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "pendiente"),
        );
  const alerts = await base.order("desc").collect();

  const visibles = await getPacientesVisiblesEnClinica(ctx, userId, clinicId);
  if (visibles === null) return alerts;
  return alerts.filter((a) => visibles.has(a.pacienteId));
}

/**
 * Sesiones reales (no sintéticas) por fecha de un conjunto de pacientes en
 * una clínica, en el rango `[desde, hasta]` (YYYY-MM-DD). Misma semántica
 * que el aggregate `sessionsByClinic` (`sumValue = esSintetica ? 0 : 1`),
 * pero acotado a pacientes concretos.
 */
export async function contarSesionesPorFecha(
  ctx: AnyCtx,
  pacienteIds: Iterable<Id<"users">>,
  clinicId: Id<"clinics">,
  desde: string,
  hasta: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const pacienteId of pacienteIds) {
    const sesiones = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId_fecha", (q) =>
        q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
      )
      .collect();
    for (const s of sesiones) {
      if (s.clinicId !== clinicId || s.esSintetica === true) continue;
      counts.set(s.fecha, (counts.get(s.fecha) ?? 0) + 1);
    }
  }
  return counts;
}
