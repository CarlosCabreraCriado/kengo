/**
 * Migración: reasigna planes versionados de `completado` → `modificado` y
 * setea `planSucesor` en el plan antiguo.
 *
 * Contexto: hasta esta migración, la mutation `plans.version` marcaba el
 * plan antiguo como `completado`. Eso mezclaba dos casos distintos en el
 * mismo estado: "plan terminado naturalmente" y "plan reemplazado por una
 * nueva versión". A partir de ahora `version` escribe `modificado` y los
 * datos históricos deben reflejarlo retroactivamente.
 *
 * Criterio:
 *   - Para cada plan con `planAnterior` definido, leer el plan apuntado.
 *   - Si está en `estado === "completado"` → patch a `modificado` +
 *     `planSucesor = <id del plan iterado>`.
 *   - Si ya está en `modificado` → asegurar `planSucesor` (idempotente).
 *   - Otros estados (`activo`/`borrador`/`cancelado`) se loguean como
 *     anomalías y NO se tocan.
 *
 * Los planes `completado` que NO son apuntados por ningún `planAnterior`
 * se quedan como están: terminaron naturalmente (cron `expireOverduePlans`
 * o transición manual del fisio).
 *
 * Cómo ejecutar:
 *   npx convex run migrations/markVersionedAsModificado:run
 *   npx convex run migrations/markVersionedAsModificado:run --prod
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type Anomalo = {
  planSucesorId: Id<"plans">;
  planAnteriorId: Id<"plans">;
  estadoAnterior: string;
};

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();

    let total = 0;
    let migrados = 0;
    let yaModificados = 0;
    let sucesorParcheado = 0;
    const anomalos: Anomalo[] = [];

    for (const plan of plans) {
      if (!plan.planAnterior) continue;
      total++;

      const anterior = await ctx.db.get(plan.planAnterior);
      if (!anterior) continue;

      if (anterior.estado === "completado") {
        await ctx.db.patch(anterior._id, {
          estado: "modificado",
          planSucesor: plan._id,
        });
        migrados++;
        continue;
      }

      if (anterior.estado === "modificado") {
        yaModificados++;
        if (!anterior.planSucesor) {
          await ctx.db.patch(anterior._id, { planSucesor: plan._id });
          sucesorParcheado++;
        }
        continue;
      }

      anomalos.push({
        planSucesorId: plan._id,
        planAnteriorId: anterior._id,
        estadoAnterior: anterior.estado,
      });
    }

    console.log(
      `[markVersionedAsModificado] total=${total} migrados=${migrados} yaModificados=${yaModificados} sucesorParcheado=${sucesorParcheado} anomalos=${anomalos.length}`,
    );

    if (anomalos.length > 0) {
      console.log(
        "[markVersionedAsModificado] anomalos:",
        JSON.stringify(anomalos, null, 2),
      );
    }

    return { total, migrados, yaModificados, sucesorParcheado, anomalos };
  },
});
