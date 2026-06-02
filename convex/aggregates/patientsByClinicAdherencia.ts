import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Aggregate **directo** (no atado a tabla) de adherencia de pacientes por
 * clínica × ventana. Lo escribe `recomputePatient` cuando recalcula los
 * snapshots y lo leen `getPatientMetrics` (orden adherencia, ficha H1),
 * `recomputeClinic.adherenciaPromedio` (ficha H6) y la futura feature "top
 * pacientes por adherencia" (ficha H8).
 *
 * NOTA — DEFERIDO A PR H1/H5 (Fases 1-2):
 * En Fase 0 sólo se define la instancia y se registra el componente. Los
 * `insert`/`replace`/`delete` los hace PR H5 desde `recomputePatient`. Hasta
 * entonces el árbol está vacío.
 */
export const patientsByClinicAdherencia = new DirectAggregate<{
  Namespace: [Id<"clinics">, "7d" | "15d" | "30d"];
  Key: number;
  Id: Id<"users">;
}>(components.patientsByClinicAdherencia);
