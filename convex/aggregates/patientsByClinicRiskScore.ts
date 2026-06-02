import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Aggregate **directo** de riskScore de pacientes por clínica × ventana.
 * Análogo a `patientsByClinicAdherencia` pero ordenado por riskScore (que es
 * una heurística derivada en `recomputePatient`, no agregación pura).
 *
 * El sortKey numérico se lee en ASC por defecto; para listados "top riesgo
 * primero" se usa `paginate({ order: "desc" })`.
 *
 * NOTA — DEFERIDO A PR H5/F8 (Fases 2):
 * En Fase 0 sólo se define la instancia. Los `insert`/`replace`/`delete` los
 * hace PR H5 desde el cron `daily-maintenance` simplificado (que tras Fase 2
 * solo recalcula riskScore + rachaActual + ultimaActividad).
 */
export const patientsByClinicRiskScore = new DirectAggregate<{
  Namespace: [Id<"clinics">, "7d" | "15d" | "30d"];
  Key: number;
  Id: Id<"users">;
}>(components.patientsByClinicRiskScore);
