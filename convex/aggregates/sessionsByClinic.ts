import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de sesiones particionado por clínica. Habilita
 * `getActividadDiariaClinica` (ficha H3) en O(log n) por día y
 * `recomputeClinic.sesionesUltimos7d` (ficha H6).
 *
 * `sumValue = esSintetica ? 0 : 1` descarta sesiones sintéticas (días sin
 * actividad fabricados por `recomputePatient`) a nivel de aggregate sin tocar
 * la query. `count()` = "sesiones totales (incluidas sintéticas)";
 * `sum()` = "sesiones reales".
 */
export const sessionsByClinic = new TableAggregate<{
  Namespace: Id<"clinics">;
  Key: string;
  DataModel: DataModel;
  TableName: "sessions";
}>(components.sessionsByClinic, {
  namespace: (doc) => doc.clinicId,
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => (doc.esSintetica ? 0 : 1),
});
