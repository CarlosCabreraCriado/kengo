import { DirectAggregate } from "@convex-dev/aggregate";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

type Ventana = "7d" | "15d" | "30d";

export type PatientClinicAggregate = DirectAggregate<{
  Namespace: [Id<"clinics">, Ventana];
  Key: number;
  Id: Id<"users">;
}>;

/**
 * Sincroniza el valor de un paciente en un DirectAggregate particionado por
 * `(clinicId, ventana)`. Es idempotente respecto al estado real del aggregate:
 *
 * - Si `newVal != null`: usa `replaceOrInsert` cuando hay cambio y
 *   `insertIfDoesNotExist` en cualquier otro caso (incluido valor sin cambio
 *   o aggregate purgado externamente).
 * - Si `newVal == null`: `deleteIfExists` (no-op si no existía).
 *
 * `withSumValue=true` para adherencia/dolor (recomputeClinic los lee vía
 * `sum()/count()`); `false` para riskScore (solo se lee la `key`).
 *
 * Reemplaza el sync anterior (tres ramas if/else if/else if) que hacía no-op
 * cuando `oldVal === newVal`, permitiendo drift permanente del aggregate si
 * había sido purgado externamente por `_syncPatientActiveStateInClinic`.
 * Ver AUDITORIA_AGGREGATES_CONVEX.md Bug 3.
 */
export async function syncPatientAggregateValue(
  ctx: MutationCtx,
  agg: PatientClinicAggregate,
  ns: [Id<"clinics">, Ventana],
  patientId: Id<"users">,
  oldVal: number | null | undefined,
  newVal: number | null | undefined,
  withSumValue: boolean,
): Promise<void> {
  if (newVal != null) {
    if (oldVal != null && oldVal !== newVal) {
      await agg.replaceOrInsert(
        ctx,
        { namespace: ns, key: oldVal, id: patientId },
        withSumValue
          ? { namespace: ns, key: newVal, sumValue: newVal }
          : { namespace: ns, key: newVal },
      );
    } else {
      await agg.insertIfDoesNotExist(
        ctx,
        withSumValue
          ? { namespace: ns, key: newVal, id: patientId, sumValue: newVal }
          : { namespace: ns, key: newVal, id: patientId },
      );
    }
  } else if (oldVal != null) {
    await agg.deleteIfExists(ctx, {
      namespace: ns,
      key: oldVal,
      id: patientId,
    });
  }
}
