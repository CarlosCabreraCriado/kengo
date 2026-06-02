import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de ejecuciones particionado por clínica.
 *
 * Habilita `recomputeClinic.adherenciaPromedio` (sum/count) y conteos por
 * ventana en `getActividadDiariaClinica` (ficha H3). Frecuencia esperada por
 * namespace: ~50-500 escrituras/día — sin contención preocupante.
 */
export const executionsByClinic = new TableAggregate<{
  Namespace: Id<"clinics">;
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByClinic, {
  namespace: (doc) => doc.clinicId,
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => (doc.completado ? 1 : 0),
});
