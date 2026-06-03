import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate paralelo a `executionsByPaciente` para calcular `dolorPromedio`
 * sobre la ventana (sum / count). Sólo contiene ejecuciones que cumplen el
 * filtro `completado === true && dolorEscala != null`, aplicado en el trigger
 * (ver `triggers.ts`).
 *
 * - `namespace = [pacienteId, clinicId]` igual que `executionsByPaciente` —
 *   dolor promedio se reporta per-clinic para mantener aislamiento multiclínica.
 * - `sumValue = dolorEscala` (no `?? 0`): el filtro garantiza que dolorEscala
 *   no es null al insertar; si fuera null se filtró antes.
 * - `count()` aquí = "ejecuciones con dolor reportado" (no "total ejecuciones").
 *
 * NOTA SEMÁNTICA — PR H5:
 * El cálculo legacy de `dolorPromedio` (en `recomputePatient`) era "promedio de
 * promedios por sesión". Esta fuente cambia a "promedio simple sobre
 * ejecuciones con dolor reportado". Más robusto estadísticamente.
 */
export const executionsByPacienteDolor = new TableAggregate<{
  Namespace: [Id<"users">, Id<"clinics">];
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByPacienteDolor, {
  namespace: (doc) => [doc.pacienteId, doc.clinicId],
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => doc.dolorEscala ?? 0,
});
