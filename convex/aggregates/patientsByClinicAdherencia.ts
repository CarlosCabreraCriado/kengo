import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Aggregate **directo** (no atado a tabla) de adherencia de pacientes por
 * clínica × ventana. Lo escribe `recomputePatient` cuando recalcula los
 * snapshots y lo leen `getPatientMetrics` (orden adherencia, ficha H1),
 * `recomputeClinic.adherenciaPromedio` (ficha H6b) y la futura feature "top
 * pacientes por adherencia" (ficha H8).
 *
 * **Importante**: como `recomputeClinic.adherenciaPromedio` lee vía
 * `sum()/count()` (PR H6b), todos los `insert` / `replace` deben pasar
 * `sumValue: adherencia` explícito. Por defecto DirectAggregate asume
 * `sumValue = 0`, por lo que omitirlo dejaría `sum()` siempre en 0.
 */
export const patientsByClinicAdherencia = new DirectAggregate<{
  Namespace: [Id<"clinics">, "7d" | "15d" | "30d"];
  Key: number;
  Id: Id<"users">;
}>(components.patientsByClinicAdherencia);
