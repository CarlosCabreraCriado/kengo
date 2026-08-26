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
  precioParaFisios,
  limitePacientesParaFisios,
  requiereContactoVentas,
  LIMITE_FISIOS_AUTOSERVICIO,
  type PlanVariante,
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
    const pacientesVinculados = memberships.filter(
      (m) => m.puesto === "paciente",
    ).length;

    const billing = await ctx.db
      .query("clinicBilling")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .unique();

    const variante: PlanVariante = billing?.variante ?? "base";
    const plan = planParaFisios(fisiosActuales);
    const planes = [...PLANES];
    // Techo de asientos: las plazas pactadas si hay contrato a medida (las fija
    // ventas como `quantity` en Stripe), si no el tope de autoservicio.
    const esAMedida = billing?.limiteFisios !== undefined;
    const limiteFisios = billing?.limiteFisios ?? LIMITE_FISIOS_AUTOSERVICIO;
    // "Contactar con ventas" solo aplica al autoservicio: una clínica a medida
    // que agota sus plazas amplía el contrato, no cambia de plan.
    const necesitaVentas =
      !esAMedida && requiereContactoVentas(fisiosActuales);
    // `null` = sin cap (variante ilimitada o enterprise). Ni `enterprise_pending`
    // ni un contrato a medida arrastran cap (paridad con el enforcement de
    // `checkCapacidadPacientes`).
    const limitePacientes =
      billing?.estadoLocal === "enterprise_pending" || esAMedida
        ? null
        : limitePacientesParaFisios(fisiosActuales, variante);
    // Un contrato a medida no tiene tramo ni precio de tarifa: devolver el del
    // tramo por número de fisios induciría a error (una clínica a medida con 7
    // fisios "parecería" Medium a 449 €). El importe real está en las facturas.
    const planEfectivo = esAMedida ? null : plan;
    const precioMensualActualEur = esAMedida
      ? 0
      : precioParaFisios(fisiosActuales, variante);

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
        plan: planEfectivo,
        planes,
        variante,
        limitePacientes,
        pacientesVinculados,
        precioMensualActualEur,
        limiteFisios,
        esAMedida,
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
      plan: planEfectivo,
      planes,
      variante,
      limitePacientes,
      pacientesVinculados,
      precioMensualActualEur,
      limiteFisios,
      esAMedida,
      requiereContactoVentas:
        necesitaVentas ||
        (!esAMedida && billing.requiereContactoVentas === true),
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
