# Auditoría Frontend Kengo — apps/app/

> **Documento destino**: `docs/AUDITORIA_FRONTEND.md` (mismo contenido).
> **Fecha**: 2026-04-27
> **Alcance**: `apps/app/src/app/` — Angular 20, standalone, signals, OnPush.

---

## Contexto

Tras una migración importante (Directus → Convex, refactor de actividad y pacientes recientes), conviene una mirada en frío al estado del frontend para decidir qué refactors merecen la pena. La feature `sesion` (motor que ejecuta el plan diario, núcleo del producto) es la zona de mayor deuda técnica, con tres componentes >800 líneas concentrados ahí. Este documento es un **menú evaluable**: cada propuesta es independiente y puede marcarse como hecha (`[x]`) a medida que se ejecute.

Leyenda de campos:
- **Esfuerzo**: S (<½ día) · M (1–2 días) · L (3–5 días) · XL (semana+)
- **Impacto**: 🟢 Bajo · 🟡 Medio · 🔴 Alto
- **Riesgo**: 🟢 Bajo · 🟡 Medio · 🔴 Alto (probabilidad de regresión)
- **Prioridad sugerida**: P0 (urgente) · P1 (próximo trimestre) · P2 (cuando haya hueco) · P3 (opcional)

---

## Resumen ejecutivo (tracking general)

| ✅ | # | Propuesta | Área | Esfuerzo | Impacto | Riesgo | Prioridad |
|----|---|-----------|------|----------|---------|--------|-----------|
| [ ] | 1 | Descomponer `feedback-final.component` (1272 LOC) | sesion | L | 🔴 | 🟡 | **P0** |
| [ ] | 2 | Descomponer `ejercicio-activo.component` (1187 LOC) | sesion | L | 🔴 | 🔴 | **P0** |
| [ ] | 3 | Descomponer `descanso.component` (882 LOC) | sesion | M | 🟡 | 🟡 | P1 |
| [x] | 4 | Partir `registro-sesion.service` (705 LOC) en 3 servicios | sesion | M | 🔴 | 🔴 | **P0** ✅ |
| [ ] | 5 | Extraer modo rutina de `plan-builder.service` (929 LOC) | planes | L | 🔴 | 🔴 | P1 |
| [ ] | 6 | Descomponer `paciente-detail.component` (821 LOC) | pacientes | L | 🟡 | 🟡 | P1 |
| [x] | 7 | Mover plantilla inline de god-components a `.html`/`.css` | sesion | S | 🟢 | 🟢 | **P0** (PR-1) ✅ |
| [ ] | 8 | `EmptyStateComponent` + pipe `formatDate` | shared | S | 🟢 | 🟢 | P2 |
| [ ] | 9 | `FilteredListService<T>` base (filtrado+paginación) | core | M | 🟡 | 🟡 | P2 |
| [ ] | 10 | Mover rutas de `planes`, `rutinas`, `sesion` a `*.routes.ts` | rutas | S | 🟢 | 🟢 | P2 |
| [ ] | 11 | Aplicar `unsavedChangesGuard` a `rutina-builder` | rutas | S | 🟡 | 🟢 | P1 |
| [ ] | 12 | Revisar guard de rol en `/planes` (list) | rutas | S | 🟡 | 🟡 | P1 |
| [ ] | 13 | Unificar simetría `/galeria/rutinas` ↔ creación de rutinas | rutas | S | 🟢 | 🟢 | P3 |
| [ ] | 14 | Composable `useResponsive()` | shared | S | 🟡 | 🟢 | P2 |

### Plan de ejecución por PRs

- [x] **PR-1 (S)** — Extraer plantillas inline (#7) ✅ **COMPLETADO**
- [x] **PR-2 (M)** — Partir `registro-sesion.service` (#4) ✅ **COMPLETADO**
- [ ] **PR-3 (L)** — Descomponer `feedback-final` (#1)
- [ ] **PR-4 (L)** — Descomponer `ejercicio-activo` + `descanso` (#2 + #3)
- [ ] **PR-5 (L)** — Separar `plan-builder.service` y `paciente-detail` (#5 + #6)
- [ ] **PR-Routes** — `unsavedChangesGuard` rutinas + guard `/planes` (#11 + #12)

---

# SECCIÓN 1 — God components (prioridad alta)

## [ ] 1.1 — Descomponer `feedback-final.component.ts` (1272 LOC)

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/feedback-final/`

**Problema**:
- Plantilla inline + animaciones + lógica de feedback dual (modo simple/detallado) + confetti + escala global y por ejercicio + observaciones.
- Sin archivo `.html` ni `.css` separados: todo embebido en el `.ts`.
- Mezcla 4 responsabilidades:
  1. Vista celebratoria (confetti, header animado, orbes).
  2. Captura de feedback global (un solo dolor + observaciones).
  3. Captura de feedback detallado (dolor por ejercicio).
  4. Conmutación entre modos y agregación final del payload.

**Propuesta**:
- [ ] Extraer plantilla y CSS a archivos separados (cubierto por #7).
- [ ] Crear `<feedback-celebracion>` (confetti + header animado).
- [ ] Crear `<feedback-global-form>` (dolor único + observaciones).
- [ ] Crear `<feedback-detallado-form>` (lista de `EscalaDolor` por ejercicio).
- [ ] Convertir `feedback-final.component` en contenedor que orquesta modos y emite `(completado)`.
- [ ] Mover lógica de animación de confetti a `realizar-plan.animations.ts`.

**Archivos afectados**:
- `feedback-final.component.ts` (refactor)
- Nuevos: `componentes/feedback-celebracion/`, `componentes/feedback-global-form/`, `componentes/feedback-detallado-form/`
- `realizar-plan.animations.ts` (extender)

**Esfuerzo**: L (3–4 días) · **Impacto**: 🔴 · **Riesgo**: 🟡 (animaciones delicadas, requiere prueba visual)

**Prioridad**: **P0**

---

## [ ] 1.2 — Descomponer `ejercicio-activo.component.ts` (1187 LOC)

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/ejercicio-activo/`

**Problema**:
- Plantilla inline con video player + header flotante + panel info + timeline.
- Maneja gestos manuales (`wheel`, `touchstart`, `touchend`) para expandir/contraer video.
- `BreakpointObserver` inline (patrón duplicado en 3+ sitios).
- `@ViewChild('videoPlayer')` con manipulación imperativa.
- Mezcla:
  1. Reproductor de video (play/pause, indicador, expansión).
  2. Cabecera de progreso (índice ejercicio + barra).
  3. Panel info (nombre, descripción, contador de series, temporizador).
  4. Detección de gestos.

**Propuesta**:
- [ ] Extraer plantilla y CSS (cubierto por #7).
- [ ] Crear `<ejercicio-video-player>` (video + poster + indicador play/pause + expansión + gestos).
- [ ] Crear `<ejercicio-progress-header>` (índice + barra), reutilizable en `descanso`.
- [ ] Crear `<ejercicio-info-panel>` (nombre, descripción HTML, contador, temporizador).
- [ ] Reemplazar `BreakpointObserver` inline por `useResponsive()` (#14).
- [ ] Si los gestos se reusan en `descanso`, extraer directiva `appSwipeGestures`.

**Archivos afectados**:
- `ejercicio-activo.component.ts` (refactor profundo)
- Nuevos: `componentes/ejercicio-video-player/`, `componentes/ejercicio-progress-header/`, `componentes/ejercicio-info-panel/`
- Posible: `shared/directives/swipe-gestures.directive.ts`

**Esfuerzo**: L (4–5 días) · **Impacto**: 🔴 · **Riesgo**: 🔴 (componente más usado del producto)

**Prioridad**: **P0** — ejecutar después de #1.6 (servicio limpio).

---

## [ ] 1.3 — Descomponer `descanso.component.ts` (882 LOC)

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/descanso/`

**Propuesta**:
- [ ] Extraer plantilla y CSS (cubierto por #7).
- [ ] Reutilizar `<ejercicio-progress-header>` y `<app-timeline-sesion>` (ya existe).
- [ ] Extraer `<countdown-display>` si la cuenta atrás supera 150 LOC.
- [ ] Mover transiciones `descansoEntreEjercicios` vs `descansoEntreSeries` a servicio si aún están en el componente.

**Archivos afectados**: `descanso.component.ts` + reutiliza componentes de #1.2.

**Esfuerzo**: M (2 días) · **Impacto**: 🟡 · **Riesgo**: 🟡

**Prioridad**: P1 — depende de #1.2.

---

## [ ] 1.4 — Descomponer `paciente-detail.component.ts` (821 LOC + 791 HTML)

**Ubicación**: `apps/app/src/app/features/pacientes/pages/paciente-detail/`

**Problema**:
- Inyecta 11 servicios.
- Define 3 interfaces locales (`ComentarioSesion`, `SesionAgrupada`, `EstadisticasPaciente`).
- Importa `PlanBuilderService` desde otro feature (acoplamiento).
- Template de 791 LOC con ≥4 secciones grandes.

**Propuesta**:
- [ ] Mover `SesionAgrupada` y `EstadisticasPaciente` a `pacientes/data-access/paciente-detail.types.ts`.
- [ ] Mover lógica de agregación a métodos de `CumplimientoService` y `MetricasPacientesService`.
- [ ] Crear `<paciente-header>` (avatar + datos + acciones).
- [ ] Crear `<paciente-estadisticas>` (KPIs + gráfico adherencia).
- [ ] Crear `<paciente-sesiones-list>` (sesiones agrupadas).
- [ ] Crear `<paciente-comentarios-panel>`.
- [ ] Romper acoplamiento `pacientes → planes/PlanBuilderService` vía evento.

**Archivos afectados**: `paciente-detail.component.ts`/`.html` + 4 subcomponentes nuevos en `pacientes/components/paciente-detail/` + `cumplimiento.service.ts` + `metricas-pacientes.service.ts` + nuevo `paciente-detail.types.ts`.

**Esfuerzo**: L (3–4 días) · **Impacto**: 🟡 · **Riesgo**: 🟡

**Prioridad**: P1

---

## [ ] 1.5 — Separar modo rutina de `plan-builder.service.ts` (929 LOC)

**Ubicación**: `apps/app/src/app/features/planes/data-access/`

**Problema**:
- Maneja DOS dominios distintos en el mismo servicio (modo plan + modo rutina).
- Persistencia duplicada (`kengo:plan_builder:v1:` vs `kengo:rutina_builder:v1:`).
- Inyecta servicios de 5 features distintas (acoplamiento alto).

**Propuesta**:
- [ ] Crear `RutinaBuilderService` (rutinas/data-access/) — solo modo rutina.
- [ ] Crear `BuilderItemsService` común (items, addItem, removeItem, drag-drop, currentVersion, hasActivity).
- [ ] Crear `BuilderPersistenceStore<TState>` con TTL (clase parametrizable).
- [ ] Reducir `PlanBuilderService` a solo modo plan (paciente, fechas).
- [ ] `rutina-builder.component` consume `RutinaBuilderService` (deja de depender de `PlanBuilderService`).
- [ ] Migrar borradores existentes en localStorage (validar que clave antigua aún se hidrata o se descarta limpiamente).

**Archivos afectados**: `plan-builder.service.ts` (refactor masivo), nuevos `builder-items.service.ts`, `builder-persistence.store.ts`, `rutinas/data-access/rutina-builder.service.ts`. `plan-builder.component.ts` y `rutina-builder.component.ts` cambian inyección.

**Esfuerzo**: L (4–5 días) · **Impacto**: 🔴 · **Riesgo**: 🔴

**Prioridad**: P1

---

## [x] 1.6 — Partir `registro-sesion.service.ts` (705 LOC) en 3 servicios ✅

**Ubicación**: `apps/app/src/app/features/sesion/data-access/`

**Problema**: único servicio para toda la sesión activa. Combina estado, modo multi-plan, temporizador, persistencia y cálculos de progreso.

**Propuesta**:
- [x] Crear `SesionStateService` (640 LOC) — estado, computeds y acciones. Inyecta los dos siguientes.
- [x] Crear `SesionTemporizadorService` (28 LOC) — `tiempoRestante`, `temporizadorActivo`, `descansoEntreEjercicios` + métodos `iniciarDescanso`, `agregarTiempo`, `detener`, `reset`.
- [x] Crear `SesionPersistenceService` (49 LOC) — `guardar`/`restaurar`/`limpiar` con TTL 24h sobre clave `kengo:sesion_activa:v1`.
- [x] Decisión: modo multi-plan permanece dentro de `SesionStateService` (es solo un flag + 2 signals; no merece servicio aparte).
- [x] Eliminar `registro-sesion.service.ts` y migrar 11 consumidores (8 en sesion/ + 3 en actividad/).
- [ ] Validar hidratación de borradores existentes (`kengo:sesion_activa:v1`). ⚠️ Pendiente prueba manual: misma clave y formato, debería ser transparente.

**Archivos afectados**: `registro-sesion.service.ts` (eliminar) + 3 nuevos en `sesion/data-access/` + todos los componentes de la feature `sesion` cambian inyección.

**Esfuerzo**: M (2–3 días) · **Impacto**: 🔴 · **Riesgo**: 🔴

**Prioridad**: **P0** — precondición de #1.1, #1.2, #1.3.

---

## [x] 1.7 — Extraer plantillas inline a archivos `.html` y `.css` (PR-1) ✅

**Problema**: los 3 god-components de `sesion` (`feedback-final`, `ejercicio-activo`, `descanso`) tienen `template` y `styles` inline. Esto distorsiona el conteo de LOC del `.ts` e impide reducir el componente sin tocar la presentación.

**Propuesta**:
- [x] `feedback-final.component.ts`: extraer `template` → `feedback-final.component.html`, `styles` → `feedback-final.component.css`. Resultado: **1272 → 218 LOC**.
- [x] `ejercicio-activo.component.ts`: ídem. Resultado: **1187 → 166 LOC**.
- [x] `descanso.component.ts`: ídem. Resultado: **882 → 108 LOC**.
- [x] Verificar que cada componente compila. ✅ `npm run build` correcto.
- [ ] Verificar visual y funcionalmente cada pantalla en navegador (pasar por las 3 pantallas en una sesión real). ⚠️ Pendiente de prueba manual.
- [x] `npm run lint` y `npm run build` sin **nuevos** warnings/errores. ✅ Errores de lint preexistentes (accesibilidad y `any`); build OK.

**Esfuerzo**: S (½ día por componente, ~1.5 días total) · **Impacto**: 🟢 (mecánico) · **Riesgo**: 🟢

**Prioridad**: **P0** — PR-1, en curso.

---

# SECCIÓN 2 — Duplicación cross-feature

## [ ] 2.1 — `FilteredListService<T>` base
`ejercicios.service`, `rutinas.service`, `planes.service` replican signal+computed (~50 LOC cada uno). Crear servicio base o factory `createFilteredList()`. **Esfuerzo**: M · **Impacto**: 🟡 · **Prioridad**: P2.

## [ ] 2.2 — Mappers Convex → Domain
Cada servicio mapea `_id`/`_creationTime` a su modo. Extraer helpers a `shared/utils/convex-mappers.ts`. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [ ] 2.3 — Pipe `formatDate`
`formatDate()` repetido en 6 componentes. Crear `shared/pipes/format-date.pipe.ts`. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [ ] 2.4 — `EmptyStateComponent`
5+ componentes con vacíos manuales. Crear `<app-empty-state>` en `shared/ui/`. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [ ] 2.5 — `useResponsive()` composable
3+ componentes con `BreakpointObserver` inline. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [ ] 2.6 — `common-validators.ts`
Validators de email/password inline en 5+ formularios. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P3.

> **Positivo**: no se detectaron imports cruzados entre features (excepto `pacientes → planes/PlanBuilderService`, cubierto por #1.5).

---

# SECCIÓN 3 — Reestructuración de rutas

## [ ] 3.1 — Mover rutas top-level de `planes`/`rutinas`/`sesion` a `*.routes.ts`
`app.routes.ts` reduciría de ~185 a ~80 LOC. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [ ] 3.2 — `unsavedChangesGuard` en `/rutinas/:id/editar`
El builder de rutinas tiene el mismo riesgo que el de planes. **Esfuerzo**: S · **Impacto**: 🟡 · **Prioridad**: **P1**.

## [ ] 3.3 — Revisar guard de rol en `/planes` (list)
Solo `AuthGuard`: cualquier autenticado ve el listado. Verificar si es intencional. **Esfuerzo**: S · **Impacto**: 🟡 · **Prioridad**: **P1**.

## [ ] 3.4 — Asimetría `galeria/rutinas` ↔ `/rutinas/nueva`
Listado y creación en niveles distintos. Decidir camino canónico. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P3.

## [ ] 3.5 — Naming singular/plural inconsistente
Documentar convención posesiva (`mi-`/`mis-`) y dejar como está si es intencional. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P3.

## [ ] 3.6 — Lazy de `InicioFisio`/`InicioPaciente`
`/inicio` carga ambos con `*ngIf`. Evaluar si separar en rutas con redirección por rol. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P3.

---

# SECCIÓN 4 — Otras mejoras puntuales

## [ ] 4.1 — Templates HTML grandes (no críticos)
`planes.component.html` (697), `plan-builder.component.html` (661), `ejercicios-list.component.html` (557), `rutinas-list.component.html` (450), `rutina-builder.component.html` (412). Tocar solo si se va a modificar funcionalidad. **Prioridad**: P3.

## [ ] 4.2 — Feature `galeria` es solo router-dispatcher
Decidir: dejar como agrupador semántico vs eliminar. **Prioridad**: P3.

## [ ] 4.3 — `perfil.component.ts` (497 LOC)
Cerca del umbral. Vigilar; descomponer si crece. **Prioridad**: P3.

---

# Verificación (aplica a todos los refactors)

- [ ] `npm run build` o `nx build app` sin errores TS.
- [ ] `npm run lint` sin nuevos warnings.
- [ ] Suite de tests existente pasa.
- [ ] Verificación manual obligatoria en navegador para cambios en `sesion`:
  - Iniciar sesión con plan, completar 1 ejercicio, descansar, completar todos, abrir feedback final.
  - Probar modo simple y detallado del feedback.
  - Probar gestos expandir/contraer video (mobile + desktop).
  - Probar reanudación: cerrar pestaña a mitad, reabrir, validar hidratación.
- [ ] Verificación manual `paciente-detail` (#1.4): paciente con sesiones, comentarios y plan asignado.
- [ ] Verificación manual `plan-builder`/`rutina-builder` (#1.5): crear, editar, drawer, recargar (persiste).
- [ ] Ejecutar `/verify` antes de cada commit (definido en CLAUDE.md raíz).

---

# Archivos clave referenciados

```
apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/
├── feedback-final/feedback-final.component.ts          (1272 LOC) #1.1
├── ejercicio-activo/ejercicio-activo.component.ts      (1187 LOC) #1.2
└── descanso/descanso.component.ts                      ( 882 LOC) #1.3

apps/app/src/app/features/sesion/data-access/
└── registro-sesion.service.ts                          ( 705 LOC) #1.6

apps/app/src/app/features/pacientes/pages/paciente-detail/
└── paciente-detail.component.ts                        ( 821 LOC) #1.4

apps/app/src/app/features/planes/data-access/
└── plan-builder.service.ts                             ( 929 LOC) #1.5

apps/app/src/app/app.routes.ts                          (rutas)    #3.1, #3.2, #3.3
```
