import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate paralelo a `executionsByPaciente` para calcular `dolorPromedio`
 * sobre la ventana (sum / count). Sólo contiene ejecuciones que cumplen el
 * filtro `completado === true && dolorEscala != null`, aplicado en el trigger
 * (ver `triggers.ts`).
 *
 * - `sumValue = dolorEscala` (no `?? 0`): el filtro garantiza que dolorEscala
 *   no es null al insertar; si fuera null se filtró antes.
 * - `count()` aquí = "ejecuciones con dolor reportado" (no "total ejecuciones").
 *
 * NOTA SEMÁNTICA — PR H5 (Fase 2):
 * El cálculo actual de `dolorPromedio` (en `recomputePatient`) es "promedio de
 * promedios por sesión". Esta nueva fuente cambia a "promedio simple sobre
 * ejecuciones con dolor reportado". Es semánticamente distinto pero más
 * robusto estadísticamente. Validar con dato real antes de cerrar PR H5.
 */
export const executionsByPacienteDolor = new TableAggregate<{
  Namespace: Id<"users">;
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByPacienteDolor, {
  namespace: (doc) => doc.pacienteId,
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => doc.dolorEscala ?? 0,
});
