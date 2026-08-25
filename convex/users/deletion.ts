/**
 * Eliminación de cuenta iniciada por el propio usuario — parte de consulta.
 *
 * Apple (guideline 5.1.1(v)) y Google Play exigen que quien puede crear una
 * cuenta pueda borrarla **desde dentro de la app**; un enlace a soporte no
 * basta. La contrapartida web (para quien ya no tiene la app instalada) vive
 * en `www.kengoapp.com/eliminar-cuenta`.
 *
 * La ejecución del borrado está en `users/deletionActions.ts` (runtime Node,
 * porque la purga toca Better-Auth y R2). Aquí solo vive el *preflight*, que
 * describe las consecuencias antes de confirmar.
 *
 * Ser propietario de una clínica **ya no bloquea** el borrado. Bloquearlo
 * dejaba sin salida al fisioterapeuta que trabaja solo: `transferOwnership`
 * exige otro admin al que transferir, así que un propietario único no tenía
 * ningún camino para eliminar su cuenta y eso incumple 5.1.1(v). Ahora sus
 * clínicas se cierran en cascada como parte del borrado, cancelando antes la
 * suscripción de Stripe. Transferir la propiedad sigue siendo el camino
 * recomendado cuando hay alguien a quien transferir.
 */

import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";

/** Estados de `clinicBilling` que implican una suscripción viva en Stripe. */
export const ESTADOS_SUSCRIPCION_VIVA = [
  "trialing",
  "active",
  "past_due",
  "incomplete",
  "unpaid",
] as const;

/**
 * Bloqueos que impiden el borrado. Hoy no se emite ninguno: el tipo se
 * mantiene porque la action revalida esta lista justo antes de purgar, y así
 * hay un sitio donde añadir un caso irrecuperable si aparece.
 */
export interface DeletionBlocker {
  tipo: "propiedad_clinica" | "suscripcion_activa";
  clinicId: Id<"clinics">;
  clinicNombre: string;
  detalle: string;
}

/** Clínica que se cerrará en cascada porque el usuario es su propietario. */
export interface ClinicaACerrar {
  clinicId: Id<"clinics">;
  clinicNombre: string;
  /** Otros miembros que perderán el acceso (no cuenta al propio propietario). */
  otrosMiembros: number;
  /** Planes de esa clínica que se borrarán. */
  planes: number;
  /** Si hay suscripción viva, el borrado la cancela en Stripe antes de purgar. */
  suscripcionViva: boolean;
}

export interface DeletionPreflight {
  puedeEliminar: boolean;
  bloqueos: DeletionBlocker[];
  /** Vacío si el usuario no es propietario de ninguna clínica. */
  clinicasACerrar: ClinicaACerrar[];
  /** Resumen de lo que se va a borrar, para mostrarlo antes de confirmar. */
  resumen: {
    clinicas: number;
    planes: number;
    sesiones: number;
    conversaciones: number;
  };
}

/**
 * Clínicas de las que el usuario es propietario, con el coste de cerrarlas.
 *
 * Compartida entre el `preflight` (lo pinta la UI) y `resolveForDeletion`
 * (`users/deletionInternal.ts`, que revalida en el momento de purgar): las dos
 * deben ver exactamente la misma lista o la confirmación mentiría.
 */
export async function recolectarClinicasACerrar(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ClinicaACerrar[]> {
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const clinicas: ClinicaACerrar[] = [];

  for (const membership of memberships) {
    const clinic = await ctx.db.get(membership.clinicId);
    if (!clinic) continue;
    if (clinic.ownerUserId !== userId) continue;

    const miembros = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
      .collect();

    // `plans` no tiene índice por clinicId a secas; se usa el prefijo del
    // compuesto, que es exactamente lo que hace la cascada al purgar.
    const planes = await ctx.db
      .query("plans")
      .withIndex("by_clinicId_estado", (q) => q.eq("clinicId", clinic._id))
      .collect();

    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
      .unique();

    clinicas.push({
      clinicId: clinic._id,
      clinicNombre: clinic.nombre,
      otrosMiembros: Math.max(0, miembros.length - 1),
      planes: planes.length,
      suscripcionViva:
        billing !== null &&
        (ESTADOS_SUSCRIPCION_VIVA as readonly string[]).includes(
          billing.estadoLocal,
        ),
    });
  }

  return clinicas;
}

/**
 * Comprueba qué se borraría al eliminar la cuenta del usuario actual.
 *
 * Es una `query` para que la pantalla de perfil muestre las consecuencias en
 * vivo, en lugar de que el usuario las descubra al confirmar.
 */
export const preflight = query({
  args: {},
  handler: async (ctx): Promise<DeletionPreflight> => {
    const user = await getAuthenticatedUser(ctx);
    const userId = user._id;

    const bloqueos: DeletionBlocker[] = [];
    const clinicasACerrar = await recolectarClinicasACerrar(ctx, userId);

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Conteos informativos: se muestran en la confirmación para que el usuario
    // sepa exactamente qué pierde.
    const planesPaciente = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", userId))
      .collect();
    const planesFisio = await ctx.db
      .query("plans")
      .withIndex("by_fisioId", (q) => q.eq("fisioId", userId))
      .collect();
    const planIds = new Set<Id<"plans">>([
      ...planesPaciente.map((p) => p._id),
      ...planesFisio.map((p) => p._id),
    ]);

    const sesiones = await ctx.db
      .query("sessions")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", userId))
      .collect();

    const convsPaciente = await ctx.db
      .query("conversations")
      .withIndex("by_pacienteId_lastMessageAt", (q) =>
        q.eq("pacienteId", userId),
      )
      .collect();
    const convsFisio = await ctx.db
      .query("conversations")
      .withIndex("by_fisioId_lastMessageAt", (q) => q.eq("fisioId", userId))
      .collect();
    const convIds = new Set<Id<"conversations">>([
      ...convsPaciente.map((c) => c._id),
      ...convsFisio.map((c) => c._id),
    ]);

    return {
      puedeEliminar: bloqueos.length === 0,
      bloqueos,
      clinicasACerrar,
      resumen: {
        clinicas: memberships.length,
        planes: planIds.size,
        sesiones: sesiones.length,
        conversaciones: convIds.size,
      },
    };
  },
});
