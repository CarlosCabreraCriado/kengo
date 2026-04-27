# Auditoría Frontend Kengo — apps/app/

> **Documento destino**: `docs/AUDITORIA_FRONTEND.md` (mismo contenido).
> **Fecha**: 2026-04-27 (creado) · 2026-04-28 (última actualización)
> **Estado**: Todos los items **P0/P1/P2 cerrados**. Sólo quedan ítems P3 (opcionales).
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
| [x] | 1 | Descomponer `feedback-final.component` (1272 LOC) | sesion | L | 🔴 | 🟡 | **P0** (PR-3) ✅ |
| [x] | 2 | Descomponer `ejercicio-activo.component` (1187 LOC) | sesion | L | 🔴 | 🔴 | **P0** (PR-4) ✅ |
| [x] | 3 | Descomponer `descanso.component` (882 LOC) | sesion | M | 🟡 | 🟡 | P1 (PR-4) ✅ |
| [x] | 4 | Partir `registro-sesion.service` (705 LOC) en 3 servicios | sesion | M | 🔴 | 🔴 | **P0** (PR-2) ✅ |
| [x] | 5 | Extraer modo rutina de `plan-builder.service` (929 LOC) | planes | L | 🔴 | 🔴 | P1 (PR-5) ✅ |
| [x] | 6 | Descomponer `paciente-detail.component` (821 LOC) | pacientes | L | 🟡 | 🟡 | P1 (PR-Paciente) ✅ |
| [x] | 7 | Mover plantilla inline de god-components a `.html`/`.css` | sesion | S | 🟢 | 🟢 | **P0** (PR-1) ✅ |
| [x] | 8 | `EmptyStateComponent` + pipe `formatDate` | shared | S | 🟢 | 🟢 | P2 (PR-Shared) ✅ |
| [x] | 9 | `FilteredListService<T>` base (filtrado+paginación) | core | M | 🟡 | 🟡 | P2 (PR-6) ✅ |
| [x] | 10 | Mover rutas de `planes`, `rutinas`, `sesion` a `*.routes.ts` | rutas | S | 🟢 | 🟢 | P2 (PR-Shared) ✅ |
| [x] | 11 | Aplicar `unsavedChangesGuard` a `rutina-builder` | rutas | S | 🟡 | 🟢 | P1 (PR-Routes) ✅ |
| [x] | 12 | Revisar guard de rol en `/planes` (list) | rutas | S | 🟡 | 🟡 | P1 (PR-Routes) ✅ |
| [ ] | 13 | Unificar simetría `/galeria/rutinas` ↔ creación de rutinas | rutas | S | 🟢 | 🟢 | P3 |
| [x] | 14 | Composable `useResponsive()` | shared | S | 🟡 | 🟢 | P2 (PR-4) ✅ |

### Plan de ejecución por PRs

- [x] **PR-1 (S)** — Extraer plantillas inline (#7) ✅ **COMPLETADO**
- [x] **PR-2 (M)** — Partir `registro-sesion.service` (#4) ✅ **COMPLETADO**
- [x] **PR-3 (L)** — Descomponer `feedback-final` (#1) ✅ **COMPLETADO**
- [x] **PR-4 (L)** — Descomponer `ejercicio-activo` + `descanso` (#2 + #3) ✅ **COMPLETADO**
- [x] **PR-5 (L)** — Separar `plan-builder.service` (#5) ✅ **COMPLETADO** (PR-5a + PR-5b + PR-5c).
- [x] **PR-Routes (S)** — `unsavedChangesGuard` rutinas + guard `/planes` (#11 + #12) ✅ **COMPLETADO**
- [x] **PR-Paciente (L)** — Descomponer `paciente-detail` (#6) ✅ **COMPLETADO** (PR-Paciente-1 + PR-Paciente-2)
- [x] **PR-Shared (M)** — `convex-mappers` + `FormatDatePipe` + `EmptyStateComponent` + split de rutas (#2.2 + #2.3 + #2.4 + #3.1) ✅ **COMPLETADO**
- [x] **PR-6 (M)** — factory `createFilteredList<T>` + migración de 3 servicios (#2.1) ✅ **COMPLETADO**

> **Backlog P0–P2 cerrado**. Los items restantes (sección 2.6, 3.4–3.6, 4.1–4.3) son P3 (opcionales) y deben atacarse oportunísticamente cuando se toque el código afectado.

---

# SECCIÓN 1 — God components (prioridad alta)

## [x] 1.1 — Descomponer `feedback-final.component.ts` (PR-3) ✅

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/feedback-final/`

**Problema (resuelto)**:
- Plantilla inline + animaciones + lógica de feedback dual (modo simple/detallado) + confetti + escala global y por ejercicio + observaciones.
- Mezcla 4 responsabilidades.

**Resultado**:
- [x] Extraer plantilla y CSS a archivos separados (cubierto por #7).
- [x] Crear `<app-feedback-celebracion>` (confetti + header animado + progress ring).
- [x] Crear `<app-feedback-global-form>` (dolor único + observaciones).
- [x] Crear `<app-feedback-detallado-form>` (lista de `EscalaDolor` por ejercicio).
- [x] Convertir `feedback-final.component` en contenedor que orquesta modos y emite `(enviarFeedback)`.
- [x] Mover keyframes de confetti a `feedback-celebracion.component.css` (junto al markup que los usa).
- [x] Bonus: eliminar `componentes/contador-series/` huérfano.

**LOC final**:
- Contenedor `feedback-final`: 218 → **189** TS · 235 → **71** HTML · 817 → **295** CSS.
- 3 subcomponentes nuevos: `feedback-celebracion` (29/52/204), `feedback-global-form` (35/37/168), `feedback-detallado-form` (70/87/289).

**Archivos afectados**: `feedback-final.component.{ts,html,css}` + 3 subcomponentes en `componentes/feedback/`. Eliminado `componentes/contador-series/`.

**Esfuerzo**: L (3–4 días) · **Impacto**: 🔴 · **Riesgo**: 🟡 (animaciones delicadas, requiere prueba visual)

**Prioridad**: **P0** ✅ — entregado como PR-3.

---

## [x] 1.2 — Descomponer `ejercicio-activo.component.ts` (PR-4) ✅

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/ejercicio-activo/`

**Problema (resuelto)**:
- Plantilla inline con video player + header flotante + panel info + timeline.
- Gestos manuales (`wheel`, `touchstart`, `touchend`) inline.
- `BreakpointObserver` inline.
- `@ViewChild('videoPlayer')` con manipulación imperativa del `<video>`.

**Resultado**:
- [x] Extraer plantilla y CSS (cubierto por #7).
- [x] Crear `<app-ejercicio-video-player>` (video + poster + placeholder + indicador play/pause). Estado `videoReproduciendo`/`showPlayIndicator` y `@ViewChild` del `<video>` quedan **encapsulados** dentro del subcomponente; el contenedor sólo recibe `playStateChange` y dispara `toggle()` por método público.
- [x] Crear `<app-sesion-progress-header>` (índice + barra) con variantes `plain`/`overlay`, **reutilizado en `descanso`**.
- [x] Crear `<app-ejercicio-info-panel>` (nombre, stats-row, info-cards, timeline desktop, actions-bar).
- [x] Reemplazar `BreakpointObserver` inline por `useResponsive()` (#14).
- [x] Extraer directiva `appSwipeGestures` que unifica `wheel`+`touchstart`+`touchend` en un único output `swipe: 'up' | 'down'`.

**LOC final**:
- Contenedor `ejercicio-activo`: 1185 → **221** total (107 TS · 45 HTML · 69 CSS), -81%.
- Subcomponentes nuevos: `sesion-progress-header` (30/16/176), `ejercicio-video-player` (48/32/85), `ejercicio-info-panel` (48/132/518).

**Archivos afectados**:
- `ejercicio-activo.component.{ts,html,css}` (refactor profundo).
- Nuevos: `componentes/sesion-progress-header/`, `componentes/ejercicio-activo-piezas/ejercicio-video-player/`, `componentes/ejercicio-activo-piezas/ejercicio-info-panel/`.
- Nuevos en `shared/`: `composables/use-responsive.ts`, `directives/swipe-gestures.directive.ts`.

**Esfuerzo**: L (4–5 días) · **Impacto**: 🔴 · **Riesgo**: 🔴 (componente más usado del producto)

**Prioridad**: **P0** ✅ — entregado como PR-4.

---

## [x] 1.3 — Descomponer `descanso.component.ts` (PR-4) ✅

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/descanso/`

**Resultado**:
- [x] Extraer plantilla y CSS (cubierto por #7).
- [x] Reutilizar `<app-sesion-progress-header>` (variante `plain`) — header común con `ejercicio-activo`.
- [x] Crear `<app-descanso-respiracion>` (timer + breath ring + indicador inhale/exhale). El `setInterval` de respiración queda encapsulado con `DestroyRef.onDestroy` para cleanup automático.
- [x] Crear `<app-descanso-proximo>` (card próximo ejercicio o próxima serie según contexto).
- Decisión: las transiciones `descansoEntreEjercicios` vs `descansoEntreSeries` **ya estaban** en `SesionStateService` (resueltas por PR-2); no fue necesaria mover lógica.

**LOC final**:
- Contenedor `descanso`: 880 → **401** total (79 TS · 51 HTML · 271 CSS), -54%.
- Subcomponentes nuevos: `descanso-respiracion` (55/18/165), `descanso-proximo` (21/44/127).

**Archivos afectados**: `descanso.component.{ts,html,css}` + 2 subcomponentes en `componentes/descanso-piezas/` + reutiliza `componentes/sesion-progress-header/` (compartido con `ejercicio-activo`).

**Esfuerzo**: M (2 días) · **Impacto**: 🟡 · **Riesgo**: 🟡

**Prioridad**: P1 ✅ — entregado como parte de PR-4.

---

## [x] 1.4 — Descomponer `paciente-detail.component.ts` (PR-Paciente) ✅

**Ubicación**: `apps/app/src/app/features/pacientes/pages/paciente-detail/`

**Resultado**:
- [x] Tipos extraídos a `pacientes/data-access/paciente-detail.types.ts`: `ComentarioSesion`, `SesionAgrupada` (enriquecida con `tieneObservacionSesion`), `EstadisticasPaciente`, `RangoFiltro`.
- [x] Lógica de agregación movida a `CumplimientoService`: `buildSesionesAgrupadas`, `buildEstadisticas`, `enriquecerSesionesConNotificaciones`, más helpers privados (`agruparRegistrosPorFecha`, `calcularRachaCumplimiento`, `calcularAdherenciaSemanalCumplimiento`, `formatearFecha`).
- [x] **5 subcomponentes** en `paciente-detail/componentes/`:
  - `<app-paciente-hero-card>` (avatar + datos + acciones)
  - `<app-paciente-actividad-reciente>` (sesiones agrupadas con expansión de comentarios)
  - `<app-paciente-estadisticas>` (KPIs + filtros temporales + adherencia semanal)
  - `<app-paciente-comentarios-panel>` (alertas tipo comentario)
  - `<app-paciente-planes-list>` (listado de planes + crear plan)
- [x] Helpers puros compartidos en `pacientes/utils/format-helpers.ts`: `getDolorColor`, `getTipoIcon`, `getTipoColor`, `getPlanStatusClass`, `formatearFecha`, `formatearFechaComentario`.
- [x] Cross-state sesiones↔comentarios resuelto: `sesionesEnriquecidas` (computed) combina ambas fuentes; `notificacionesPorRegistro` (computed) actúa como index para que `actividad-reciente` resuelva "marcar como leído" sin conocer la lista global.
- [x] `BreakpointObserver` inline migrado a `useResponsive()`.
- [x] `avatarUrl`, `fullName`, `clinicaNombre` convertidos a `computed()` (reactivos al resource async de clínicas).
- [x] Eliminadas flags `*Expanded` del padre (cada subcomponente las gestiona internamente).
- [x] Acoplamiento `pacientes → planes/PlanBuilderService` aceptado: `crearPlan()` sigue llamando `cambiarPaciente()` desde el contenedor reducido. Documentado como follow-up.

**LOC final**:
- Contenedor `paciente-detail`: 821 → **573** TS · 791 → **147** HTML · 1276 → **284** CSS (-65% total).
- Subcomponentes: ~50-180 LOC TS cada uno, con CSS y HTML separados.

**Archivos afectados**:
- Nuevos: `pacientes/data-access/paciente-detail.types.ts`, `pacientes/utils/format-helpers.ts`, 5 carpetas `paciente-detail/componentes/{nombre}/`.
- Modificados: `paciente-detail.component.{ts,html,css}`, `pacientes/data-access/cumplimiento.service.ts`.

**Fuera de scope (issues separados)**: refactor `PlanBuilderService.cambiarPaciente()` para separar `prepareForPaciente()` de `navigate+openDrawer` (afecta 4 callsites); tests unitarios de los nuevos métodos puros y subcomponentes.

**Esfuerzo**: L · **Impacto**: 🟡 · **Riesgo**: 🟡

**Prioridad**: P1 ✅ — entregado como PR-Paciente (PR-Paciente-1 servicios + tipos, PR-Paciente-2 subcomponentes).

---

## [x] 1.5 — Separar modo rutina de `plan-builder.service.ts` (PR-5) ✅

**Ubicación**: `apps/app/src/app/features/planes/data-access/`

**Resultado**:
- [x] Crear `RutinaBuilderService` (`rutinas/data-access/rutina-builder.service.ts`) — solo modo rutina. Encapsula su `BuilderItemsState` + `BuilderPersistence<PersistedRutinaStateV1>` y su propio `effect()` de auto-save.
- [x] Crear `BuilderItemsState` (clase TS plain en `planes/data-access/internal/`) — items + drawer state común. Cada builder service la instancia con `new` para evitar singleton compartido.
- [x] Crear `BuilderPersistence<TState>` (clase TS genérica con `prefix`/`ttlDays`/`schemaVersion`/`makeKey`) — encapsula serialización/expiración/versionado.
- [x] Reducir `PlanBuilderService` a solo modo plan (paciente, fechas, versionado, dirty tracking). Mantiene `loadFromRutina` y `saveAsRutina` (flujos plan que consumen rutinas).
- [x] `rutina-builder.component` consume `RutinaBuilderService` (deja de depender de `PlanBuilderService`).
- [x] Migrar consumidores mixtos (`carrito-ejercicios`, `rutinas-list`, `ejercicio-detail`) a inyectar el servicio adecuado según contexto.
- [x] **Fix Riesgo 1**: guard `if (this.items().length === 0) return;` en `scheduleSave` evita guardados espurios cuando `ejercicio-detail` llama `paciente.set(p)` sin items aún.
- [x] **Fix Riesgo 2**: `carrito-ejercicios.ngAfterViewInit` ahora llama `rutinaSvc.tryRestore()` primero y solo invoca `planSvc.tryRestoreFor(...)` si el modo rutina no está activo. Fixea bug preexistente donde recargar `/galeria/ejercicios` con rutina en curso pisaba los items con los del último plan cacheado.
- [x] Borradores existentes en localStorage: claves y formato intactos (`kengo:plan_builder:v1:` y `kengo:rutina_builder:v1:`) — migración transparente. ⚠️ Pendiente prueba manual.

**LOC final**:
- `plan-builder.service.ts`: 929 → **683** LOC (-27%).
- Nuevos: `rutina-builder.service.ts` (334), `builder-items-state.ts` (92), `builder-persistence.ts` (89).

**Archivos afectados**:
- Nuevos: `planes/data-access/internal/builder-items-state.ts`, `planes/data-access/internal/builder-persistence.ts`, `rutinas/data-access/rutina-builder.service.ts`.
- Modificados: `planes/data-access/plan-builder.service.ts`, `rutinas/pages/rutina-builder/rutina-builder.component.ts`, `planes/components/carrito-ejercicios/carrito-ejercicios.{ts,html}`, `rutinas/pages/rutinas-list/rutinas-list.component.ts`, `ejercicios/pages/ejercicio-detail/ejercicio-detail.component.ts`.

**Fuera de scope (issues separados)**: `unsavedChangesGuard` para rutina-builder (#3.2), `cambiarPaciente()` mezcla estado+routing+UI, `loadFromRutina` no clonable a modo rutina (no es uso actual).

**Esfuerzo**: L (entregado en PR-5a + PR-5b + PR-5c) · **Impacto**: 🔴 · **Riesgo**: 🔴

**Prioridad**: P1 ✅ — entregado como PR-5.

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

## [x] 2.1 — `FilteredListService<T>` base (PR-6) ✅
Creado `apps/app/src/app/shared/data-access/create-filtered-list.ts` (factory `createFilteredList<T>(config)` con `source`, `searchPredicate?`, `applyDomainFilters?`, `defaultPageSize?`). Devuelve signals `busqueda`/`page`/`pageSize`, computeds `filtered`/`items`/`total`/`totalPages`, mutators `setBusqueda`/`goToPage`/`setPageSize`/`resetPage`. Cubierto por 10 tests unitarios.

Migrados `PlanesService` (búsqueda+filtroPaciente client-side, filtroEstado server-side), `RutinasService` (server-side: sin `searchPredicate`, anotaciones de tipo explícitas para romper ciclo de inferencia con `watchQuery`) y `EjerciciosService` (filtros de categoría/favoritos en `applyDomainFilters`; sort se aplica encima de `filtered()` y la paginación se hace manual sobre el sorted). Shape público de los 3 servicios intacto: cero cambios en consumidores. **Esfuerzo**: M · **Impacto**: 🟡 · **Prioridad**: P2.

## [x] 2.2 — Mappers Convex → Domain (PR-Shared) ✅
Creado `apps/app/src/app/shared/utils/convex-mappers.ts` con `mapId`, `toIsoFromCreationTime`, `mapConvexBase`. Migrados `ejercicios.service`, `rutinas.service`, `planes.service`. `sesion-state.service` usa tipos estrictos (`Id<...>` sin `_creationTime`); no se migra (no aporta abstracción). **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [x] 2.3 — Pipe `formatDate` (PR-Shared) ✅
Creados `shared/utils/format-date.ts` (función pura `formatDate(iso, variant)`) y `shared/pipes/format-date.pipe.ts` (Pipe standalone). `pacientes/utils/format-helpers.ts` re-exporta `formatearFecha`/`formatearFechaComentario` como aliases (sin romper consumidores). Migración de los ~20 componentes con métodos privados queda como follow-up oportunista (cada uno usa formato distinto: corto/largo/con weekday). **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [x] 2.4 — `EmptyStateComponent` (PR-Shared) ✅
Creado `<ui-empty-state>` en `shared/ui/empty-state/` con `icon`, `title`, `message`, `actionLabel`, `actionIcon` y output `action`. Adoptado en `planes-list` (mis-planes vacío) y `pacientes-list` (sin pacientes + filtered empty). El empty-state de `plan-builder` (con decoración circular) y los de `navegacion`/feedback se migrarán cuando se toque cada componente. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [x] 2.5 — `useResponsive()` composable (PR-4) ✅
Creado en `apps/app/src/app/shared/composables/use-responsive.ts`. Aplicado en `ejercicio-activo`. Pendiente migrar otros consumidores de `BreakpointObserver` (oportunista cuando se toquen). **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2 ✅.

## [ ] 2.6 — `common-validators.ts`
Validators de email/password inline en 5+ formularios. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P3.

> **Positivo**: no se detectaron imports cruzados problemáticos entre features. Tras PR-5 el `PlanBuilderService` tiene una sola responsabilidad y la dependencia residual `pacientes → planes/PlanBuilderService.cambiarPaciente()` (única callsite en `paciente-detail.crearPlan()`) queda aislada en el contenedor reducido. Documentado como follow-up: separar `prepareForPaciente()` de `navigate+openDrawer()`.

---

# SECCIÓN 3 — Reestructuración de rutas

## [x] 3.1 — Mover rutas top-level de `planes`/`rutinas`/`sesion` a `*.routes.ts` (PR-Shared) ✅
Creados `planes.routes.ts` y `sesion.routes.ts`; completados `auth.routes.ts` (faltaban 3 rutas), `dashboard.routes.ts` (path corregido) y `rutinas.routes.ts` (vacío → 2 rutas con guards). `app.routes.ts`: **190 → 74 LOC** (-61%). Auth queda como `...AUTH_ROUTES` spread (no hay prefijo común). Resto usa `loadChildren` con guards preservados. **Esfuerzo**: S · **Impacto**: 🟢 · **Prioridad**: P2.

## [x] 3.2 — `unsavedChangesGuard` en `/rutinas/:id/editar` (PR-Routes) ✅
**Resultado**:
- Añadido dirty tracking a `RutinaBuilderService` (`originalSnapshot`, `isDirty`, `captureSnapshot`, `markAsSaved`). Snapshot se captura tras `startEdit()` y se resetea en `start()`/`exit()`.
- Nuevo guard `rutinas/guards/rutina-unsaved-changes.guard.ts` (espejo del de planes). Permite navegación a `/galeria/ejercicios` sin warning.
- `app.routes.ts` aplica `canDeactivate: [rutinaUnsavedChangesGuard]` solo en `/rutinas/:id/editar` (la creación `/rutinas/nueva` no entra, igual que planes).
- `rutina-builder.component.guardarPlantilla` llama `markAsSaved()` tras `update()` exitoso, antes de salir, evitando que el guard dispare durante la transición.

## [x] 3.3 — Revisar guard de rol en `/planes` (list) (PR-Routes) ✅
**Resultado**: comportamiento intencional confirmado, sin cambios en código. `planes.component.ts` discrimina por rol: si `isFisio()` muestra 3 tabs (planes-pacientes / rutinas / mis-planes), si paciente muestra solo "mis-planes" cargando `getPlanesByPaciente(userId)`. Por tanto añadir `FisioGuard` rompería el flujo del paciente. Documentado con comentario inline en `app.routes.ts` para futura claridad.

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

- [x] `npm run build` o `nx build app` sin errores TS — verificado tras cada PR.
- [x] `npm run lint` sin nuevos warnings — estable en 303-304 errores preexistentes.
- [ ] Suite de tests existente pasa — no hay specs en los ficheros refactorizados; pendiente añadir cobertura post-refactor.
- [ ] Verificación manual obligatoria en navegador para cambios en `sesion`:
  - Iniciar sesión con plan, completar 1 ejercicio, descansar, completar todos, abrir feedback final.
  - Probar modo simple y detallado del feedback.
  - Probar gestos expandir/contraer video (mobile + desktop).
  - Probar reanudación: cerrar pestaña a mitad, reabrir, validar hidratación.
- [ ] Verificación manual `paciente-detail` (#1.4): paciente con sesiones, comentarios y plan asignado.
- [ ] Verificación manual `plan-builder`/`rutina-builder` (#1.5): crear, editar, drawer, recargar (persiste).
- [ ] Verificación manual `rutina-builder` con cambios sin guardar (#3.2): el guard debe disparar warning.
- [x] Ejecutar `/verify` antes de cada commit (definido en CLAUDE.md raíz).

---

# Archivos clave referenciados

**Completados (PR-1 → PR-4)**:
```
apps/app/src/app/features/sesion/pages/realizar-plan/pantallas/
├── feedback-final/                                                         #1.1 ✅ PR-3
│   ├── feedback-final.component.ts             (1272 → 189 LOC)
│   ├── feedback-final.component.html           (235 → 71 LOC)
│   └── feedback-final.component.css            (817 → 295 LOC)
├── ejercicio-activo/                                                       #1.2 ✅ PR-4
│   ├── ejercicio-activo.component.ts           (1187 → 107 LOC)
│   ├── ejercicio-activo.component.html         (248 → 45 LOC)
│   └── ejercicio-activo.component.css          (771 → 69 LOC)
└── descanso/                                                               #1.3 ✅ PR-4
    ├── descanso.component.ts                   ( 882 → 79 LOC)
    ├── descanso.component.html                 (134 → 51 LOC)
    └── descanso.component.css                  (638 → 271 LOC)

apps/app/src/app/features/sesion/pages/realizar-plan/componentes/
├── feedback/                                                               #1.1 ✅ PR-3
│   ├── feedback-celebracion/                   (29 + 52 + 204 LOC)
│   ├── feedback-global-form/                   (35 + 37 + 168 LOC)
│   └── feedback-detallado-form/                (70 + 87 + 289 LOC)
├── sesion-progress-header/                     (30 + 16 + 176 LOC)         #1.2/#1.3 ✅ PR-4 (compartido)
├── ejercicio-activo-piezas/                                                #1.2 ✅ PR-4
│   ├── ejercicio-video-player/                 (48 + 32 + 85 LOC)
│   └── ejercicio-info-panel/                   (48 + 132 + 518 LOC)
└── descanso-piezas/                                                        #1.3 ✅ PR-4
    ├── descanso-respiracion/                   (55 + 18 + 165 LOC)
    └── descanso-proximo/                       (21 + 44 + 127 LOC)

apps/app/src/app/features/sesion/data-access/                               #1.6 ✅ PR-2
├── sesion-state.service.ts                     (640 LOC)
├── sesion-temporizador.service.ts              ( 28 LOC)
└── sesion-persistence.service.ts               ( 49 LOC)

apps/app/src/app/shared/                                                    ✅ PR-4
├── composables/use-responsive.ts                                           #14 ✅
└── directives/swipe-gestures.directive.ts                                  (nuevo)

apps/app/src/app/features/planes/data-access/                               #1.5 ✅ PR-5
├── plan-builder.service.ts                             (929 → 683 LOC)
└── internal/
    ├── builder-items-state.ts                          ( 92 LOC, nuevo)
    └── builder-persistence.ts                          ( 89 LOC, nuevo)

apps/app/src/app/features/rutinas/data-access/                              #1.5 ✅ PR-5
└── rutina-builder.service.ts                           (334 → 373 LOC)

apps/app/src/app/features/rutinas/guards/                                   #3.2 ✅ PR-Routes
└── rutina-unsaved-changes.guard.ts                     ( 27 LOC, nuevo)

apps/app/src/app/app.routes.ts                                              #3.2/#3.3 ✅ PR-Routes

apps/app/src/app/features/pacientes/                                        #1.4 ✅ PR-Paciente
├── data-access/
│   ├── paciente-detail.types.ts                        ( 50 LOC, nuevo)
│   └── cumplimiento.service.ts                         (266 → 487 LOC)
├── utils/
│   └── format-helpers.ts                               ( 70 LOC, nuevo)
└── pages/paciente-detail/
    ├── paciente-detail.component.{ts,html,css}         (821/791/1276 → 573/147/284 LOC)
    └── componentes/
        ├── paciente-hero-card/                         (~25 + ~95 + ~165 LOC)
        ├── paciente-actividad-reciente/                (~70 + ~135 + ~310 LOC)
        ├── paciente-estadisticas/                      (~60 + ~165 + ~340 LOC)
        ├── paciente-comentarios-panel/                 (~50 + ~95 + ~245 LOC)
        └── paciente-planes-list/                       (~60 + ~85 + ~190 LOC)
```

**Completados (PR-Shared)**:
```
apps/app/src/app/app.routes.ts                                              #3.1 ✅ (190 → 74 LOC)
apps/app/src/app/shared/
├── pipes/format-date.pipe.ts                                               #2.3 ✅ (nuevo)
├── ui/empty-state/empty-state.component.{ts,html,css}                      #2.4 ✅ (nuevo)
└── utils/
    ├── convex-mappers.ts                                                   #2.2 ✅ (nuevo)
    └── format-date.ts                                                      #2.3 ✅ (nuevo)

apps/app/src/app/features/
├── auth/auth.routes.ts                                                     #3.1 ✅ (3 → 6 rutas)
├── dashboard/dashboard.routes.ts                                           #3.1 ✅ (path fix)
├── rutinas/rutinas.routes.ts                                               #3.1 ✅ (vacío → 2 rutas)
├── planes/planes.routes.ts                                                 #3.1 ✅ (nuevo)
├── sesion/sesion.routes.ts                                                 #3.1 ✅ (nuevo)
├── pacientes/utils/format-helpers.ts                                       #2.3 ✅ (re-export)
├── pacientes/pages/pacientes-list/pacientes-list.component.html            #2.4 ✅
├── planes/pages/planes-list/planes.component.html                          #2.4 ✅
└── data-access/                                                            #2.2 ✅
    ├── ejercicios.service.ts                                               (mapId)
    ├── rutinas.service.ts                                                  (mapConvexBase, mapId)
    └── planes.service.ts                                                   (mapConvexBase, mapId)
```

**Completados (PR-6)**:
```
apps/app/src/app/shared/data-access/                                        #2.1 ✅ PR-6
├── create-filtered-list.ts                                                 (nuevo, factory)
└── create-filtered-list.spec.ts                                            (nuevo, 10 tests)

apps/app/src/app/features/                                                  #2.1 ✅ PR-6
├── ejercicios/data-access/ejercicios.service.ts                            (consume factory)
├── rutinas/data-access/rutinas.service.ts                                  (consume factory, server-side)
└── planes/data-access/planes.service.ts                                    (consume factory)
```

**Pendientes** (sólo P3, opcionales):
```
#2.6  apps/app/src/app/shared/                          common-validators (email/password en 5+ formularios)
#3.4  apps/app/src/app/features/{galeria,rutinas}/      simetría galeria/rutinas ↔ /rutinas/nueva
#3.5  apps/app/src/app/app.routes.ts                    documentar convención singular/plural (mi-/mis-)
#3.6  apps/app/src/app/features/dashboard/              lazy InicioFisio/InicioPaciente por rol
#4.1  features/{planes,ejercicios,rutinas}/             templates HTML grandes (697/661/557/450/412 LOC)
#4.2  apps/app/src/app/features/galeria/                feature router-dispatcher: dejar o eliminar
#4.3  apps/app/src/app/features/perfil/                 perfil.component.ts (497 LOC, vigilar)
```
