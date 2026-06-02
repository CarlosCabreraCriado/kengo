import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de ejecuciones particionado por paciente.
 *
 * - `namespace = pacienteId` aísla el B-tree por paciente (≈ 5-20 escrituras/día
 *   por namespace, sin contención esperada).
 * - `sortKey = fecha` (YYYY-MM-DD) permite contar/sumar por ventana temporal en
 *   O(log n) usando `bounds`.
 * - `sumValue = completado ? 1 : 0` deja `count()` = "ejecuciones totales" y
 *   `sum()` = "ejecuciones completadas". Adherencia = sum/count.
 */
export const executionsByPaciente = new TableAggregate<{
  Namespace: Id<"users">;
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByPaciente, {
  namespace: (doc) => doc.pacienteId,
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => (doc.completado ? 1 : 0),
});
