import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import {
  getAuthenticatedUser,
  checkClinicPermission,
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
    await checkClinicPermission(ctx, user._id, args.clinicId, ["admin"]);

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

    if (!billing) {
      return {
        clinicId: args.clinicId,
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
      };
    }

    return {
      clinicId: args.clinicId,
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
