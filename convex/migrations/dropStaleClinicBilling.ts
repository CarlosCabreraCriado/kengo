/**
 * Reparación: soltar filas de `clinicBilling` que apuntan a objetos de Stripe
 * inexistentes, para que el flujo normal las recree.
 *
 * Contexto: las clínicas creadas antes de que `STRIPE_SECRET_KEY` pasara de
 * test a live guardaron `stripeCustomerId`/`stripeSubscriptionId` de **modo
 * test**. Con la clave live esos objetos no existen: el portal de cliente y
 * cualquier cambio de cantidad fallan con "No such customer", y como los
 * eventos de esas suscripciones nunca llegan al webhook de live, `estadoLocal`
 * se queda congelado para siempre (la clínica opera pero no se factura).
 *
 * No se puede arreglar con un patch parcial: `startTrialForClinic` aborta si ya
 * hay `stripeSubscriptionId`, y si solo se borra ese campo REUTILIZA el
 * `stripeCustomerId` de test y revienta al hacer `customers.retrieve`. Hay que
 * soltar la fila entera.
 *
 * Borrar la fila NO corta el servicio: `billingPermiteOperar(null)` es `true`
 * (`_helpers/permissions.ts:172`). La recreación la hace el cron
 * `billing-reconcile-trials` (03:45 UTC), que detecta clínicas sin fila y
 * encola `startTrialForClinic`; para no esperar, se puede invocar a mano:
 *
 *   npx convex run migrations/dropStaleClinicBilling:drop '{"clinicIds":["..."],"expectedCustomerIds":["cus_..."],"apply":false}'
 *   npx convex run billing/internal:reconcileMissingTrials
 *
 * `expectedCustomerIds` es un seguro: la fila solo se borra si su
 * `stripeCustomerId` coincide con el que se pasa, así que un id de clínica
 * equivocado aborta en vez de tirar una fila buena. La fila borrada se devuelve
 * entera en la respuesta para poder reponerla a mano si hiciera falta.
 */

import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

export const drop = internalMutation({
  args: {
    clinicIds: v.array(v.id('clinics')),
    expectedCustomerIds: v.array(v.string()),
    apply: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.clinicIds.length !== args.expectedCustomerIds.length) {
      throw new Error(
        'clinicIds y expectedCustomerIds deben tener la misma longitud',
      );
    }

    const resultados = [];
    for (let i = 0; i < args.clinicIds.length; i++) {
      const clinicId = args.clinicIds[i]!;
      const esperado = args.expectedCustomerIds[i]!;
      const clinic = await ctx.db.get(clinicId);
      const billing = await ctx.db
        .query('clinicBilling')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', clinicId))
        .unique();

      if (!billing) {
        resultados.push({ clinicId, estado: 'SIN_FILA' as const });
        continue;
      }
      if (billing.stripeCustomerId !== esperado) {
        throw new Error(
          `Abortado: ${clinic?.nombre ?? clinicId} tiene customer ` +
            `${billing.stripeCustomerId}, no ${esperado}. Revisa los ids.`,
        );
      }

      resultados.push({
        clinicId,
        clinica: clinic?.nombre ?? '?',
        estado: args.apply ? ('BORRADA' as const) : ('A_BORRAR' as const),
        // Copia literal para poder reponerla a mano si hiciera falta.
        filaAnterior: billing,
      });
      if (args.apply) await ctx.db.delete(billing._id);
    }

    return { apply: args.apply, resultados };
  },
});
