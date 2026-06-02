# Aggregates — `@convex-dev/aggregate`

Este directorio contiene las definiciones de los aggregates registrados en
`convex.config.ts`. Cada aggregate mantiene un B-tree interno particionado por
`namespace`, con escrituras O(log n) atómicas vía triggers y lecturas O(log n)
para `count`, `sum`, `min`, `max`, `at`, `indexOf`, `paginate`.

## Por qué cada aggregate tiene su namespace

El namespace aísla árboles B independientes, lo cual:

1. **Reduce contención** — escrituras en distintos namespaces no contienden.
2. **Aplica autorización por construcción** — un query que sólo acepta
   `clinicId` del usuario autenticado nunca puede leer de namespaces de otras
   clínicas, aun si se omitiera la validación explícita.
3. **Permite "top N por namespace"** sin escanear el resto del dataset.

| Aggregate | Namespace | sortKey | Filtro (en trigger) |
|-----------|-----------|---------|---------------------|
| `executionsByPaciente` | `pacienteId` | `fecha` (YYYY-MM-DD) | ninguno |
| `executionsByClinic` | `clinicId` | `fecha` | ninguno |
| `executionsByExercise` | `[clinicId, exerciseId]` | `fecha` | ninguno (deferido a PR H4) |
| `executionsByPacienteDolor` | `pacienteId` | `fecha` | `completado && dolorEscala != null` |
| `sessionsByClinic` | `clinicId` | `fecha` | ninguno (sumValue descarta sintéticas) |
| `plansByClinicActive` | `clinicId` | `fechaFin ?? "9999-12-31"` | `estado === "activo"` |
| `patientsByClinicAdherencia` | `[clinicId, ventana]` | `adherencia` (number) | DirectAggregate, sin trigger |
| `patientsByClinicRiskScore` | `[clinicId, ventana]` | `riskScore` (number) | DirectAggregate, sin trigger |

## Contención por sortKey temporal

Cuando `sortKey` es monotónicamente creciente (fechas, IDs auto-increment),
las escrituras tienden a concentrarse en el extremo derecho del B-tree,
causando contención si hay muchas escrituras concurrentes en el mismo
namespace.

Cálculo para Kengo:

- **`executionsByPaciente`** — 1 paciente ≈ 5-20 executions/día. Concurrencia
  esperada ≈ 0. Sin contención.
- **`executionsByClinic`** — 1 clínica ≈ 50-500 executions/día. Pico realista
  1-2 escrituras/seg. Convex tolera ~10/seg sin OCC severo con árbol
  intermedio.
- **`sessionsByClinic`** — frecuencia mucho menor (1 sesión/paciente/día por
  clínica). Sin contención.
- **`plansByClinicActive`** — escrituras esporádicas (al crear/activar
  planes). Sin contención.

### Mitigaciones si una clínica de alto volumen contiende en producción

1. Subir `maxNodeSize` en la definición del aggregate (default 16 → 32/64).
2. Cambiar el `sortKey` a tuple `[fecha, _id]` para distribuir mejor en el
   árbol.
3. Particionar el namespace `clinicId` por día (`[clinicId, fecha]`) — sólo
   si las opciones 1 y 2 no bastan.

## Triggers y wrapper de mutation

Los triggers viven en `triggers.ts` y se aplican vía `triggers.wrapDB` desde
`convex/_helpers/mutationWithTriggers.ts`. **Cualquier archivo que escriba en
`exerciseExecutions`, `sessions` o `plans` DEBE importar `mutation` /
`internalMutation` desde el wrapper**, no desde `_generated/server`.

Files que están migrados al wrapper en este PR:

- `convex/executions/mutations.ts`
- `convex/sessions/internal.ts`
- `convex/sessions/mutations.ts`
- `convex/plans/internal.ts`
- `convex/plans/mutations.ts`
- `convex/clinicMemberships/mutations.ts`
- `convex/compliance/internal.ts`

### Migraciones one-off (no migradas)

Los archivos en `convex/migrations/` que tocan plans/sessions/executions
(backfills, deleteUserByEmailMutation, deleteClinicCascade, etc.) NO se
migran al wrapper en este PR porque:

1. Son scripts históricos — la mayoría ya se ejecutaron.
2. Cuando se ejecuten futuras migraciones que toquen estas tablas, el
   protocolo será: (a) usar el wrapper si el aggregate debe reflejar el
   cambio, o (b) ejecutar `aggregate.clearAll()` y rebackfillear después si
   la migración es destructiva masiva.

## Backfill

**Backfill NO se ejecuta en Fase 0.** Los aggregates empiezan vacíos en
producción y se irán llenando con escrituras nuevas. El backfill paginado se
hace en cada PR de Fase 1+ junto al cambio de su query consumer, vía
`@convex-dev/migrations` con `insertIfDoesNotExist` (idempotente):

```ts
// Ejemplo para PR H1 (Fase 1)
import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";

const migrations = new Migrations(components.migrations);

export const backfillExecutionsByPaciente = migrations.define({
  table: "exerciseExecutions",
  migrateOne: async (ctx, doc) => {
    await executionsByPaciente.insertIfDoesNotExist(ctx, doc);
  },
});
```

## Verificación de consistencia (PR-by-PR)

Antes de cambiar el query consumer de un aggregate, ejecutar un script
`convex/scripts/validateAggregate.ts` (creación deferida a cada PR de Fase
1+) que itere la tabla origen y compare `aggregate.count() === N` y
`aggregate.sum() === expectedSum` por namespace.

## Pendiente en futuras fases

| PR | Acción |
|----|--------|
| H1 (Fase 1) | Backfill + reescribir `getPatientMetrics` rama adherencia |
| H3 (Fase 1) | Backfill + reescribir `getActividadDiariaClinica` |
| H5 (Fase 2) | Reescribir `recomputePatient` + iniciar escritura a `patientsByClinicAdherencia` |
| H6 (Fase 2) | Reescribir `recomputeClinic` |
| H4 (Fase 2) | Añadir trigger custom para `executionsByExercise` (join con `planExercises`) |
| F7-close (Fase 2) | Eliminar `scheduler.runAfter` post-execution |
| F8-simplify (Fase 2) | Simplificar `recomputeAllPatients` / `recomputeAllClinics` |
| H9 (Fase 3) | Eliminar `patientMetricsSnapshot` y `clinicMetricsSnapshot` |
| H7, H8 (Fase 4) | Features nuevas habilitadas por los aggregates |
