import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de ejecuciones particionado por (paciente, clínica).
 *
 * - `namespace = [pacienteId, clinicId]` aísla el B-tree por paciente Y clínica
 *   (≈ 5-20 escrituras/día por namespace). Compatible con el modelo
 *   multiclínica: un paciente con planes en 2 clínicas tiene 2 árboles.
 * - `sortKey = fecha` (YYYY-MM-DD) permite contar/sumar por ventana temporal en
 *   O(log n) usando `bounds`.
 * - `sumValue = completado ? 1 : 0` deja `count()` = "ejecuciones totales" y
 *   `sum()` = "ejecuciones completadas". Adherencia per-clinic = sum/count.
 */
export const executionsByPaciente = new TableAggregate<{
  Namespace: [Id<"users">, Id<"clinics">];
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByPaciente, {
  namespace: (doc) => [doc.pacienteId, doc.clinicId],
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => (doc.completado ? 1 : 0),
});
