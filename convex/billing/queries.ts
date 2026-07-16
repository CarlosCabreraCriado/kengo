import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import {
  getAuthenticatedUser,
  checkClinicPermission,
  billingPermiteOperar,
} from "../_helpers/permissions";
import {
  PLANES,
  planParaFisios,
  requiereContactoVentas,
} from "./_helpers";

/**
 * Devuelve el estado de la suscripción de la clínica indicada para el admin
 * que la consulta. Si todavía no existe registro `clinicBilling`, devuelve un
 * estado normalizado `'none'` con el plan calculado a partir de los fisios
 * actuales (para que la UI ya pueda mostrar precio aproximado).
 */
export const getMyClinicSubscription = query({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    // Cualquier miembro facturable (fisio/admin) puede leer el estado de la
    // clínica activa: lo necesita para que el frontend muestre el bloqueo o el
    // banner de trial al fisio aunque no sea admin. El payload no expone
    // datos sensibles; las acciones de Stripe se gatean aparte por owner.
    await checkClinicPermission(ctx, user._id, args.clinicId, [
      "fisio",
      "admin",
    ]);

    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) throw new Error("Clínica no encontrada");

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();

    const fisiosActuales = memberships.filter(
      (m) => m.puesto === "fisio" || m.puesto === "admin",
    ).length;

    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .unique();

    const plan = planParaFisios(fisiosActuales);
    const necesitaVentas = requiereContactoVentas(fisiosActuales);

    // Owner determinista (Bloque J): solo el propietario puede actuar sobre
    // la suscripción. Devolvemos `ownerUserId`, su nombre y un flag para
    // que la UI ponga la pantalla en read-only para admins no-owner.
    const ownerUserId = clinic.ownerUserId;
    const ownerUser = await ctx.db.get(ownerUserId);
    const ownerNombre = ownerUser
      ? `${ownerUser.firstName} ${ownerUser.lastName}`.trim()
      : null;
    const esOwner = ownerUserId === user._id;

    if (!billing) {
      return {
        clinicId: args.clinicId,
        clinicaNombre: clinic.nombre,
        estado: "none" as const,
        trialEnd: undefined,
        currentPeriodEnd: undefined,
        cancelAtPeriodEnd: false,
        graceUntil: undefined,
        fisiosActuales,
        cantidadFacturada: undefined,
        plan,
        planes: PLANES,
        requiereContactoVentas: necesitaVentas,
        ownerUserId,
        ownerNombre,
        esOwner,
        // Sin fila `clinicBilling` la clínica opera (permisivo, como el
        // backend). Flag calculado en servidor para que el frontend no tenga
        // que replicar `billingPermiteOperar` y no bloquee un `none` ambiguo.
        bloqueada: false,
      };
    }

    return {
      clinicId: args.clinicId,
      clinicaNombre: clinic.nombre,
      estado: billing.estadoLocal,
      trialEnd: billing.trialEnd,
      currentPeriodEnd: billing.currentPeriodEnd,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd ?? false,
      graceUntil: billing.graceUntil,
      fisiosActuales,
      cantidadFacturada: billing.cantidadFisios,
      plan,
      planes: PLANES,
      requiereContactoVentas:
        necesitaVentas || billing.requiereContactoVentas === true,
      ownerUserId,
      ownerNombre,
      esOwner,
      // Mismo veredicto que el gating del backend (`billingPermiteOperar`):
      // bloquea unpaid/canceled/incomplete y past_due con gracia agotada.
      bloqueada: !billingPermiteOperar(billing),
    };
  },
});

/**
 * Lectura interna sin auth check, pensada para webhooks / crons / actions.
 */
export const getClinicBillingStatusInternal = internalQuery({
  args: { clinicId: v.id("clinics") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .unique();
  },
});
