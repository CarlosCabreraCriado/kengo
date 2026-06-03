import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Aggregate **directo** (no atado a tabla) de dolorPromedio por
 * clínica × ventana. Lo mantiene `recomputePatient` (insert/replace/delete)
 * tras escribir el snapshot, y lo lee `recomputeClinic.dolorMedio` (PR H6)
 * vía `sum()/count()`.
 *
 * **Importante**: como queremos que `sum()` devuelva la suma de dolores,
 * todos los `insert` / `replace` deben pasar `sumValue: dolorPromedio`
 * explícito. Por defecto DirectAggregate asume `sumValue = 0`, por lo que
 * omitirlo dejaría `sum()` siempre en 0.
 */
export const patientsByClinicDolor = new DirectAggregate<{
  Namespace: [Id<"clinics">, "7d" | "15d" | "30d"];
  Key: number;
  Id: Id<"users">;
}>(components.patientsByClinicDolor);
