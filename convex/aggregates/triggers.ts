import { Triggers } from "convex-helpers/server/triggers";
import { TableAggregate } from "@convex-dev/aggregate";
import type {
  DocumentByName,
  GenericDataModel,
  GenericMutationCtx,
  TableNamesInDataModel,
} from "convex/server";
import type { Value as ConvexValue } from "convex/values";
import { DataModel } from "../_generated/dataModel";
import { executionsByPaciente } from "./executionsByPaciente";
import { executionsByClinic } from "./executionsByClinic";
import { executionsByPacienteDolor } from "./executionsByPacienteDolor";
import { sessionsByClinic } from "./sessionsByClinic";
import { plansByClinicActive } from "./plansByClinicActive";

/**
 * Wrapper de `TableAggregate.trigger()` que aplica un filtro por documento.
 *
 * Cubre los 4 cuadrantes correctamente:
 *  - wasIn && nowIn   → replace
 *  - wasIn && !nowIn  → delete (el doc dejó de cumplir el filtro)
 *  - !wasIn && nowIn  → insert (el doc empezó a cumplir el filtro)
 *  - !wasIn && !nowIn → no-op
 *
 * Sin esto, los aggregates filtrados (dolor, planes activos) se
 * desincronizarían cuando un documento cruza el predicado por update.
 */
function filteredTrigger<
  DM extends GenericDataModel,
  TableName extends TableNamesInDataModel<DM>,
  K extends ConvexValue,
  Namespace extends ConvexValue | undefined,
>(
  aggregate: TableAggregate<{
    Namespace: Namespace;
    Key: K;
    DataModel: DM;
    TableName: TableName;
  }>,
  filter: (doc: DocumentByName<DM, TableName>) => boolean,
) {
  return async (
    ctx: GenericMutationCtx<DM>,
    change: {
      id: unknown;
      operation: "insert" | "update" | "delete";
      oldDoc: DocumentByName<DM, TableName> | null;
      newDoc: DocumentByName<DM, TableName> | null;
    },
  ): Promise<void> => {
    const wasIn = change.oldDoc != null && filter(change.oldDoc);
    const nowIn = change.newDoc != null && filter(change.newDoc);
    if (!wasIn && !nowIn) return;
    if (!wasIn && nowIn) {
      await aggregate.insert(ctx, change.newDoc!);
    } else if (wasIn && !nowIn) {
      await aggregate.delete(ctx, change.oldDoc!);
    } else {
      await aggregate.replace(ctx, change.oldDoc!, change.newDoc!);
    }
  };
}

export const triggers = new Triggers<DataModel>();

// === exerciseExecutions ===
// Aggregates simples: la inserción se hace siempre (sin filtro).
triggers.register("exerciseExecutions", executionsByPaciente.trigger());
triggers.register("exerciseExecutions", executionsByClinic.trigger());

// Filtrado: sólo ejecuciones completadas con dolor reportado.
triggers.register(
  "exerciseExecutions",
  filteredTrigger(
    executionsByPacienteDolor,
    (doc) => doc.completado && doc.dolorEscala != null,
  ),
);

// NOTA: executionsByExercise NO se registra aquí — su namespace requiere join
// contra `planExercises` para obtener `exerciseId`. PR H4 (Fase 2) añadirá un
// trigger custom que use `ctx.db.get(planExerciseId)` antes de llamar a
// `executionsByExercise._insert(...)` con la tupla correcta.

// === sessions ===
// El filtro de sintéticas vive en `sumValue` (count incluye sintéticas, sum
// no), no en el trigger — todas las sesiones entran al aggregate.
triggers.register("sessions", sessionsByClinic.trigger());

// === plans ===
// Filtrado: sólo planes en estado "activo".
triggers.register(
  "plans",
  filteredTrigger(plansByClinicActive, (doc) => doc.estado === "activo"),
);

// NOTA: patientsByClinicAdherencia y patientsByClinicRiskScore son
// DirectAggregates (no atados a tabla); se actualizan desde `recomputePatient`
// en PR H5 (Fase 2). No tienen trigger automático aquí.
