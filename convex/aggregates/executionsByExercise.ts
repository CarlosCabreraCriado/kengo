import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import { DataModel, Id } from "../_generated/dataModel";

/**
 * Aggregate de ejecuciones particionado por (clínica, ejercicio).
 *
 * Habilita la feature "ejercicio más usado en tu clínica esta semana"
 * (ficha H7) y reemplazará `recomputeExerciseUsage` / tabla
 * `exerciseUsageRollup` (ficha H4).
 *
 * NOTA — DEFERIDO A PR H4 (Fase 2):
 * El namespace requiere `exerciseId`, que NO está denormalizado en
 * `exerciseExecutions`; hay que resolverlo vía `planExercises`. Por eso este
 * aggregate NO se conecta a triggers en Fase 0 — la lógica de insert vive en
 * el PR H4, que añadirá un trigger custom que haga el join antes de llamar a
 * `_insert(...)` con la tupla correcta.
 *
 * En Fase 0 el componente queda registrado en `convex.config.ts` y la
 * instancia exportada para que PR H4 sólo tenga que añadir el trigger custom.
 */
export const executionsByExercise = new TableAggregate<{
  Namespace: [Id<"clinics">, Id<"exercises">];
  Key: string;
  DataModel: DataModel;
  TableName: "exerciseExecutions";
}>(components.executionsByExercise, {
  // Estas funciones NO se usan en Fase 0 (no hay trigger registrado). PR H4
  // las sustituirá por un trigger custom que reciba `ctx` y haga el join con
  // `planExercises`. Aquí van como sentinels conservadores para satisfacer el
  // tipo: el `namespace` devuelve `[clinicId, planExerciseId-as-exerciseId]`
  // que NUNCA se usa en lecturas hasta PR H4.
  namespace: (doc) => [
    doc.clinicId,
    doc.planExerciseId as unknown as Id<"exercises">,
  ],
  sortKey: (doc) => doc.fecha,
  sumValue: (doc) => (doc.completado ? 1 : 0),
});
