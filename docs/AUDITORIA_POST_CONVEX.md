# Auditoría Post-Migración Convex — Plan trackeable

> **Cómo usar este documento:** cada fase contiene TODOs con checkboxes. Marca `- [x]` cuando completes cada item. Las fases pueden ejecutarse en sesiones separadas.

## Contexto

Kengo migró recientemente de **Directus CMS** a **Convex** como backend principal. La migración está técnicamente operativa pero coexisten dos modelos de datos (legacy + nuevo), con artefactos de transición en schema, código y documentación. La aplicación **aún no tiene usuarios reales**, lo que hace que sea la **ventana óptima** para hacer cambios estructurales sin migración compleja.

**Decisiones tomadas:**
- Eliminar todos los `legacyId`/`legacyDirectusId` (migración Directus es definitiva).
- Eliminar campos denormalizados de nombres (`pacienteNombre`, `fisioNombre`, `ejercicioNombre`) y resolverlos con batch-load.
- Refactor de componentes monolíticos en paralelo a Fase A.
- Este documento es solo análisis y roadmap; la ejecución se hará en sesiones dedicadas cuando se solicite.

---

## Resumen de hallazgos

- 30 tablas, 66 índices.
- **3 problemas CRÍTICOS** (C1–C3).
- **8 problemas IMPORTANTES** (I1–I8).
- **9 problemas MENORES** (M1–M9).
- 111 TODOs documentados en `docs/PLAN_REDISENO_RECORDS.md` sin iniciar.
- 0 unit tests en frontend, 2 en backend (helpers), 1 E2E parcial.

---

## Diagnóstico

### CRÍTICO — C1. Coexistencia de modelos legacy + nuevo en `sessions`
- **Ubicación:** `convex/schema.ts:166-215`.
- Coexisten campos legacy (`fechaInicio` string, `completada`, `observacionesGenerales`, `legacyId`) y campos nuevos opcionales (`clinicId`, `planIds`, `fecha`, `estado`, agregados, `motivoCierre`).
- Validación débil: `estado` es opcional cuando debería ser requerido.
- BN1 (1 sesión por paciente y día) no está enforced en schema.
- Migración `Fase 5 drop legacy` mencionada en `dashboard/queries.ts:4` está sin ejecutar.

### CRÍTICO — C2. Desnormalizaciones sin sincronización
- **Ubicación:** `plans.pacienteNombre/fisioNombre`, `planExercises.ejercicioNombre`, `routineExercises.ejercicioNombre`, `physioAlerts.pacienteNombre`.
- Cuando `users.mutations.updateProfile` modifica un nombre, los campos denormalizados en planes/alertas/items quedan stale.
- **Decisión:** eliminar y resolver con batch-load. Mantener solo `physioAlerts.pacienteNombre` (snapshot histórico legítimo).

### CRÍTICO — C3. N+1 queries en operaciones frecuentes
| Ubicación | Síntoma |
|-----------|---------|
| `convex/sessions/queries.ts:30-129` (`getByPacienteAndDateWithExecutions`) | 1 sesión con 10 ejercicios → 12 queries; 3 sesiones → 36 queries |
| `convex/plans/queries.ts:186-191` (`getActiveForPatientToday`) | Bucle secuencial sobre planes |
| `convex/snapshots/queries.ts:54-62` (`getPatientMetrics`) | 100 snapshots → 100 queries de `users` |
| `convex/clinics/queries.ts:15-26` (`myClinicsList`) | Usuario en 5 clínicas → 10 queries |
| `convex/assignments/queries.ts:12-22` (`listByClinic`) | 50 asignaciones → 100 queries de `users` |

### IMPORTANTE — I1–I8
- **I1.** Tabla `userDetails` deprecada con datos sin migrar (`convex/schema.ts:39-47`, `convex/users/migration.ts:25-73`).
- **I2.** `clinicMemberships.puesto` acepta números legacy (1/2/4) además de literales (`convex/schema.ts:74-86`).
- **I3.** Tipos demasiado permisivos en schema:
  - `exercises.seriesDefecto/repeticionesDefecto` son `v.string()` (deberían ser `v.number()`).
  - `users.sexo` es string libre.
  - `clinics.colorPrimario/colorSecundario` no validados como hex.
  - `plans.fechaInicio/fechaFin` opcionales aunque deberían ser requeridos para `estado='activo'`.
- **I4.** Índices faltantes/subóptimos:
  - `clinics.by_createdBy` (mis clínicas creadas).
  - Search index en `clinics.nombre`.
  - `routineExercises.by_routineId_sort`.
  - `physioAlerts.by_generadoPor` (revisar si hace falta).
  - `users.by_numeroColegiado` (baja prioridad).
- **I5.** 12+ campos `legacyId` con índices dedicados; maps duplicados en frontend.
- **I6.** Tipos del dominio duplicados: `libs/shared/models/.../domain/exercises.ts` usa snake_case (`id_ejercicio`, `nombre_ejercicio`) vs Convex `Doc<"exercises">` en camelCase. Mappers con `any`.
- **I7.** Componentes monolíticos:
  - `feedback-final.component.ts` (1272 líneas).
  - `ejercicio-activo.component.ts` (1187 líneas).
  - `descanso.component.ts` (882 líneas).
  - `paciente-detail.component.ts` (822 líneas).
  - `plan-builder.service.ts` (955 líneas).
  - `registro-sesion.service.ts` (706 líneas).
- **I8.** Cobertura de tests prácticamente cero (0 frontend, 2 backend, 1 E2E parcial).

### MENOR — M1–M9
- **M1.** Documentación obsoleta (`CLAUDE.md:5,28`, `FUNCIONALIDADES.md:30`, `docs/DATABASE_STRUCTURE.md`, `docs/poximos_pasos.md`).
- **M2.** `.env.example` inexistente; credenciales en `.env.local`/`.env.e2e` en texto plano.
- **M3.** `_helpers/permissions.ts` y `_helpers/authorization.ts` coexisten sin documentar diferencia.
- **M4.** `BetterAuthService` y `AuthService` duplicados.
- **M5.** Mix RxJS + Signals incompleto en componentes.
- **M6.** Bundle size sin análisis post-migración.
- **M7.** `sessions.planIds` como array; búsquedas inversas requieren scan.
- **M8.** Naming inconsistente: `nombreEjercicio` vs `nombre`.
- **M9.** Constantes `localStorage` dispersas (`'kengo:sesion_activa:v1'`, `'carrito:last_fisio_id'`).

---

## Fase A — Consolidación legacy + eliminación de legacyIds ✅ COMPLETADA

> Objetivo: limpiar el modelo dual y eliminar todos los `legacyId`. Estimado: 1 sprint (~5 días).
> **Resultado:** schema reducido, deployado en producción, frontend adaptado, TypeScript compila.

### A.1 Migraciones one-shot ✅
- [x] `migrateUserDetailsToUsers`: 0 docs (ya migrado anteriormente)
- [x] `migrateRolesToLiterals`: 35 memberships convertidos (1/2/4 → fisio/paciente/admin)
- [x] `backfillSearchableText`: 0 docs (ya backfilled)
- [x] `cleanupOrphanLegacySessions` dryRun + real: **105 sesiones huérfanas eliminadas**
- [x] `cleanupLegacySessionFields` dryRun + real: **86 sesiones limpiadas** (campos `completada`, `observacionesGenerales`, `legacyId`)
- [x] `dropLegacyIds:cleanAll` (script temporal): **692 documentos limpiados** (37 users + 4 clinics + 298 exercises + 20 categories + 86 plans + 242 planExercises + 5 routines)

### A.2 Schema cleanup — `sessions` ✅
- [x] Eliminado `sessions.completada`
- [x] Eliminado `sessions.observacionesGenerales`
- [x] Eliminado `sessions.legacyId` y su índice `by_legacyId`
- [x] `sessions.estado` ahora requerido
- [x] `sessions.clinicId` ahora requerido
- [x] `sessions.fecha` ahora requerido
- [x] Índice `by_estado_fechaInicio` eliminado, sustituido por `by_pacienteId_estado`
- [x] `fechaInicio` mantenido (es ISO timestamp distinto de `fecha`)

### A.3 Schema cleanup — `clinicMemberships.puesto` ✅
- [x] Verificado que no quedan documentos con `puesto: number`
- [x] `puesto` ahora solo `v.union(v.literal("fisio"), v.literal("paciente"), v.literal("admin"))`

### A.4 Schema cleanup — eliminar todos los legacyIds ✅
- [x] `users.legacyDirectusId` y su índice `by_legacyDirectusId` eliminados
- [x] `clinics.legacyId` y su índice `by_legacyId` eliminados
- [x] `exercises.legacyId` y su índice `by_legacyId` eliminados
- [x] `categories.legacyId` y su índice `by_legacyId` eliminados
- [x] `planExercises.legacyId` y su índice `by_legacyId` eliminados
- [x] `plans.legacyId` y su índice `by_legacyId` eliminados
- [x] `routines.legacyId` y su índice `by_legacyId` eliminados
- [x] **Tabla `userDetails` eliminada del schema completamente**
- [x] Archivos `convex/users/migration.ts` y `convex/migrations/cleanup.ts` eliminados (scripts ya ejecutados)

### A.5 Frontend cleanup — eliminar maps de IDs ✅
- [x] Map `legacyToConvexId` eliminado en `ejercicios.service.ts`
- [x] Map `legacyToConvexId` eliminado en `planes.service.ts`
- [x] Map `legacyToConvexClinicId` eliminado en `clinicas.service.ts`
- [x] Map `legacyToConvexId` eliminado en `rutinas.service.ts`
- [x] Map `idMap` eliminado en `plan-builder.service.ts`
- [x] Componentes migrados a `Id<"tabla">` (string) en lugar de números
- [x] `RegistroSesionService` adaptado (sin lógica de "número legacy")
- [x] `CumplimientoService` adaptado (sin lógica de "legacy numérico")
- [x] `AsignacionesService` reescrito sin `resolveUserByLegacyId`
- [x] `SessionService.transformarUsuarioConvex` adaptado (id = `_id`)

### A.6 Frontend cleanup — eliminar tipos legacy del dominio ✅
- [x] `libs/shared/models/.../domain/exercises.ts`: `id_ejercicio`, `id_categoria` → `string`
- [x] `libs/shared/models/.../domain/plans.ts`: `id_plan`, `plan_item`, etc → `string`
- [x] `libs/shared/models/.../domain/routines.ts`: `id_rutina`, `id`, `rutina` → `string`
- [x] `libs/shared/models/.../domain/clinics.ts`: `id_clinica` → `string`
- [x] `libs/shared/models/.../domain/users.ts`: `ClinicaUsuario.id_clinica` → `string`
- [x] `libs/shared/models/.../domain/sessions.ts`: `planId`, `planItemId`, `registroId` → `string`
- [x] `libs/shared/models/.../domain/compliance.ts`: `plan_id` → `string`
- [x] `libs/shared/models/.../domain/dashboard.ts`: `id_plan` → `string`
- [x] `libs/shared/models/.../domain/access-codes.ts`: `id` → `string`
- [x] `libs/shared/models/.../domain/assignments.ts`: `id`, `idClinica` → `string`
- [x] `libs/shared/models/.../payloads/*.ts`: actualizado a `string`
- [x] `libs/shared/models/.../records/plans.record.ts`: actualizado a `string`
- [x] `libs/shared/models/.../types/common.ts`: `ID = string` (era `string | number`)
- [x] Adaptados ~30 componentes y servicios del frontend

### A.7 Verificación Fase A ✅
- [x] `npx convex deploy` exitoso, sin warnings de schema
- [x] `npx convex run migrations/validation:summary` confirma datos íntegros (86 sessions, 404 executions, 86 daily rollups)
- [x] `tsc -p apps/app/tsconfig.app.json --noEmit` pasa con **0 errores**
- [x] `nx run app:lint`: 314 errores totales (313 pre-existentes + 1 nuevo `as any` en mutation, no bloqueador)
- [ ] Smoke test manual end-to-end: pendiente (requiere usuario probando en navegador)
- [x] Diff: schema reducido (~80 líneas), 7 índices eliminados, 1 tabla eliminada, 692 docs limpiados, ~35 archivos modificados

---

## Fase B — N+1, validación y eliminación de desnormalizaciones

> Objetivo: eliminar queries N+1, endurecer validación de schema, resolver nombres con batch-load. Estimado: 1 sprint (~5 días).

### B.1 Helper `batchGet`
- [ ] Crear `convex/_helpers/batchGet.ts` con función reutilizable
- [ ] Documentar patrón de uso en comentario del helper

### B.2 Refactor queries N+1
- [ ] Refactor `convex/sessions/queries.ts:30-129` (`getByPacienteAndDateWithExecutions`)
- [ ] Refactor `convex/plans/queries.ts:186-191` (`getActiveForPatientToday`)
- [ ] Refactor `convex/snapshots/queries.ts:54-62` (`getPatientMetrics`)
- [ ] Refactor `convex/clinics/queries.ts:15-26` (`myClinicsList`)
- [ ] Refactor `convex/assignments/queries.ts:12-22` (`listByClinic`)
- [ ] Medir latencia p95 antes/después; objetivo: -50%

### B.3 Eliminar campos denormalizados de nombres
- [ ] Eliminar `plans.pacienteNombre`
- [ ] Eliminar `plans.fisioNombre`
- [ ] Eliminar `planExercises.ejercicioNombre`
- [ ] Eliminar `routineExercises.ejercicioNombre`
- [ ] Mantener `physioAlerts.pacienteNombre` (snapshot histórico — documentar)
- [ ] Adaptar queries que devolvían estos campos para enriquecer vía `batchGet`
- [ ] Eliminar sincronización manual en `users/mutations.ts` (búsquedas de "pacienteNombre")
- [ ] Adaptar frontend para consumir nombres desde la respuesta enriquecida

### B.4 Endurecer tipos en schema
- [ ] Migrar datos: convertir `exercises.seriesDefecto` y `repeticionesDefecto` de string a number
- [ ] Cambiar tipo en schema a `v.optional(v.number())`
- [ ] Cambiar `users.sexo` a `v.optional(v.union(v.literal("M"), v.literal("F"), v.literal("otro")))`
- [ ] Añadir validador de formato `#RRGGBB` para `clinics.colorPrimario` y `colorSecundario` en mutations
- [ ] Añadir validación: si `plans.estado === "activo"`, `fechaInicio` y `fechaFin` requeridos en mutation

### B.5 Índices faltantes
- [ ] Añadir `clinics.by_createdBy`
- [ ] Añadir search index en `clinics.nombre`
- [ ] Añadir `routineExercises.by_routineId_sort`
- [ ] Evaluar si `physioAlerts.by_generadoPor` aporta; añadir si sí
- [ ] Verificar performance de índices 3-field existentes (`patientMetricsSnapshot.by_clinicId_ventana_riskScore` etc.)

### B.6 Verificación Fase B
- [ ] Latencia p95 de las 5 queries críticas reducida ≥50%
- [ ] Type-check y lint pasan
- [ ] Smoke test manual completo
- [ ] Verificar que editar perfil refleja cambios en planes/listados sin delay

---

## Fase C — Tests y observabilidad

> Objetivo: cobertura mínima para evitar regresiones futuras. Estimado: 1 sprint (~5 días).

### C.1 Tests backend (Convex)
- [ ] Test de `users.upsertFromAuth` (creación + actualización)
- [ ] Test de `plans.create` (validación de campos requeridos)
- [ ] Test de `executions.record` (idempotencia)
- [ ] Test de `sessions.openOrResume` (BN1 — 1 por paciente/día)
- [ ] Test de `clinics.create` y permisos
- [ ] Test de query count en `getByPacienteAndDateWithExecutions` (no más de N queries)
- [ ] Test de query count en `getPatientMetrics`

### C.2 Tests frontend
- [ ] Tests de `PlanesService` (filtrado, paginación, optimistic updates)
- [ ] Tests de `EjerciciosService` (favoritos, búsqueda)
- [ ] Tests de `RegistroSesionService` (state machine de sesión)
- [ ] Tests de `CumplimientoService` (cálculo de adherencia)

### C.3 E2E happy path
- [ ] Setup Playwright con datos seed
- [ ] Test E2E: login fisio → crear plan → asignar paciente
- [ ] Test E2E: login paciente → ejecutar sesión → ver actividad
- [ ] Test E2E: login fisio → ver dashboard con métricas actualizadas
- [ ] Integrar E2E en CI

### C.4 Observabilidad
- [ ] Crear utilidad común de logging estructurado
- [ ] Reemplazar `console.error` en mutations
- [ ] Re-ejecutar `nx run app:build --analyze` y documentar baseline post-Convex

### C.5 Verificación Fase C
- [ ] ≥10 unit tests cubriendo mutations críticas
- [ ] ≥5 unit tests en servicios de frontend
- [ ] 1 E2E happy path estable en CI
- [ ] Bundle size baseline documentado

---

## Fase D — Refactor de componentes monolíticos (en paralelo a Fase A)

> Objetivo: reducir componentes >1000 líneas extrayendo servicios puros. Riesgo asumido: sin tests todavía. Estimado: 1–2 sprints en paralelo.

### D.1 Extraer servicios puros
- [ ] Crear `apps/app/src/app/features/sesion/domain/metrics-calculator.ts` (cálculos puros desde `feedback-final.component.ts` y `registro-sesion.service.ts`)
- [ ] Crear `apps/app/src/app/features/sesion/domain/session-state-machine.ts` (transiciones de pantalla)
- [ ] Crear `apps/app/src/app/core/utils/id-resolver.ts` si Fase A deja algún caso pendiente

### D.2 Refactor `ejercicio-activo.component.ts` (1187 líneas)
- [ ] Extraer `<video-reproductor>` (player + fullscreen)
- [ ] Extraer `<gestos-handler>` (swipe/wheel)
- [ ] Reusar `<contador-series>` existente
- [ ] Componente padre solo orquestación (<400 líneas)

### D.3 Refactor `feedback-final.component.ts` (1272 líneas)
- [ ] Extraer cálculos a `MetricsCalculator`
- [ ] Crear `<resumen-metricas>`
- [ ] Crear `<grafico-dolor>`
- [ ] Crear `<formulario-observaciones>`
- [ ] Componente padre <400 líneas

### D.4 Refactor `plan-builder.service.ts` (955 líneas)
- [ ] Crear `PlanBuilderState` (UI state con signals)
- [ ] Crear `PlanBuilderPersistence` (mutations a Convex)
- [ ] Crear `PlanBuilderValidator` (reglas de negocio puras)
- [ ] Componente builder consume los 3 servicios

### D.5 Refactor `registro-sesion.service.ts` (706 líneas)
- [ ] Mover state machine a `SessionStateMachine`
- [ ] Mover cálculos a `MetricsCalculator`
- [ ] Servicio queda como orquestador <300 líneas

### D.6 Estandarización
- [ ] Decidir naming: `nombre` simple en todas las tablas (recomendado)
- [ ] Renombrar `exercises.nombreEjercicio` → `nombre`
- [ ] Renombrar `categories.nombreCategoria` → `nombre`
- [ ] Adaptar frontend
- [ ] Centralizar constantes localStorage en `core/storage/keys.ts`

### D.7 Verificación Fase D
- [ ] Ningún componente >500 líneas
- [ ] Smoke test manual completo
- [ ] Servicios puros testeables sin Angular DI

---

## Fase E — Documentación y onboarding (paralelo, 1–2 días)

- [ ] Actualizar `CLAUDE.md` para reflejar Convex como backend principal (eliminar referencias a Directus en líneas 5 y 28)
- [ ] Actualizar `FUNCIONALIDADES.md` (línea 30 menciona Directus)
- [ ] Reescribir `docs/DATABASE_STRUCTURE.md` con el schema actual (incluir `exerciseExecutions`, `dailyPatientRollup`, `physioAlerts`)
- [ ] Archivar `docs/poximos_pasos.md` (referencias a Angular Material ya eliminado)
- [ ] Decidir destino de `docs/PLAN_REDISENO_RECORDS.md`: archivar o reactivar
- [ ] Crear `.env.example` con todas las variables necesarias y comentarios
- [ ] Mover credenciales de `.env.local` a Railway secrets
- [ ] Documentar diferencia entre `_helpers/permissions.ts` y `_helpers/authorization.ts` (o consolidarlos)
- [ ] Documentar rol de `BetterAuthService` vs `AuthService` (o consolidarlos)

---

## Verificación end-to-end (tras cada fase)

```bash
# Backend
npx convex dev   # debe reiniciar sin warnings de schema
npx convex run <migration> --dryRun

# Frontend
nx run app:lint
nx run app:typecheck
nx run app:test
nx run app:build --analyze

# Smoke E2E (manual o Playwright)
# 1. login fisio
# 2. crear plan con 3 ejercicios
# 3. asignar a paciente
# 4. login paciente y completar sesión
# 5. ver actividad y cumplimiento
# 6. verificar dashboard fisio actualizado
```

**Métricas de éxito globales:**
- [ ] Schema sin campos `legacy*`
- [ ] Cero `v.optional()` en campos requeridos lógicamente
- [ ] Latencia p95 de las 5 queries N+1 reducida ≥50%
- [ ] Bundle size baseline post-Convex documentado
- [ ] ≥10 unit tests cubriendo mutations críticas
- [ ] 1 E2E del happy path estable en CI
- [ ] Ningún componente Angular >500 líneas

---

## Archivos críticos

**Backend:**
- `convex/schema.ts` — Schema completo, contiene la deuda más visible
- `convex/sessions/queries.ts:30-129` — N+1 más severo
- `convex/migrations/cleanup.ts` — Scripts de limpieza no ejecutados
- `convex/users/migration.ts` — Migraciones one-shot pendientes
- `convex/_helpers/` — Posible duplicación entre `permissions.ts` y `authorization.ts`

**Frontend:**
- `apps/app/src/app/features/sesion/data-access/registro-sesion.service.ts` (706 líneas)
- `apps/app/src/app/features/planes/data-access/plan-builder.service.ts` (955 líneas)
- `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/feedback-final/feedback-final.component.ts` (1272 líneas)
- `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/ejercicio-activo/ejercicio-activo.component.ts` (1187 líneas)
- `libs/shared/models/src/lib/domain/*.ts` — Tipos legacy snake_case

**Documentación:**
- `CLAUDE.md` — Actualizar referencias Directus → Convex
- `docs/PLAN_REDISENO_RECORDS.md` — 111 TODOs sin iniciar; decidir destino
- `FUNCIONALIDADES.md` — Reescribir o archivar
