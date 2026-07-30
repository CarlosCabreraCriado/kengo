import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  LIMITE_FISIOS_AUTOSERVICIO,
  limitePacientesParaFisios,
  type PlanVariante,
} from "../billing/_helpers";

/**
 * Helpers de capacidad por plan: tope de asientos facturables (fisio+admin)
 * y cap de pacientes vinculados según la variante de la suscripción.
 *
 * Centraliza el conteo que antes vivía duplicado en `clinicMemberships`,
 * `accessCodes` y `auth`. Todas las vías de alta deben pasar por aquí.
 */

/**
 * Cuenta los miembros de la clínica en un único collect sobre `by_clinicId`.
 * `facturables` = fisio + admin (la quantity que se factura en Stripe);
 * `pacientes` = puesto paciente (los fisios con `tambienEsPaciente` NO cuentan).
 */
export async function contarMiembros(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<{ facturables: number; pacientes: number }> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .collect();
  let facturables = 0;
  let pacientes = 0;
  for (const m of memberships) {
    if (m.puesto === "fisio" || m.puesto === "admin") facturables++;
    else if (m.puesto === "paciente") pacientes++;
  }
  return { facturables, pacientes };
}

/**
 * `true` si dar de alta un asiento facturable más superaría el tope de
 * autoservicio. Variante no-throw para los flujos que no pueden lanzar
 * (p.ej. registro con código en `auth/mutations.ts`).
 */
export async function excedeCapacidadFisios(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<boolean> {
  const { facturables } = await contarMiembros(ctx, clinicId);
  return facturables + 1 > LIMITE_FISIOS_AUTOSERVICIO;
}

/**
 * M-4: bloquea el alta NETA de un asiento facturable por encima del tope de
 * autoservicio. Enterprise (>9) se gestiona por ventas; el límite se hace
 * cumplir en código, no en el price de Stripe (decisión de pricing).
 */
export async function assertCapacidadFisios(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  if (await excedeCapacidadFisios(ctx, clinicId)) {
    throw new ConvexError({
      code: "REQUIERE_CONTACTO_VENTAS",
      message:
        "La clínica ya cuenta con el máximo de fisios del plan. Contacta con ventas para ampliar.",
    });
  }
}

/**
 * Resultado del chequeo de cap de pacientes. `limite === null` significa
 * sin cap (variante ilimitada, enterprise o clínica sin plan).
 */
export async function checkCapacidadPacientes(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<{ excede: boolean; limite: number | null; pacientes: number }> {
  const billing = await ctx.db
    .query("clinicBilling")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .unique();

  const { facturables, pacientes } = await contarMiembros(ctx, clinicId);

  // Enterprise pendiente de ventas: sin cap (paridad con billingPermiteOperar).
  if (billing?.estadoLocal === "enterprise_pending") {
    return { excede: false, limite: null, pacientes };
  }

  const variante: PlanVariante = billing?.variante ?? "base";
  const limite = limitePacientesParaFisios(facturables, variante);
  if (limite === null) {
    return { excede: false, limite: null, pacientes };
  }
  return { excede: pacientes + 1 > limite, limite, pacientes };
}

/** Variante no-throw del cap de pacientes (para `auth/mutations.ts`). */
export async function excedeCapacidadPacientes(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<boolean> {
  const { excede } = await checkCapacidadPacientes(ctx, clinicId);
  return excede;
}

/**
 * Bloquea vincular un paciente nuevo cuando la variante base ya está al
 * límite del plan (150/300/500). No aplica a pacientes ya vinculados ni
 * limita los planes de tratamiento: solo el alta neta de membresías con
 * puesto `paciente`.
 */
export async function assertCapacidadPacientes(
  ctx: QueryCtx | MutationCtx,
  clinicId: Id<"clinics">,
): Promise<void> {
  const { excede, limite, pacientes } = await checkCapacidadPacientes(
    ctx,
    clinicId,
  );
  if (excede) {
    throw new ConvexError({
      code: "LIMITE_PACIENTES_ALCANZADO",
      message: `Has alcanzado el límite de ${limite} pacientes de tu plan. Pasa a la variante ilimitada para seguir añadiendo pacientes.`,
      limite,
      pacientesActuales: pacientes,
    });
  }
}
