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
 * bloquea los casos que dejarían el sistema inconsistente:
 *
 *  - Ser propietario de una clínica rompería la invariante de
 *    `clinics.ownerUserId` (toda clínica tiene exactamente un owner).
 *  - Una suscripción de Stripe viva seguiría cobrando a una cuenta borrada.
 */

import { query } from "../_generated/server";
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

export interface DeletionBlocker {
  tipo: "propiedad_clinica" | "suscripcion_activa";
  clinicId: Id<"clinics">;
  clinicNombre: string;
  detalle: string;
}

export interface DeletionPreflight {
  puedeEliminar: boolean;
  bloqueos: DeletionBlocker[];
  /** Resumen de lo que se va a borrar, para mostrarlo antes de confirmar. */
  resumen: {
    clinicas: number;
    planes: number;
    sesiones: number;
    conversaciones: number;
  };
}

/**
 * Comprueba si el usuario actual puede eliminar su cuenta y qué se borraría.
 *
 * Es una `query` para que la pantalla de perfil muestre los bloqueos en vivo,
 * en lugar de que el usuario los descubra al confirmar.
 */
export const preflight = query({
  args: {},
  handler: async (ctx): Promise<DeletionPreflight> => {
    const user = await getAuthenticatedUser(ctx);
    const userId = user._id;

    const bloqueos: DeletionBlocker[] = [];

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const membership of memberships) {
      const clinic = await ctx.db.get(membership.clinicId);
      if (!clinic) continue;
      if (clinic.ownerUserId !== userId) continue;

      bloqueos.push({
        tipo: "propiedad_clinica",
        clinicId: clinic._id,
        clinicNombre: clinic.nombre,
        detalle: `Eres el propietario de "${clinic.nombre}". Transfiere la propiedad a otro administrador antes de eliminar tu cuenta.`,
      });

      const billing = await ctx.db
        .query("clinicBilling")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .unique();

      if (
        billing &&
        (ESTADOS_SUSCRIPCION_VIVA as readonly string[]).includes(
          billing.estadoLocal,
        )
      ) {
        bloqueos.push({
          tipo: "suscripcion_activa",
          clinicId: clinic._id,
          clinicNombre: clinic.nombre,
          detalle: `La clínica "${clinic.nombre}" tiene una suscripción activa. Cancélala antes de eliminar tu cuenta para evitar cobros posteriores.`,
        });
      }
    }

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
      resumen: {
        clinicas: memberships.length,
        planes: planIds.size,
        sesiones: sesiones.length,
        conversaciones: convIds.size,
      },
    };
  },
});
