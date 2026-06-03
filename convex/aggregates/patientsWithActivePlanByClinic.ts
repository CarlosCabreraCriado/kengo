import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Aggregate directo de PACIENTES ÚNICOS con al menos un plan en curso por
 * clínica. Sustituye la iteración `Promise.all(pacienteTienePlanEnCurso)` en
 * `recomputeClinicForWindow` para calcular `pacientesActivos` (F7-close +
 * H2 del plan maestro `sunny-muffin`).
 *
 * Unicidad por `id = pacienteId`: un paciente con N planes activos genera
 * 1 entry. Sync vía `_syncPatientActiveStateInClinic` desde cada mutation
 * que cambia `plans.estado`/`fechas` + sweep diario en `dailyMaintenance`
 * para corregir la deriva temporal (planes que pasan de futuro a presente
 * o de presente a pasado).
 *
 * `Key: null` porque sólo se consulta `count(namespace)` — no hay orden
 * semántico relevante en este aggregate. `insertIfDoesNotExist` /
 * `deleteIfExists` lo mantienen idempotente sin necesidad de `sumValue`.
 */
export const patientsWithActivePlanByClinic = new DirectAggregate<{
  Namespace: Id<"clinics">;
  Key: null;
  Id: Id<"users">;
}>(components.patientsWithActivePlanByClinic);
