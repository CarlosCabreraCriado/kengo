# Plan de desarrollo — Persistencia de sesión (Opción B)

> **Origen**: análisis derivado de `docs/AUDITORIA_FRONTEND.md` (PR-2). La sesión es ahora entidad principal en Convex; el `SesionPersistenceService` actual solapa responsabilidades con el backend.
> **Objetivo**: Convex como fuente de verdad de los datos clínicos; `localStorage` reducido a *hint* efímero de UI.
> **Fecha**: 2026-04-27

---

## Contexto y decisiones clave

**Comportamiento objetivo**:

| Dato | Antes (estado actual) | Después (Opción B) |
|---|---|---|
| Existencia de sesión `en_curso` | Convex (no consultado al reanudar) | Convex (consultado al reanudar) |
| Ejercicios completados | acumulados en `localStorage` hasta `feedback-final` | persistidos en Convex `exerciseExecutions` al instante |
| `dolorEscala` / `notaPaciente` | enviados en batch al final junto con el ejercicio | aplicados como `patch` sobre executions ya existentes |
| Ejercicio actual / serie / pantalla | en `localStorage` (TTL 24 h) | en `localStorage` como *hint* (TTL 4 h) |
| Plan / `sessionId` / `planIds` | en `localStorage` | desde Convex (`session.planIds`) |

**Pérdida aceptada**: si el *hint* de UI caduca o no existe, al reanudar el cliente sitúa al usuario en el primer ejercicio sin executions completadas (recomputado desde Convex). Se pierde la granularidad "serie N/M dentro del ejercicio actual" pero no se pierde ningún dato clínico.

**No-objetivo**: cambiar la UX de feedback final (sigue siendo "feedback simplificado o detallado al terminar"). Solo cambia el momento de inserción de la `execution` (ahora al completar; antes al final).

---

## Cambios en el modelo / contrato

### Backend (Convex)

- [x] **Nueva mutation `executions.mutations.applyFeedbackBatch`** ✅ — recibe `[{ executionId, dolorEscala?, esfuerzoEscala?, notaPaciente? }]` y aplica `patch` sobre cada execution existente. Verifica permisos (paciente dueño), dispara `createCommentAlert` solo si la nota es nueva y la execution está completada, y ejecuta `recomputeAggregatesAndCheckAutoCloseImpl(sessionId)` una vez por sesión afectada al final del bucle.

- [ ] **(Opcional) Mutation `sessions.mutations.applySessionObservaciones`** — separa el `patch` de `observacionesPaciente` del `complete`. Útil si se quiere registrar observaciones sin cerrar (no necesario para PR pero conviene tenerlo presente).

- [x] Reusar `sessions.queries.getByPacienteAndDateWithExecutions` para reanudación (existe ya, devuelve sesiones del día con `executions` expandidas).

- [x] No tocar `executions.mutations.create` ni `executions.mutations.createBatch` — siguen siendo válidos.

### Frontend (`apps/app/`)

- [ ] **Reducir `SesionPersistenceService`** a un *hint* de UI:
  ```ts
  interface SesionHintUI {
    sessionId: string;             // para validar contra la sesión Convex actual
    ejercicioIndex: number;
    serieActual: number;
    estadoPantalla: EstadoPantalla;
    timestamp: string;
  }
  ```
  - Bumpa clave a `kengo:sesion_activa:v2`.
  - Al arrancar, **eliminar silenciosamente** cualquier `kengo:sesion_activa:v1` existente (con `console.warn`). Los borradores v1 con `registrosPendientes` perderían esos datos — el riesgo es mínimo en práctica porque v1 solo persiste mientras la sesión no esté cerrada.
  - TTL 4 h en lugar de 24 h.
  - El método se renombra: `guardar` → `guardarHint`, `restaurar` → `restaurarHint`.

- [ ] **Reescribir `registrarEjercicioCompletado()` en `SesionStateService`**:
  - Llamar a `executions.mutations.create` inmediatamente con los datos disponibles (sin `dolorEscala`/`notaPaciente`).
  - Guardar `executionId` retornado dentro del registro local (signal `registrosSesion`).
  - Si la mutation falla (red), encolar en una *retry queue* en memoria y continuar (no bloquear UX). Reintentar en próximo evento de completar o en `aplicarFeedbackFinal`.

- [ ] **Reescribir `aplicarFeedbackFinal()` en `SesionStateService`**:
  - Resolver pendientes de la retry queue primero (si los hay).
  - Llamar a `executions.mutations.applyFeedbackBatch` con `[{ executionId, dolorEscala, notaPaciente }, ...]`.
  - Llamar a `sessions.mutations.complete` con `observacionesGenerales`.
  - Limpiar hint de UI.

- [ ] **Reescribir `iniciarSesion()` en `SesionStateService`** — orden de prioridad:
  1. Consultar `sessions.queries.getByPacienteAndDateWithExecutions` para `(usuarioId, fechaHoy)`.
  2. Si existe sesión `en_curso`:
     - Cargar plan vía `planesService.getPlanById(session.planIds[0])` (multi-plan: cargar todos y reconstruir `ejerciciosMultiPlan`).
     - Reconstruir `registrosSesion` a partir de `session.executions` (con `executionId` ya presentes).
     - Recuperar hint de UI:
       - Si hint válido (mismo `sessionId`, no expirado) → aplicar `ejercicioIndex`, `serieActual`, `estadoPantalla`.
       - Si hint inválido o ausente → `ejercicioIndex` = índice del primer ejercicio sin execution completada en orden del plan; `serieActual` = 1; `estadoPantalla` = `'resumen'` (le permite revisar y decidir si continúa).
  3. Si no hay sesión `en_curso` y no hay completada para hoy:
     - Comportamiento actual: cargar plan, posicionar en resumen, esperar a `comenzarSesion()` (que llamará `openOrResume`).
  4. Si hay sesión `completada` o `completada_parcial` para hoy:
     - Mostrar `sesion-completada` directamente.

- [ ] **Migrar el `effect()` de auto-guardado** en `SesionStateService` para que persista solo el hint, no datos clínicos.

- [ ] **Comportamiento offline / errores de red**:
  - Si `executions.mutations.create` falla en `registrarEjercicioCompletado()`, mostrar toast no-bloqueante y mantener el ejercicio en una `pendingExecutions` queue local. La queue solo vive en memoria (no en localStorage) — si se cierra el navegador con elementos en cola, se pierden. Asumimos que las redes inestables son la excepción y pre-pago el costo de claridad arquitectural.
  - Alternativa más robusta (futuro PR): cola persistente con localStorage, separada del hint de UI. **Out of scope para este plan.**

### Tipos

- [ ] **Nuevo tipo `SesionHintUI`** en `libs/shared/models/src/lib/domain/sessions.ts` reemplaza el uso interno de `SesionLocal`. Mantener `SesionLocal` exportado durante la migración por compatibilidad de tipos legacy (marcar `@deprecated`), eliminar en un PR posterior cuando ya no se importe en ningún sitio.

- [ ] **Tipo `RegistroEjercicio`** debe incluir `executionId?: string` (Convex ID retornado al insertar). Permite hacer `patch` en el feedback final.

---

## Tareas ordenadas

### Fase 1 — Backend (1 PR independiente) ✅
- [x] **B1.** Crear `convex/executions/mutations.ts::applyFeedbackBatch`. Implementada con validación de permisos, idempotencia delegada al `patch` de Convex, y disparo de alerta de comentario solo cuando la nota es nueva.
- [x] **B2.** Verificar build (`npm run build` y `npx convex codegen`) sin errores. ⚠️ Pendiente: prueba manual desde Convex dashboard.

### Fase 2 — Tipos compartidos (1 commit pequeño dentro del PR principal) ✅
- [x] **T1.** Añadir `SesionHintUI` en `libs/shared/models/src/lib/domain/sessions.ts`.
- [x] **T2.** Añadir campo opcional `executionId?: string` a `RegistroEjercicio`.
- [x] **T3.** Marcar `SesionLocal` como `@deprecated`.

### Fase 3 — Servicios frontend ✅
- [x] **F1.** Reescribir `SesionPersistenceService` con el nuevo contrato (`SesionHintUI`, clave v2, TTL 4 h, limpieza silenciosa de v1).
- [x] **F2.** En `SesionStateService`, modificar `registrarEjercicioCompletado()` para insertar inmediatamente con `executions.mutations.create`. Guardar `executionId` en el registro local.
- [x] **F3.** En `SesionStateService`, modificar `aplicarFeedbackFinal()` para usar `applyFeedbackBatch` + `complete`.
- [x] **F4.** En `SesionStateService`, reescribir `iniciarSesion()` con la lógica de reanudación basada en `sessions.queries.getByPacienteAndDateWithExecutions` y aplicación condicional del hint.
- [x] **F5.** Eliminar `guardarRegistrosRemotos()` y `crearRegistro()` (ya no se usan).
- [x] **F6.** Modificar el `effect()` de auto-guardado para persistir solo el hint cuando hay `sessionId` y la pantalla está activa.
- [x] **F7.** Implementar `pendingExecutions` queue en memoria para retries de `executions.mutations.create`. Drenada en `aplicarFeedbackFinal` y `finalizarSesion`.

### Fase 4 — Componentes (mínima superficie esperada)
- [ ] **C1.** Verificar que ningún componente accede a `registrosSesion[].executionId` directamente. Si alguno espera el campo legacy, ajustar.
- [ ] **C2.** Verificar que `feedback-final.component` sigue funcionando (es el principal consumidor del flujo de cierre).
- [ ] **C3.** Verificar que `realizar-plan.component` no asume que `registrosPendientes` está en localStorage.

### Fase 5 — Verificación
- [ ] **V1.** `npm run build` sin errores.
- [ ] **V2.** `npm run lint` sin nuevos errores.
- [ ] **V3.** Pruebas manuales (browser real con Convex dev):

| Caso | Acción | Resultado esperado |
|---|---|---|
| Happy path | Sesión completa de N ejercicios + feedback | Convex tiene N executions con dolorEscala. `session.estado = completada`. |
| Reanudación con hint | Cerrar pestaña a mitad del ejercicio 3 (serie 2/3), reabrir | Vuelve a ejercicio 3, serie 2/3, estado `ejercicio`. |
| Reanudación sin hint | Cerrar pestaña, borrar `kengo:sesion_activa:v2` en devtools, reabrir | Vuelve al primer ejercicio sin completar, serie 1, estado `resumen`. |
| Reanudación tras 5 horas | Cerrar pestaña, modificar timestamp del hint a hace 5 h, reabrir | Hint expira, comportamiento como caso anterior. |
| Borrador v1 legacy | Inyectar `kengo:sesion_activa:v1` con datos antiguos en devtools, reabrir | El cliente borra v1 y arranca limpio (con warn en consola). |
| Multi-plan | Iniciar sesión multi-plan, completar, reanudar a mitad | Reanuda con plan combinado correcto. |
| Sesión ya completada hoy | Sesión `completada` para hoy en Convex, abrir `/mi-plan` | Muestra pantalla `sesion-completada`. |
| Error de red en completar | Desconectar red, completar ejercicio, reconectar | Ejercicio entra en `pendingExecutions`; al completar el siguiente o aplicar feedback final, se reintenta y persiste. |

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Pérdida de borradores v1 al deployar | Alta | Bajo | Solo afecta a sesiones que estaban a mitad **en el momento del deploy**. Comunicar en release notes; ofrecer "reiniciar sesión" desde UI. |
| `executions.mutations.create` falla repetidamente (offline) | Baja | Medio | `pendingExecutions` queue en memoria + retry en `aplicarFeedbackFinal`. UX no bloqueada. |
| `applyFeedbackBatch` aplica patches parciales si una falla | Baja | Medio | Mutation backend debe ser transaccional (Convex es transaccional por defecto dentro de una mutation). |
| Race condition: usuario abre `/mi-plan` en dos pestañas | Baja | Bajo | `openOrResume` es idempotente; ambas pestañas verán la misma sesión. El hint de UI es por pestaña — divergencias son solo cosméticas. |
| Multi-plan con `planIds: array` y reconstrucción de `ejerciciosMultiPlan` | Media | Medio | Crear test específico (caso V3 multi-plan). El payload `executions.planExerciseId` permite reconstruir el orden; verificar que `ConfigSesionMultiPlan.ejercicios` se reconstruye correctamente. |

---

## Métricas de éxito

- ✅ `SesionPersistenceService` < 60 LOC.
- ✅ `iniciarSesion()` consulta a Convex como primera fuente.
- ✅ Cero pérdida de datos clínicos al cerrar el navegador.
- ✅ Build y lint sin nuevos errores.
- ✅ Todas las pruebas manuales V3 pasan.

---

## Esfuerzo estimado

- **Backend (Fase 1)**: S — ½ día (1 mutation + tests).
- **Tipos (Fase 2)**: trivial — incluido en commits de Fase 3.
- **Servicios frontend (Fase 3)**: M — 1.5 días.
- **Componentes (Fase 4)**: S — ½ día (verificación principalmente).
- **Verificación (Fase 5)**: S — ½ día (manual exhaustivo).

**Total estimado**: M (~3 días).

---

## Plan de PRs

- [x] **PR-Persist-1** (backend): Añadir `applyFeedbackBatch`. Aislado, deployable independientemente. ✅ **COMPLETADO**
- [x] **PR-Persist-2** (frontend): Refactor de `SesionPersistenceService`, `SesionStateService` (`registrarEjercicioCompletado`, `aplicarFeedbackFinal`, `iniciarSesion`), y tipos. ✅ **COMPLETADO**
- [ ] **PR-Persist-3** (cleanup, futuro): Eliminar `SesionLocal` y `guardarRegistrosRemotos`/`crearRegistro` ya no usados.
