import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de planes activos particionado por clínica, ordenado por
 * `fechaFin`. Habilita `dashboard.planesPorVencer` (ficha F3) y conteos de
 * planes activos por clínica (ficha F6).
 *
 * `sortKey = fechaFin ?? "9999-12-31"` — los planes sin `fechaFin` van al
 * final del árbol; "no vencen" desde la perspectiva del rango temporal.
 *
 * El filtro `estado === "activo"` se aplica en el trigger custom (ver
 * `triggers.ts`): planes en otros estados (borrador/completado/modificado/
 * cancelado) NO entran en este aggregate. En `update`, si el estado pasa de
 * "activo" a otro o viceversa, el trigger custom gestiona insert/delete.
 */
export const plansByClinicActive = new TableAggregate<{
  Namespace: Id<"clinics">;
  Key: string;
  DataModel: DataModel;
  TableName: "plans";
}>(components.plansByClinicActive, {
  namespace: (doc) => doc.clinicId,
  sortKey: (doc) => doc.fechaFin ?? "9999-12-31",
  sumValue: () => 1,
});
