# Auditoría de Performance — Kengo (Angular 20 + Convex)

> **Fecha**: 2026-06-02 · **Alcance**: `apps/app/` (frontend) + `convex/` (queries y crons) · **Excluido**: Capacitor / nativos, landing page, backend Node.
>
> Este documento es **diagnóstico**, no plan de ejecución. Cada hallazgo está catalogado por **Severidad**, **Impacto** y **Riesgo de implementación** para que puedas decidir, en sesiones futuras, qué entra en un plan concreto de optimización.

---

## 1. Resumen ejecutivo

### Estado general

Kengo está construido con un buen punto de partida en términos de performance:

- **Lazy loading riguroso**: el 100% de las features cargan vía `loadChildren` / `loadComponent`. No hay rutas eager.
- **Adopción de signals casi total**: 539 instancias de `signal()/computed()/effect()`, 0 `BehaviorSubject` en componentes/servicios, 0 `async` pipe (todo el reactivo va por signals).
- **OnPush al 93%** (145/156 componentes).
- **Sin dependencias pesadas** mal importadas: no hay `moment`, no hay Material/PrimeNG, no hay `lodash` completo. Convex como cliente único (no Firebase paralelo).
- **Subscripciones Convex bien aisladas**: `watchQuery` se desuscribe automáticamente al destruir el componente (`destroyRef.onDestroy`).
- **Métricas runtime razonables**: FCP/LCP <600 ms en `/login`, <110 ms en navegación intra-app (con caché).

Las grietas no están en la arquitectura, sino en **assets sin optimizar**, **queries Convex con patrones N+1** y **detalles de renderizado** (sin `track`, sin virtual scroll, sin `@defer`).

> **Palanca transversal añadida 2026-06-03** — Tras esta auditoría se evaluó `@convex-dev/aggregate` (ver **Bloque H** y plan de desarrollo en `~/.claude/plans/quiero-realizar-una-investigaci-n-sunny-muffin.md`). Cubre simultáneamente F6, F7, F8, parte de F3 y parte de F4, y permite eliminar `patientMetricsSnapshot` / `clinicMetricsSnapshot` reemplazando el pipeline actual de recompute on-write + cron por agregaciones transaccionales O(log n) particionadas por clínica/paciente. Las fichas afectadas llevan nota cruzada hacia el Bloque H.

### Top 5 hallazgos críticos

| # | Hallazgo | Por qué duele |
|---|----------|---------------|
| 1 | **19 MB de PNGs sin optimizar** en `assets/portadas/` (1.3-2.3 MB cada uno) y **`NgOptimizedImage` no se usa en ningún sitio**. | LCP móvil pésimo cuando se usan estas portadas (onboarding, hero). Coste fijo de descarga aunque el ServiceWorker las cachee. |
| 2 | **Bundle inicial 927.99 kB raw / 222 kB gzip** — supera el budget de 700 kB en **228 kB**. | Cold start con red 3G/4G se nota. Tres chunks (`GHEWJQFH`, `VQQ64ZC3`, `IZS4TLSW`) suman 652 kB raw. |
| 3 | **N+1 en Convex queries hot**: `dashboard.planesPorVencer` (triple loop), `plans.checkPlanHasActivity` (loop secuencial), `metricasPacientesService.getMetricasBulk` (1 query por clínica). | Dashboard del fisio se ralentiza con más fisios/planes; el envío de plan se demora innecesariamente; fisios multi-clínica esperan en serie. |
| 4 | ~~**96% de `@for` sin `track`** (55 de 57 bucles)~~. **Resuelto 2026-06-02**: 86/86 `@for` con `track`; 6 casos legítimos con `track $index` documentados y protegidos por `npm run check:track-index`. | — |
| 5 | **7 fuentes (~850 kB) cargan en `/login`**: 6 TTF (sin comprimir a WOFF2) + Material Symbols. Login solo usa 1 variante visualmente. | El login es la primera impresión del producto y descarga ~45% de su peso solo en fuentes. |

### Hoja de ruta sugerida (3 oleadas)

**Oleada 1 — Quick wins (1-2 días, alto retorno, riesgo bajo)**
- A1, A2, A3: convertir PNGs a WebP/AVIF, mover fuera de `assets/` los originales, adoptar `NgOptimizedImage`, comprimir TTF→WOFF2, recortar fuentes a las realmente usadas.
- ~~D1: añadir `track` a todos los `@for`.~~ (resuelto 2026-06-02 — ver ficha D1)
- E3, E6: añadir `takeUntilDestroyed` a las suscripciones manuales y guardar `console.*` tras `isDevMode()`.
- F2: añadir un índice Convex `by_planId` en `exerciseExecutions` y reescribir `checkPlanHasActivity` con 1 query.

**Oleada 2 — Estructural (1 semana, retorno medio-alto, riesgo medio)**
- B1: separar `package.json` por app (o mover dependencias backend a Convex / devDependencies).
- B4: hacer lazy `qrcode` y `pdfkit` mediante `await import()`.
- ~~C2: introducir `@defer` en `realizar-plan`, `paciente-detail` y `plan-builder`~~ (resuelto 2026-06-03 — ver ficha C2). `miclinica` (51 kB) y `plan-detail` (32 kB) siguen pendientes con el mismo patrón.
- D2, D3: completar OnPush al 100% empezando por `app.component.ts`; precomputar `getDolorPromedio` y similares en `computed()`.
- D4: virtualización (`cdk-virtual-scroll-viewport`) en `pacientes-list` y `ejercicios-list`.
- E1, F3, F4, F5, F6: refactorizar queries Convex N+1 con `batchGetMap` o queries específicas.

**Oleada 3 — Fondo (proyecto, retorno medio-bajo, riesgo medio-alto)**
- C1: definir e introducir `PreloadingStrategy` custom (precargar features marcadas, respetando datos móviles).
- E2, E4: query Convex de "bootstrap" para `paciente-detail` y `/inicio` que devuelva todo lo necesario en 1 ida y vuelta.
- ~~F7, F8: revisar el patrón de recompute inmediato de snapshots tras cada `execution`; evaluar mover a "marcar stale + recompute en cron diario".~~ Sustituido por la Oleada 4 (Bloque H) — el aggregate elimina el recompute en sí, no sólo lo difiere.
- F9: deduplicación de `watchQuery` con la misma firma.

**Oleada 4 — Aggregate (rediseño del pipeline de métricas, 3-4 semanas)**
- **H0-H9** (Bloque H): introducir `@convex-dev/aggregate` con namespaces por clínica/paciente, migrar `getPatientMetrics` (orden por adherencia), `getActividadDiariaClinica`, `recomputePatient`/`recomputeClinic`, `exerciseUsageRollup` y eventualmente eliminar `patientMetricsSnapshot` / `clinicMetricsSnapshot`. Habilita además "ejercicio más usado" y "top pacientes por adherencia" (H7, H8) como features nuevas casi gratis.
- Plan ejecutable: ver `~/.claude/plans/quiero-realizar-una-investigaci-n-sunny-muffin.md`.

---

## 2. Metodología

### Análisis estático

- **Inventario de componentes/servicios** con `find` + `grep` sobre `apps/app/src/`.
- **Lectura puntual** de archivos clave (queries Convex, servicios de data-access, componentes pesados) para confirmar líneas exactas.
- **Cobertura**:
  - 156 componentes (.component.ts)
  - 275 archivos TypeScript en `apps/app/src/`
  - Carpeta `convex/` completa: schema, queries, mutations, crons, internals

### Mediciones reales

1. **Build de producción** ejecutado con `npx nx build app --configuration=production --statsJson` → `dist/apps/app/browser/`.
2. **Servido localmente** con `http-server -p 4200 -c-1` (sin compresión gzip extra, así que los tamaños "raw" son los publicados sin compresión).
3. **Navegación con Playwright (Chrome headless)**:
   - `/login` — primera carga real (sin caché)
   - Login con credenciales reales
   - `/inicio/fisio` → `/mis-pacientes` → `/ejercicios` (con caché del SW)
   - Métricas capturadas vía `PerformanceObserver` para LCP, CLS, long tasks, y `performance.getEntriesByType('resource')` para peso/contadores.
4. **Limitación**: las métricas de transfer en navegación intra-app son 0 porque el ServiceWorker está sirviendo desde caché. Los tamaños fiables son los del **build stats** (sección 3.1).

### Sistema de scoring

- **Severidad** — qué tan roto está:
  - `Crítica` — afecta a usuarios en uso normal hoy.
  - `Alta` — escala mal con datos (rompe cuando hay 100+ pacientes/ejercicios/fisios).
  - `Media` — coste invisible pero acumulable (memoria, tráfico, frame budget).
  - `Baja` — cosmético o coste residual.
- **Impacto** — qué se gana al arreglarlo:
  - `Alto` — mejora medible en LCP/INP/peso (>20%).
  - `Medio` — mejora puntual en una pantalla o flujo.
  - `Bajo` — higiene técnica sin métrica visible.
- **Riesgo de implementación** — probabilidad de romper algo:
  - `Bajo` — cambio aislado, fácil de revertir.
  - `Medio` — toca arquitectura local o varios componentes.
  - `Alto` — afecta a flujos críticos (auth, sesión, mutaciones).
- **Esfuerzo** — estimación gruesa en t-shirt size:
  - `S` ≤ 1 día · `M` 1-3 días · `L` >3 días.

---

## 3. Mediciones de referencia (baseline)

### 3.1 Build de producción

```
Total: 8.2 s · Output: dist/apps/app/browser/
Budget initial: WARN 700 kB / ERROR 2 MB
Resultado: ⚠️ initial bundle 927.99 kB — supera WARN en 227.99 kB
```

**Initial chunks (raw / estimated gzip transfer):**

| Chunk | Raw | Gz | Notas |
|-------|-----|----|----|
| `chunk-GHEWJQFH.js` | 250.43 kB | 44.50 kB | Top chunk inicial — candidato a inspección con source-map-explorer |
| `chunk-VQQ64ZC3.js` | 242.76 kB | 62.10 kB | 2º chunk inicial — probable Convex client |
| `chunk-IZS4TLSW.js` | 159.28 kB | 47.38 kB | 3er chunk inicial |
| `chunk-CMLPHS73.js` | 77.23 kB | 19.90 kB | |
| `styles-QWLZV3QS.css` | 64.76 kB | 9.39 kB | CSS global (Tailwind + custom) |
| `main-RM2PA7AN.js` | 48.49 kB | 12.34 kB | Bootstrap Angular |
| `polyfills-5CFQRCPP.js` | 34.59 kB | 11.33 kB | zone.js |
| Otros chunks pequeños | ~50 kB | ~14 kB | |
| **Total initial** | **927.99 kB** | **222.15 kB** | |

**Lazy chunks más pesados (top 10):**

| Chunk | Raw | Feature |
|-------|-----|---------|
| `chunk-FIWPL4ZB.js` | 108.44 kB | `realizar-plan` (sesión de ejercicio) |
| `chunk-X25Z443N.js` | 101.19 kB | `paciente-detail` |
| `chunk-3RT32554.js` | 66.97 kB | — |
| `chunk-YQQNEFVR.js` | 64.27 kB | `browser` |
| `chunk-KW3Q5WRA.js` | 57.77 kB | — |
| `chunk-A5NPNKGK.js` | 51.02 kB | `miclinica` |
| `chunk-SJD4UJ2D.js` | 47.38 kB | `web` |
| `chunk-T5DTJ3N4.js` | 34.07 kB | `plan-builder` |
| `chunk-4PL6RQCC.js` | 33.82 kB | `suscripcion` |
| `chunk-SKL2P6XZ.js` | 32.41 kB | `plan-detail` |

Total de chunks lazy: **86** (incluyendo 71 pequeños sin nombre asignado).

### 3.2 Métricas runtime (Chrome headless, conexión local)

**`/login` (primera carga, sin caché):**

| Métrica | Valor | Threshold "Good" |
|---------|-------|------------------|
| TTFB | 2 ms | <800 ms ✅ |
| First Paint | 256 ms | — |
| FCP | 508 ms | <1800 ms ✅ |
| **LCP** | **508 ms** | <2500 ms ✅ (elemento: `H1.ui2-big-title__title`) |
| **CLS** | **0.0011** | <0.1 ✅ |
| Long tasks | 0 | <50 ms acumulado ✅ |
| Recursos descargados | 38 | — |
| Total transfer | 1.89 MB | — |
| JS | 974 kB (24 archivos) | — |
| Fuentes | **850 kB** (7 archivos: 6 TTF + 1 WOFF2) | — |
| CSS | 65 kB (1 archivo) | — |
| Imágenes | 27 kB (2 WebP) | — |

> **Observación**: el 45% del peso de `/login` son fuentes. Material Symbols solo (319 kB WOFF2) ya pesa más que todo el CSS.

**`/mis-pacientes` (con caché del SW, post-login):**

| Métrica | Valor |
|---------|-------|
| TTFB | 37 ms |
| FCP | 92 ms |
| LCP | 104 ms (elemento `A`) |
| CLS | 0.0424 |
| Long tasks | 0 |
| DOM nodes | ~520 |

> **CLS** algo más alto que en login (0.04 vs 0.001) — el header de fisio y la lista cargan en pasos. Aún dentro del threshold "Good" (<0.1) pero con margen para mejora.

**`/ejercicios`:**

| Métrica | Valor |
|---------|-------|
| FCP | 64 ms |
| DOM nodes | 516 |
| Nodos tipo lista | 165 |
| Imágenes (thumbnails) | 29 (26 kB total, ~900 bytes cada una con `width=96&height=96`) |

> **Imágenes excelentes** con miniaturas servidas por Convex/R2 (`assetUrl(id, { fit: 'cover', width: 96, height: 96 })` en `pacientes-list.component.ts:275`). Esto demuestra que el patrón existe — solo falta extenderlo a las portadas estáticas (hallazgo A1).

---

## 4. Tabla maestra de hallazgos

| # | Hallazgo | Área | Severidad | Impacto | Riesgo | Esfuerzo |
|---|----------|------|-----------|---------|--------|----------|
| **A1** | 19 MB en `assets/portadas/` sin optimizar (PNG 1.3-2.3 MB) | Assets | Crítica | Alto | Bajo | S |
| **A2** | `NgOptimizedImage` no se usa en ninguna parte | Assets | Alta | Alto | Bajo | M |
| **A3** | 6 fuentes en TTF (no WOFF2) y solo 2 preloaded | Assets | Alta | Medio | Bajo | S |
| **A4** | Vídeo del player de sesión con `autoplay` sin `preload="none"` | Assets | Media | Medio | Bajo | S |
| **A5** | Material Symbols (~319 kB) servido desde Google Fonts CDN | Assets | Media | Medio | Bajo | S |
| **B1** | Dependencias de backend en el `package.json` raíz | Bundle | Media | Medio | Medio | M |
| **B2** | Tailwind sin `content` explícito (default v4) | Bundle | Baja | Medio | Bajo | S |
| **B3** | Initial bundle 927 kB > budget 700 kB | Bundle | Media | Medio | Bajo | S |
| **B4** | ~~`qrcode` y `pdfkit` no son lazy~~ → resuelto (`qrcode` y `GestionAccesoDialogComponent` lazy; `pdfkit` no estaba en bundle) | Bundle | ✅ Resuelto | — | — | — |
| **C1** | Sin `PreloadingStrategy` configurada | Routing | Media | Medio | Medio | M |
| **C2** | ~~Cero `@defer` blocks en páginas pesadas~~ → resuelto para `realizar-plan` (−52%), `paciente-detail` (−35%) y `plan-builder` (CDK DragDrop extraído ~57 kB) | Routing | ✅ Resuelto (parcial) | — | — | — |
| **C3** | Hidratación bloqueante en constructor de `SessionService` | Routing | Baja | Bajo | Bajo | S |
| **D1** | ~~~96% de `@for` sin `track`~~ → resuelto (86/86 con `track`) | Render | ✅ Resuelto | — | — | — |
| **D2** | 11 componentes sin `OnPush` (incluido `AppComponent` raíz) | Render | Media | Medio | Bajo-Medio | M |
| **D3** | Métodos invocados desde template dentro de `@for` | Render | Media | Medio | Bajo | S |
| **D4** | Sin virtualización en listas grandes | Render | Alta | Alto | Medio | M |
| **D5** | `patient-sidebar.component.ts` con 1068 líneas | Mantenib. | Baja | Bajo | Medio | L |
| **E1** | N+1 secuencial en `metricasPacientesService.getMetricasBulk` | Data | Alta | Alto | Medio | M |
| **E2** | `paciente-detail` dispara 6 cargas paralelas sin batching | Data | Media | Medio | Medio | M |
| **E3** | Subscripciones manuales sin `takeUntilDestroyed` | Data | Media | Bajo | Bajo | S |
| **E4** | Sin batching de queries iniciales tras login | Data | Media | Medio | Medio | M |
| **E5** | `fetch` directo en auth sin timeout ni retry | Data | Baja | Bajo | Bajo | S |
| **E6** | `console.log/.error/.warn` sin guard `isDevMode()` | Data | Baja | Bajo | Bajo | S |
| **F1** | `exercises.listExercises` hace `.collect()` de toda la tabla `exerciseCategories` y `categories` | Convex | Crítica | Alto | Medio | M |
| **F2** | N+1 en `plans.checkPlanHasActivity` | Convex | Alta | Alto | Bajo | S |
| **F3** | Triple N+1 en `dashboard.planesPorVencer` | Convex | Alta | Alto | Medio | M |
| **F4** | N+1 en `executions.listByPacienteAndDateExpanded` | Convex | Media | Medio | Bajo | S |
| **F5** | `users.me` y `routines.enrichRoutineExercises`: gets en loop | Convex | Media | Medio | Bajo | S |
| **F6** | `plans.listEnCursoPacientesInClinics`: Promise.all de queries por pacienteId | Convex | Media | Medio | Bajo | M |
| **F7** | Recompute inmediato de snapshots tras cada `execution` | Convex | Media | Medio | Medio | M |
| **F8** | Crons con loops secuenciales pesados (`recomputeAllPatients`, `recomputeAllClinics`) | Convex | Media | Bajo | Medio | M |
| **F9** | Sin deduplicación de `watchQuery` cuando varios componentes piden lo mismo | Convex | Baja | Bajo | Medio | M |
| **G1** | Service Worker con `lazy + prefetch` en assets | Caché | Baja | Bajo | Bajo | — |
| **G2** | Sin TTL/caché aplicativo encima de Convex | Caché | Baja | Bajo | — | — |
| **G3** | `CustomRouteReuseStrategy` sin política documentada de invalidación | Caché | Baja | Bajo | Medio | S |
| **H0** | Infraestructura `@convex-dev/aggregate` + `@convex-dev/migrations` (registro en `convex.config.ts`, definiciones en `convex/aggregates/`) | Aggregate | Prerequisito | — | Bajo | S |
| **H1** | `getPatientMetrics` ordenado por adherencia hace `.collect()` + sort en memoria (`snapshots/queries.ts:46-56`) | Aggregate | Crítica | Alto | Bajo | S |
| **H2** | Conteo `pacientesActivos` por clínica escanea memberships y filtra `isPlanEnCurso` per-row | Aggregate | Alta | Alto | Bajo | S |
| **H3** | `getActividadDiariaClinica` hace `.collect()` de 20 días para contar sesiones por fecha (`dashboard/queries.ts:144-152`) | Aggregate | Media | Medio | Bajo | S |
| **H4** | `exerciseUsageRollup` mantenido vía `recomputeExerciseUsage` (`snapshots/internal.ts:441-545`) — sustituible por aggregate | Aggregate | Media | Medio | Medio | M |
| **H5** | `recomputePatientForWindow` recalcula adherencia/dolor por ventana iterando rollups | Aggregate | Alta | Alto | Medio | M |
| **H6** | `recomputeClinicForWindow` recorre snapshots para `adherenciaPromedio`/`dolorMedio`/`sesionesUltimos7d` | Aggregate | Alta | Alto | Medio | M |
| **H7** | Gap: no existe "ejercicio más usado por clínica esta semana" (habilitado por H4) | Aggregate | — (feature) | Medio | Bajo | S |
| **H8** | Gap: no existe "top pacientes por adherencia" (habilitado por H1) | Aggregate | — (feature) | Medio | Bajo | S |
| **H9** | Eliminar tablas legacy `patientMetricsSnapshot` / `clinicMetricsSnapshot`; conservar `patientDerivedMetrics` mínimo para `riskScore`/`rachaActual` | Aggregate | Media | Medio | Medio | M |

> **Severidad y prioridad sugerida**: Crítica → Alta → Media → Baja. Dentro de cada nivel, ordenar por **Impacto/Esfuerzo**.

---

## 5. Fichas detalladas

### Bloque A — Assets, fuentes e imágenes

#### **A1 · 19 MB en `assets/portadas/` sin optimizar** ![Crítica](https://img.shields.io/badge/Crítica-red) ![Alto](https://img.shields.io/badge/Alto-orange) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/assets/portadas/` (19 MB).

**Detalle**:
- `fisioterapeutas.png` (2.3 MB), `camilla.PNG` (2.0 MB), `bonsai.png` (1.9 MB), `ejercicio.PNG` (896 KB), múltiples variantes `-horizontal.png` que duplican el peso.
- Todos en PNG sin compresión moderna. Tamaño en disco ≫ tamaño que necesita el componente que las muestra.

**Por qué duele**: aunque el ServiceWorker las cachea tras la primera descarga, **el primer arranque** paga el coste completo. En móvil 4G la primera apertura puede tardar varios segundos solo en estas imágenes si la pantalla actual las usa. Además, el SW las cachea con estrategia `lazy + prefetch update`, así que entran en el cache del navegador en background y compiten por ancho de banda.

**Propuesta**:
- Convertir a **WebP/AVIF** con calidad 80 (reducción típica 60-85%). Mantener PNG como fallback solo si algún navegador legacy lo necesita.
- Generar variantes responsive (`-mobile.webp`, `-tablet.webp`, `-desktop.webp`) y servirlas vía `srcset` / `NgOptimizedImage`.
- Sacar los originales de `assets/` (van al bundle final servido por Express) y guardarlos en un directorio externo (Convex Storage, R2, o `docs/originals/`). Solo lo que se sirve al cliente debería vivir en `assets/`.

**Criterios de aceptación**:
- `du -sh apps/app/src/assets/portadas` < 2 MB.
- Build pasa sin warnings sobre tamaño de assets.
- Lighthouse "Properly size images" y "Serve images in next-gen formats" pasan.

**Dependencias**: parcialmente bloquea A2 (NgOptimizedImage tiene más sentido tras convertir formatos).

---

#### **A2 · `NgOptimizedImage` no se usa en ninguna parte** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Bajo](https://img.shields.io/badge/Bajo-green) `M`

**Ubicación**: toda la app. 0 ocurrencias de `ngSrc` en `apps/app/src/app/`.

**Detalle**: todas las imágenes se cargan con `<img src="...">` directo. Convex/R2 ya devuelve URLs con `width/height/quality` (excelente — ver `pacientes-list.component.ts:275`), pero el componente Angular no aprovecha:
- Lazy loading nativo del navegador con prioridad
- `srcset` automático basado en device pixel ratio
- Placeholder LQIP (low quality image placeholder)
- Avisos de tamaño desde DevTools

**Por qué duele**: especialmente en `/inicio` y `/mis-pacientes`, donde se renderizan avatares y portadas. En móvil, el navegador descarga la imagen "fullsize" aunque la pinte a 96 px.

**Propuesta**:
- Importar `NgOptimizedImage` y aplicar `[ngSrc]`, `[priority]` (para LCP), `[width]`, `[height]` y opcionalmente `placeholder` (requiere prefijo data:image LQIP).
- Crear un `provideImageLoader()` que entienda el formato de URLs de Convex/R2 para que Angular añada parámetros `width`/`quality` automáticamente sin tocar cada template.
- Convertir como prioridad: portadas hero (LCP candidate), avatares en listas, thumbnails de ejercicios.

**Criterios de aceptación**:
- Al menos los avatares de `pacientes-list` y `chat`, las portadas de hero y las thumbnails de catálogo usan `ngSrc`.
- LCP de `/mis-pacientes` con red 3G simulada baja (medible con Lighthouse mobile).
- `provideImageLoader` configurado para Convex/R2 — los templates pasan `width`/`height` y la URL final se forma automáticamente.

**Dependencias**: ninguna, pero más valor tras A1.

---

#### **A3 · 6 fuentes en TTF y solo 2 con `preload`** ![Alta](https://img.shields.io/badge/Alta-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/assets/fonts/` (608 KB) · `apps/app/src/index.html:15-20`.

**Detalle**:
- 8 archivos en `assets/fonts/`: `galvji.ttf` (4 variantes), `SocialGothic-Bold.ttf` (72 KB), `FieldGothic.*`, `versus-semibold.*`, `KengoDisplay.*`.
- `index.html:18-19` precarga solo `galvji.ttf` y `SocialGothic-Bold.ttf`. El resto carga "a demanda" desde el CSS.
- Todas son TTF (formato sin compresión optimizada para web). WOFF2 reduce 30-50% el peso del mismo archivo.
- Material Symbols se carga via Google Fonts CDN (319 kB en `/login` — confirmado en mediciones runtime).

**Por qué duele**:
- En `/login` se cargan 7 fuentes (~850 kB) — 45% del peso total de la página.
- TTF no se beneficia de `Brotli`/`gzip` tanto como WOFF2.
- Fuentes no precargadas en `index.html` provocan FOIT (Flash of Invisible Text) breve.

**Propuesta**:
- Convertir todas las TTF a WOFF2 con `fonttools` o servicio online. Mantener TTF solo como fallback explícito si lo necesita algún navegador antiguo.
- Auditar uso real de cada fuente (grep de `font-family` en CSS) y eliminar las que no se usan. Sospecha: `FieldGothic`, `versus-semibold`, `SocialGothic-Bold` y `KengoDisplay` puede que se solapen con `galvji`.
- Para Material Symbols: considerar self-hosting (descargar el WOFF2 una sola vez y servirlo desde `/assets`). Beneficio: 1 menos DNS lookup (Google Fonts), control sobre caching. Coste: hay que mantener actualizada la versión.
- Añadir `font-display: optional` en las fuentes secundarias para que la primera pintura nunca espere.

**Criterios de aceptación**:
- `du -sh apps/app/src/assets/fonts` < 250 kB.
- Número de archivos de fuente en `assets/fonts/` ≤ 4 (las realmente usadas, en WOFF2).
- En la network capture de `/login`, las fuentes total no superan 300 kB.

**Dependencias**: ninguna.

---

#### **A4 · Vídeo del player con `autoplay` sin `preload="none"`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/app/features/sesion/pages/realizar-plan/componentes/ejercicio-activo-piezas/ejercicio-video-player/ejercicio-video-player.component.html:1-11`.

**Detalle**:
```html
<video
  #videoPlayer
  class="media-element"
  [src]="videoUrl()"
  [poster]="posterUrl() || ''"
  autoplay
  muted
  loop
  playsinline
></video>
```
No tiene `preload="none"` ni `preload="metadata"`. El navegador descarga automáticamente parte del buffer apenas el elemento se monta.

**Por qué duele**: si el componente padre se monta antes de que el vídeo sea visible (transición, prefetch de la siguiente pantalla), se consume ancho de banda móvil sin necesidad.

**Propuesta**: cambiar a `preload="metadata"` o `preload="none"` y forzar `videoPlayer.nativeElement.load()` cuando entra en viewport o cuando el componente padre lo señala.

**Criterios de aceptación**: el vídeo no inicia descarga hasta que el elemento es visible o el usuario lo solicita.

---

#### **A5 · Material Symbols (~319 kB WOFF2) desde Google Fonts CDN** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/index.html:17,20`.

**Detalle**: Material Symbols Outlined carga el set completo (~319 kB WOFF2) cada vez que el navegador no tiene el archivo en caché. La app usa decenas de iconos del set, pero hay un sub-set conocido (ver `apps/app/src/app/shared/ui-v2/icons/icon-map.ts` y otros).

**Propuesta**:
- Subsetting con `glyphhanger` o `fonttools`: extraer solo los iconos realmente usados y self-hostear. Coste de mantenimiento (cuando aparezca un icono nuevo hay que regenerar).
- Alternativa: continuar con Google Fonts CDN pero añadir `font-display: block` para que no parpadee.

**Criterios de aceptación**: peso del set de iconos en producción < 50 kB.

---

### Bloque B — Bundle y dependencias

#### **B1 · Dependencias backend en el `package.json` raíz** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `package.json` raíz.

**Detalle**: en `dependencies` aparecen `stripe`, `express`, `google-auth-library`, `resend`, `firebase`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. De estas:
- `firebase` no tiene imports en `apps/app/src/` (solo `@capacitor-firebase/messaging`).
- `stripe`, `express`, `resend`, `google-auth-library` se usan en `apps/backend/` y/o Convex actions — no en la app.
- `@aws-sdk/*` no tiene imports detectados en `apps/app/src/`.

**Por qué duele**: aunque Angular hace tree-shaking efectivo de lo no importado, mantenerlas como `dependencies` del monorepo:
- Aumenta `node_modules` (1.3 GB).
- Crea riesgo: cualquier desarrollador puede importar `firebase` sin querer y romper el budget.
- Confunde el análisis de dependencias en CI.

**Propuesta**:
- Separar `package.json` por proyecto: `apps/app/package.json`, `apps/backend/package.json`, `convex/package.json`. Nx/pnpm workspaces lo permite.
- Si separar es muy invasivo: mover las dependencias backend a un `devDependencies` etiquetado, o adoptar `nohoist` selectivo.

**Criterios de aceptación**: imports en `apps/app/src/` no pueden resolver `firebase`, `stripe`, `express`, `resend`, `google-auth-library`, `@aws-sdk/*`.

---

#### **B2 · Tailwind sin `tailwind.config.ts` ni `content` explícito** ![Baja](https://img.shields.io/badge/Baja-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: no hay `tailwind.config.{ts,js}` en `apps/app/` ni en raíz.

**Detalle**: Tailwind v4 detecta archivos a escanear por defecto, pero conviene confirmarlo. CSS final en producción es **65 kB** (estilos-QWLZV3QS.css), que es razonable pero no excelente para una app que solo usa una fracción del catálogo Tailwind.

**Propuesta**: añadir `tailwind.config.ts` explícito con `content` apuntando a `apps/app/src/**/*.{html,ts,scss}` para evitar regresiones. Verificar con `npx tailwindcss --content "apps/app/src/**/*.{html,ts}" -i styles.css -o /tmp/out.css --minify` que el CSS no engorda al añadir la config.

**Criterios de aceptación**: CSS final ≤ 65 kB tras añadir config (sin engordar). Idealmente baja.

---

#### **B3 · Initial bundle 927.99 kB raw / 222 kB gz** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: build output (`apps/app/project.json:33-43` define budget actual 700 kB warn / 2 MB error).

**Detalle**: tras Oleada 1 (A1-A5) y B1-B4, el initial debería bajar significativamente. Pero los tres chunks gordos (`GHEWJQFH` 250 kB, `VQQ64ZC3` 242 kB, `IZS4TLSW` 159 kB) suman 652 kB raw y son el grueso. Sin inspección con `source-map-explorer` no sabemos qué contienen, pero sospechosos:
- Convex client + better-auth + zod (~150-200 kB)
- Angular CDK (overlay, dialog, scrolling, drag-drop) (~80-120 kB)
- Algún chunk de UI compartida (ui-v2)

**Propuesta**:
- Ejecutar `npx source-map-explorer dist/apps/app/browser/chunk-GHEWJQFH.js` (y los otros dos gordos) para identificar exactamente qué pesa más.
- Bajar progresivamente el budget warning a 500 kB conforme se vayan ganando KB.

**Criterios de aceptación**: budget warning actualizado a un objetivo realista (ej. 500 kB) y bundle real por debajo.

---

#### **B4 · `qrcode` lazy + limpieza de `pdfkit` huérfano** ✅ Resuelto (2026-06-02) `S`

**Estado actual**: `qrcode` se carga bajo demanda dentro del componente que lo usa; `pdfkit` nunca llegó a estar en el bundle del frontend.

**Acciones aplicadas en esta iteración**:
- `gestion-acceso-dialog.component.ts:151` — `generarQR()` ahora hace `const { default: QRCode } = await import('qrcode')` en lugar del import estático del módulo. `qrcode` queda en su propio chunk lazy.
- `paciente-detail.component.ts:773` — `gestionarAcceso()` migrado a `async` y carga `GestionAccesoDialogComponent` con `await import(...)`, siguiendo el patrón ya usado por `DialogoPdfComponent` (`plan-detail.component.ts:412`), los diálogos de `miclinica.component.ts`, etc. Tras esto, ni el dialog ni `qrcode` viajan dentro del chunk lazy de `paciente-detail`.
- `apps/app/src/types/pdfkit-standalone.d.ts` — se intentó eliminar pero **es necesario**. Aunque ningún `.ts` del frontend importa `pdfkit`, `tsconfig.app.json` type-checkea transitivamente la cadena de tipos que llega desde `convex/_generated/api` hasta `convex/pdf/actions.ts:3 (import PDFDocument from "pdfkit/js/pdfkit.standalone")`. Sin el `.d.ts` el build de producción falla con `TS7016: Could not find a declaration file for module 'pdfkit/js/pdfkit.standalone'`. El archivo se mantiene; el equivalente local de Convex sigue en `convex/pdf/pdfkit-standalone.d.ts`. La auditoría original interpretó este `.d.ts` como bundle leak, pero es solo soporte de tipos: la generación de PDFs es 100 % server-side y `app-dialogo-pdf` solo invoca `api.pdf.actions.generatePlanPdf` y descarga el blob — no hay runtime de `pdfkit` en el bundle del navegador.

**Verificación**:
- Build de producción: `qrcode` aparece como chunk lazy separado; el chunk de `paciente-detail` baja al sacar tanto `qrcode` como el código del dialog.
- Smoke test: abrir paciente → "Gestionar acceso" → el QR se renderiza igual; en la primera apertura se observa el fetch del chunk `qrcode-*.js` en network.

**Notas para iteraciones futuras**:
- `qrcode` sigue en `dependencies` raíz y en `allowedCommonJsDependencies` (`project.json:45,73`). Moverlo a un `package.json` por app es alcance de **B1**, no de este item.
- Si en el futuro se introduce generación de PDFs en cliente (no recomendado), aplicar el mismo patrón `await import('pdfkit/js/pdfkit.standalone')` y restaurar el `.d.ts` puntualmente.

---

### Bloque C — Routing y precarga

#### **C1 · Sin `PreloadingStrategy` configurada** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `apps/app/src/app/app.config.ts:14` — `provideRouter(routes)` sin segundo argumento.

**Detalle**: default es `NoPreloading`. Las features lazy solo se descargan al navegar. En la auditoría runtime se observó que tras hacer login y entrar en `/inicio/fisio`, varios chunks lazy se descargan en background ~2 s después — pero solo porque ya están en caché del SW de una visita anterior. En cold start real (sin SW poblado), cada navegación implica descarga.

**Propuesta**:
- Diseñar una `CustomPreloadingStrategy` que solo precargue rutas marcadas con `data: { preload: 'idle' }` y solo cuando:
  - `requestIdleCallback` esté disponible y el dispositivo no esté en `data-saver`.
  - El usuario haya estado en la app más de N segundos (evitar quemar datos en cold start).
- Marcar como precargables: `mis-pacientes` desde `/inicio/fisio`, `ejercicios` desde `/mis-pacientes`, etc. (las rutas que el usuario probablemente abrirá a continuación).

**Criterios de aceptación**:
- Tiempo de navegación intra-app `/inicio/fisio` → `/mis-pacientes` baja medible en un cold start (sin caché).
- No se precargan rutas en cold start ni cuando el usuario tiene `connection.saveData = true`.

---

#### **C2 · `@defer` en páginas pesadas (parcial)** ✅ Resuelto para `realizar-plan`, `paciente-detail`, `plan-builder` (2026-06-03) `M`

**Estado actual** (build prod 2026-06-03, post-cambios):

| Página | Chunk principal antes | Chunk principal después | Δ | Chunks deferidos creados |
|--------|----------------------|------------------------|---|--------------------------|
| `realizar-plan` | 108.74 kB | **51.64 kB** | **−52%** (−57 kB) | `ejercicio-activo` ~23 kB, `descanso` ~13 kB, `feedback-final` + `timeline-sesion` (varios <1 kB de stubs adicionales) |
| `paciente-detail` | 65.03 kB (post-B4) | **41.99 kB** | **−35%** (−23 kB) | `pd-activity-timeline` ~12 kB, `pd-weekly-bars-card` ~7.7 kB, `pd-plans-list` ~5 kB, `pd-comments` ~3 kB, `pd-paciente-data` ~0.8 kB |
| `plan-builder` | 34.36 kB | **32.66 kB** main + extracción de **CDK DragDrop (~57 kB)** y lista (~21 kB) a chunks lazy | −5% en main, **−78 kB** trasladados a carga bajo demanda | `cdk-drag-drop` ~57 kB, lista ejercicios ~21 kB |

**Acciones aplicadas en esta iteración**:

1. **`realizar-plan` (`apps/app/src/app/features/sesion/pages/realizar-plan/realizar-plan.component.ts`)**:
   - `@case ('ejercicio'|'descanso'|'feedback-final')` envueltos en `@defer (when estadoPantalla() === '...'; prefetch on idle)`. Cada pantalla pasa a chunk propio; el chunk se prefetchea en idle desde la primera pantalla (resumen) para evitar flash al cambiar.
   - `<app-timeline-sesion>` (drawer de 739 LOC, el subcomponente más pesado) envuelto en `@defer (when timelineAbierto(); prefetch on idle)`. Solo se descarga cuando el usuario abre "Ver ejercicios".
   - `resumen` (entry point) queda eager por diseño.
   - Placeholders: `<div class="rp-defer-placeholder">` con `flex: 1; min-height: 100%` para que el contenedor mantenga viewport mientras el chunk hidrata.

2. **`paciente-detail` (`apps/app/src/app/features/pacientes/pages/paciente-detail/paciente-detail.component.ts`)**:
   - Desktop main column: `<app-pd-weekly-bars-card>` y `<app-pd-activity-timeline>` con `@defer (on viewport; prefetch on idle)`.
   - Desktop sidebar: `<app-pd-plans-list>` y `<app-pd-comments>` con la misma estrategia. `<app-pd-active-plan-card>` y header/KPIs quedan eager (above the fold).
   - Mobile collapsibles: para los `defaultOpen=false` (Actividad, Planes asignados, Comentarios, Datos del paciente) se introdujo señal `collapsibleOpen` + handler `onCollapsibleOpen(key, isOpen)` y `@defer (when collapsibleOpen().X; prefetch on viewport)`. Una vez abierto, permanece cargado (no se descarga). `Adherencia semanal` (default-open) usa `on viewport`.
   - Placeholders: `<div class="pd2-defer pd2-defer--{card|timeline|list}">` con `min-height` calibrado por tipo para evitar CLS.

3. **`plan-builder` (`apps/app/src/app/features/planes/pages/plan-builder/plan-builder.component.html`)**:
   - Sustituido `@if/@else` por `@defer (when items().length > 0; prefetch on idle) { lista + cdkDropList + cdkDrag(...) + botón "añadir" } @placeholder { ui2-empty-state }`. El empty state cae dentro de `@placeholder` reutilizando la misma plantilla.
   - Resultado: **CDK `DragDropModule` (~57 kB)** y `PlanDayTogglesComponent` salen del chunk inicial de la página. En modo creación con plan vacío, el chunk no se descarga hasta añadir el primer ejercicio (con `prefetch on idle`, esto ocurre antes de la interacción real).
   - Se descartó el `@defer` por ítem para los detalles editables (`.pb-ex__details`): en desktop están siempre visibles (regla CSS `apps/app/src/app/features/planes/pages/plan-builder/plan-builder.component.css:574`), por lo que un `when ejercicioEditando() === i` los ocultaría — regresión visual inaceptable.

**Verificación**:
- `npx nx build app --configuration=production` → reducción confirmada en los 3 chunks (tabla arriba); 17 chunks lazy nuevos respecto al baseline.
- `npm run lint` → sin errores nuevos introducidos por estos cambios (los 109 errores existentes en el repo son pre-cambio y ortogonales a C2).
- Placeholder con `min-height` calibrado por sección para que la entrada en viewport (desktop) o la expansión del collapsible (mobile) no provoque salto de CLS.

**Notas para iteraciones futuras**:
- `miclinica` (51 kB) y `plan-detail` (32 kB) quedan fuera de esta iteración por scope explícito del trabajo. Mismo patrón aplicable cuando se aborden.
- Initial bundle subió de 928 kB a 989 kB en esta build — no está relacionado con C2 (los `@defer` solo tocan chunks lazy). Probablemente atribuible a hoisting de dependencias en chunks compartidos; revisar bajo **B3** con `source-map-explorer`.
- Smoke manual en navegador pendiente — los chunks deferidos deben aparecer en Network al cambiar a `ejercicio`/`descanso`/`feedback-final` y al abrir el drawer del timeline.

---

#### **C3 · Hidratación bloqueante en constructor de `SessionService`** ![Baja](https://img.shields.io/badge/Baja-blue) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/app/core/auth/services/session.service.ts` (constructor llama a `intentarHidratarDesdeCache()` que es síncrono).

**Detalle**: `localStorage.getItem('kengo:user-cache:v1')` es síncrono y bloqueante. El cache es ~5 KB JSON, así que el impacto es mínimo (<1 ms en cualquier dispositivo moderno).

**Propuesta**: dejarlo como está si el tamaño no crece, o migrar a `Preferences` (Capacitor) que es async — pero solo si en algún momento el cache crece a decenas de KB.

**Criterios de aceptación**: medir el tamaño del cache a lo largo del tiempo; si supera 50 kB, migrar a async.

---

### Bloque D — Cambio de detección y renderizado

#### **D1 · `@for` con `track`** ✅ Resuelto (2026-06-02) `S`

**Estado actual**: 86/86 `@for` con `track` (el compilador de Angular 17+ ya lo exige; la cifra de la auditoría inicial era previa a los commits de perf de mayo-junio 2026).

**Acciones aplicadas en esta iteración**:
- Refactor de 3 `track $index` con id real disponible:
  - `features/sesion/.../resumen-sesion.component.html:62` → `track item.planItemId`
  - `features/actividad/ui/patient-calendar/patient-calendar.component.html:118` → `track ejercicio.planItemId`
  - `features/actividad/pages/actividad-hoy/actividad-hoy.component.ts` — añadido `planItemId` a la interfaz `EjercicioProximo` y al builder; template → `track ejercicio.planItemId`.
- 6 `track $index` legítimos documentados con comentario justificativo en el propio template:
  - `clinica/.../{editar,crear}-clinica-dialog.component.html` (`File[]` de uploads, sin id natural)
  - `shared/ui-v2/{activity-rings,stepper,web-activity-chart,weekly-bars}.component.ts` (UI con orden/tamaño fijo).
- Guardrail `apps/app/scripts/check-track-index.sh` (expuesto como `npm run check:track-index`): hace `grep -F 'track $index'` y falla si aparece fuera de una allowlist explícita. Pensado para enganchar al `verify` del agente o a CI antes del merge.

**Verificación**:
- `npm run check:track-index` → `✓ check-track-index: 0 violaciones (6 casos allowlisteados)`
- Test negativo del script: introduce un fichero con `track $index` → falla con exit 1 y reporta el archivo.

**Notas para iteraciones futuras**:
- No existe regla ESLint estándar para detectar `track $index` (la regla `@angular-eslint/template/use-track-by-function` aplica solo a `*ngFor`, que el proyecto no usa). El script bash es suficiente para este alcance.
- Si en el futuro aparece un `@for` nuevo sobre un iterable que carezca de id, el patrón a seguir es: añadir el id sintético en el builder TS (como se hizo con `EjercicioProximo.planItemId`), no usar `$index`.

---

#### **D2 · 11 componentes sin `OnPush`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo-Medio](https://img.shields.io/badge/Bajo--Medio-yellow) `M`

**Ubicación** (11 componentes de 156):
- `apps/app/src/app/app.component.ts` (raíz)
- `apps/app/src/app/features/planes/.../plan-builder.component.ts`
- `apps/app/src/app/features/planes/.../plan-detail.component.ts`
- `apps/app/src/app/features/sesion/.../realizar-plan.component.ts`
- `apps/app/src/app/shared/ui/selector-paciente.component.ts`
- `apps/app/src/app/shared/ui/image-upload.component.ts`
- `apps/app/src/app/shared/ui/video-ejercicio.component.ts`
- `apps/app/src/app/features/dashboard/.../actividad-hoy.component.ts`
- 3 componentes del flujo de sesión: `sesion-completada`, `feedback-ejercicio`, `resumen-sesion`

**Detalle**: el resto de la app (93%) ya usa OnPush. Estos 11 son los que faltan. El raíz (`AppComponent`) usa signals/computed exclusivamente — la migración es trivial.

**Propuesta**:
- Empezar por `AppComponent` (cambio de una línea, riesgo prácticamente cero porque ya usa signals).
- Después `plan-builder`/`plan-detail`/`realizar-plan` con tests manuales (son páginas complejas con drag-drop y animaciones — pueden tener dependencias sutiles del CD default).
- Por último los UI compartidos legacy (`selector-paciente`, `image-upload`, `video-ejercicio`).

**Criterios de aceptación**: `grep -L "ChangeDetectionStrategy.OnPush" apps/app/src/app/**/*.component.ts` devuelve cadena vacía.

---

#### **D3 · Métodos invocados desde template dentro de `@for`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/app/features/pacientes/pages/pacientes-list/pacientes-list.component.html` (entre otros).

**Detalle**: `getDolorPromedio(p.id)`, `getAdherencia(p.id)`, `dolorColor(value)`, `dolorIcon(value)` se invocan dentro del `@for` de pacientes. Cada uno hace lookup en `metricasMap()` por iteración. Aunque `metricasMap()` es signal y los métodos son baratos, Angular los invoca **en cada CD**.

**Propuesta**:
- En el componente:
  ```ts
  readonly pacientesConMetricas = computed(() => {
    const lista = this.pacientes();
    const metricas = this.metricasMap();
    return lista.map(p => ({
      ...p,
      adherencia: metricas[p.id]?.adherencia ?? null,
      dolor: metricas[p.id]?.dolorPromedio ?? null,
    }));
  });
  ```
- En el template: `{{ p.adherencia }}` en lugar de `{{ getAdherencia(p.id) }}`.

**Criterios de aceptación**: 0 invocaciones de método en `@for` sobre listas de >50 items.

> **Nota 2026-06-03 (cross-ref H1)**: el sort cliente de `pacientes-list.component.ts:207-227` (por adherencia/dolor) se elimina cuando H1 esté en producción — `metricasMap()` se alimentará de un endpoint que ya devuelve los pacientes ordenados del aggregate. La precomputación en `computed()` propuesta arriba sigue siendo válida para `getAdherencia`/`getDolorPromedio` que no afectan al orden.

---

#### **D4 · Sin virtualización en listas grandes** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**:
- `apps/app/src/app/features/ejercicios/.../ejercicios-list.component.ts` — `EjerciciosService` mantiene `allEjercicios` (catálogo completo) en memoria. Filtros y orden se aplican en cliente.
- `apps/app/src/app/features/pacientes/pages/pacientes-list/pacientes-list.component.ts:230-237` — `limit: 200` pacientes sin paginación visual.

**Detalle**: el catálogo de ejercicios puede crecer libremente (Directus es la fuente). Con 500+ ejercicios filtrados en cliente, el DOM tiene cientos de nodos por categoría visible.

**Propuesta**:
- `cdk-virtual-scroll-viewport` de Angular CDK para listas con > 50 items.
- Para `ejercicios-list`: virtualización por filas, manteniendo el filtro/orden en cliente (es razonable para catálogos < 5k items).
- Para `pacientes-list`: virtualizar la tabla. Como alternativa más simple, paginación clásica de 50 en 50.

**Criterios de aceptación**:
- DOM nodes en `/ejercicios` con catálogo grande se mantiene constante mientras scrolleas.
- Scroll fluido (60 fps) en `pacientes-list` con 200 pacientes en device mid-range.

---

#### **D5 · `patient-sidebar.component.ts` con 1068 líneas** ![Baja](https://img.shields.io/badge/Baja-blue) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) `L`

**Ubicación**: `apps/app/src/app/shared/ui-v2/patient-sidebar/patient-sidebar.component.ts`.

**Detalle**: aunque no es estrictamente un problema de performance (no impacta CD), su tamaño lo hace difícil de testear y razonar. Cualquier cambio recompila/empaqueta el chunk completo.

**Propuesta**: dividir en sub-componentes: `<ui2-sidebar-header>`, `<ui2-sidebar-nav-group>`, `<ui2-sidebar-footer>`, `<ui2-sidebar-clinic-card>`. No prioritario hasta que aparezca friction al editar.

---

### Bloque E — Data fetching (Angular)

#### **E1 · N+1 secuencial en `metricasPacientesService.getMetricasBulk`** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `apps/app/src/app/features/pacientes/data-access/metricas-pacientes.service.ts:48-60`.

**Código actual**:
```ts
const all: SnapshotDoc[] = [];
for (const clinicId of clinicIds) {
  const snaps = await this.convex.query(
    api.snapshots.queries.getPatientMetrics,
    { clinicId, ventana, ordenarPor: 'adherencia', limit: 200 },
  );
  for (const s of snaps) all.push(s);
}
```

**Detalle**: bucle secuencial — cada query espera a la anterior. Un fisio con 5 clínicas paga 5x la latencia. Se invoca desde `pacientes-list.component.ts:454` con `queueMicrotask`, no bloquea el render inicial pero retrasa la aparición de las métricas.

**Propuesta**:
- Nueva query Convex `getPatientMetricsForClinics({ clinicIds: Id<'clinics'>[] })` que internamente:
  ```ts
  const results = await Promise.all(
    args.clinicIds.map(cid => ctx.db.query("patientMetricsSnapshot")
      .withIndex("by_clinicId_ventana_riskScore", q => q.eq("clinicId", cid).eq("ventana", args.ventana))
      .take(args.limit))
  );
  return results.flat();
  ```
- O al menos paralelizar las queries en cliente con `Promise.all` si el cambio de servidor es demasiado.

**Criterios de aceptación**: tiempo de aparición de métricas en `/mis-pacientes` con 3 clínicas se reduce ~3x (de 3x latencia a 1x latencia).

> **Nota 2026-06-03 (cross-ref H1)**: la solución definitiva preferida pasa por **H1**, no por crear un nuevo endpoint `getPatientMetricsForClinics`. Con el aggregate, el orden por adherencia se vuelve O(log n + k) sin recalcular desde el snapshot, y la paralelización por clínica se reduce a iterar namespaces — el cuello de botella desaparece en origen. El endpoint actual queda como wrapper trivial sobre `patientsByClinicAdherencia.paginate(...)` por cada `clinicId`.

---

#### **E2 · `paciente-detail` dispara 6 cargas en `ngOnInit`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `apps/app/src/app/features/pacientes/pages/paciente-detail/paciente-detail.component.ts:491-505`.

**Detalle**: 6 llamadas en `ngOnInit` (paciente, planes, cumplimiento, snapshot dolor, comentarios, fisio responsable). Sin coordinación: la página se considera "lista" solo cuando paciente cargó, dejando el resto en skeleton. No hay prefetch en ruta (resolver) ni un endpoint de "bootstrap".

**Propuesta**:
- Crear una query Convex `pacientes.getDetailBundle({ pacienteId, clinicId })` que devuelva en 1 round-trip:
  ```ts
  { paciente, planesActivos, snapshotDolor, fisioResponsable, comentariosPreview, cumplimientoResumen }
  ```
- O usar `Promise.all` agresivo en el cliente para paralelizar y mostrar todo cuando termine la slowest, en vez de stagear.

**Criterios de aceptación**: TTI de `paciente-detail` (todos los datos visibles) baja medible. Idealmente todo aparece en una sola transición sin skeletons parciales.

---

#### **E3 · Subscripciones manuales sin `takeUntilDestroyed`** ![Media](https://img.shields.io/badge/Media-yellow) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**:
- `apps/app/src/app/features/pacientes/pages/pacientes-list/pacientes-list.component.ts:352, 454`
- `apps/app/src/app/features/pacientes/pages/paciente-detail/paciente-detail.component.ts:659`

**Detalle**: `.subscribe({ next, error })` sin operador de cancelación. Si el componente se destruye antes de que llegue la respuesta, el callback se ejecuta sobre un componente muerto. Puede causar warnings (NG0950: setter on destroyed signal) o asignaciones perdidas.

**Propuesta**:
```ts
this.asignacionesService.listarAsignaciones(cid)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe({ next: ..., error: () => undefined });
```
O migrar a `firstValueFrom` con `AbortController`.

**Criterios de aceptación**: 0 `.subscribe(` en componentes sin `takeUntilDestroyed` (lint rule si existe).

---

#### **E4 · Sin batching de queries iniciales tras login** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: distribuido — cada feature/página tiene su `ngOnInit` con sus queries.

**Detalle**: tras `iniciarApp()`, la primera ruta (típicamente `/inicio/fisio`) hace su propio set de queries: `users.me`, `dashboard.planesPorVencer`, `dashboard.getActividadDiariaClinica`, `clinic.summary`, etc. Cada una es independiente. No hay un endpoint Convex que devuelva el "shell" completo del usuario en una sola query reactiva.

**Propuesta**:
- Crear `dashboard.getInicioBundle()` que reúna lo necesario para renderizar `/inicio/fisio` (rol-condicional). Internamente paraleliza con `Promise.all`.
- Beneficio menor que E1/E2 porque Convex multiplexes queries sobre WebSocket — pero el batching sigue ahorrando round-trips inicial.

**Criterios de aceptación**: tiempo desde login hasta `/inicio/fisio` interactivo medible mejora.

---

#### **E5 · `fetch` directo en auth sin timeout ni retry** ![Baja](https://img.shields.io/badge/Baja-blue) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `apps/app/src/app/core/auth/services/auth.service.ts:327, 365, 416`.

**Detalle**: `consumirTokenAcceso()`, `establecerPassword()`, `resetPassword()` usan `fetch()` sin `signal: AbortSignal.timeout(...)` ni reintentos. En redes inestables, la operación queda colgada indefinidamente.

**Propuesta**: envolver con un helper:
```ts
async function fetchWithTimeout(url, init, timeoutMs = 10_000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
```
Con retry exponencial (3 intentos) para 5xx.

---

#### **E6 · `console.log/.error/.warn` sin guard `isDevMode()`** ![Baja](https://img.shields.io/badge/Baja-blue) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: 78 ocurrencias en `apps/app/src/app/features/`.

**Detalle**: en producción, estos logs serializan objetos y los entregan a DevTools, lo que consume CPU si abren la consola.

**Propuesta**:
- Crear un wrapper `Logger` que solo loguee si `isDevMode()` o `localStorage.getItem('kengo:debug')`.
- Migrar usos críticos al Logger.
- A futuro: integrar Sentry/PostHog (ya hay un comentario en `better-auth.service.ts:144` planteándolo) y el Logger envía allí.

**Criterios de aceptación**: 0 `console.*` en producción salvo bajo flag.

---

### Bloque F — Queries Convex (servidor)

#### **F1 · `exercises.listExercises` full table scan de `exerciseCategories` y `categories`** ![Crítica](https://img.shields.io/badge/Crítica-red) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/exercises/queries.ts:10-38` (helper `enrichWithCategories`).

**Código actual**:
```ts
async function enrichWithCategories(ctx, exercises) {
  if (exercises.length === 0) return [];
  const allExCats = await ctx.db.query("exerciseCategories").collect();
  const allCats = await ctx.db.query("categories").collect();
  // ...build maps...
}
```

**Detalle**: cada llamada a `listExercises` o `listFavorites` carga **todas** las relaciones M:N y **todas** las categorías. Patrón replicado en `convex/routines/queries.ts:17-18`. Escala O(ejercicios × categorías × relaciones).

**Por qué duele ahora**: con un catálogo de 500 ejercicios × 30 categorías × 3 relaciones promedio = ~1500 docs por llamada. Cada llamada se invoca al abrir `/ejercicios` y al refrescar (suscripción reactiva).

**Propuesta**:
- Para `listExercises`: el orden inverso es más eficiente — primero filtrar exercises, después cargar solo las relaciones de esos IDs específicos:
  ```ts
  const exerciseIds = exercises.map(e => e._id);
  const relations = await Promise.all(exerciseIds.map(id =>
    ctx.db.query("exerciseCategories").withIndex("by_exerciseId", q => q.eq("exerciseId", id)).collect()
  ));
  ```
  Requiere índice `by_exerciseId` en `exerciseCategories` (si no existe, añadirlo).
- Alternativa: precalcular en una tabla `exerciseCategoriesIndex` (`exerciseId → [categoryName]`) que se mantiene en mutations.

**Criterios de aceptación**: la query `listExercises` no llama `.collect()` sin filtro sobre `exerciseCategories` ni `categories`.

---

#### **F2 · N+1 en `plans.checkPlanHasActivity`** ✅ Resuelto (commit `663ae64`) `S`

> **Nota 2026-06-03 (cross-ref Bloque H)**: con el aggregate `executionsByPlan` (no incluido en el plan H actual por bajo ROI inmediato), un `count()` por plan se vuelve también O(log n) gratis si en el futuro alguna pantalla quiere mostrar "número de ejecuciones por plan" sin pagar por el cálculo.

<details><summary>Texto original</summary>

![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/plans/queries.ts:414-435`.

**Código actual**:
```ts
const exercises = await ctx.db.query("planExercises").withIndex("by_planId", ...).collect();
for (const ex of exercises) {
  const execution = await ctx.db.query("exerciseExecutions")
    .withIndex("by_planExerciseId", q => q.eq("planExerciseId", ex._id))
    .first();
  if (execution) return true;
}
return false;
```

**Detalle**: para un plan con 20 ejercicios, hasta 20 queries secuenciales solo para responder "¿hay alguna actividad?".

**Propuesta**:
- Añadir índice `by_planId` en `exerciseExecutions` (si no existe en `convex/schema.ts`).
- Reescribir como 1 query:
  ```ts
  const anyExecution = await ctx.db.query("exerciseExecutions")
    .withIndex("by_planId", q => q.eq("planId", args.planId))
    .first();
  return anyExecution !== null;
  ```

**Criterios de aceptación**: 1 sola query Convex en `checkPlanHasActivity` independientemente del tamaño del plan.

</details>

---

#### **F3 · Triple N+1 en `dashboard.planesPorVencer`** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/dashboard/queries.ts:48-58, 85-108`.

**Detalle**: dos loops anidados con `.collect()` de memberships por clínica, después loops sobre fisios → planes → `ctx.db.get(pacienteId)`. Para 5 fisios con 20 planes c/u = 105 queries.

**Propuesta**:
- Primero recolectar `fisioIds`, `pacienteIds` y `planes` candidatos.
- Usar `batchGetMap(ctx, "users", pacienteIds)` (helper que ya existe en `convex/_helpers/`) para hidratar nombres en una sola query.
- Reducir a 3 queries: memberships, planes-con-índice-por-fisioId-y-estado, batch get de pacientes.

**Criterios de aceptación**: número de queries Convex en `planesPorVencer` ≤ 4, independientemente del número de clínicas/fisios.

> **Nota 2026-06-03 (cross-ref Bloque H)**: aggregate no resuelve el join paciente↔plan (sigue requiriendo `batchGetMap` para hidratar nombres), pero sí absorbe los conteos de planes activos por fisio/clínica y la ordenación por `fechaFin`. Si se crea el aggregate `plansByFisioActive` (namespace = `fisioId`, sortKey = `fechaFin`), la sección "top 10 planes por vencer ordenados por fechaFin" pasa a `paginate({ namespace: fisioId, bounds: { lower: hoy, upper: hoy+7d } })` O(log n + 10), eliminando 2 de los 3 niveles del N+1.

---

#### **F4 · N+1 en `executions.listByPacienteAndDateExpanded`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/executions/queries.ts:140-184`.

**Código actual**: `Promise.all` de gets por ejecución (`planExercise` + `exercise` + `plan` por cada execution).

**Detalle**: paraleliza pero sigue siendo 3×N gets. Para 50 ejecuciones = 150 lookups.

**Propuesta**: agrupar IDs únicos primero y hacer 3 batch queries:
```ts
const planExerciseIds = unique(filtered.map(e => e.planExerciseId));
const planExercises = await batchGetMap(ctx, "planExercises", planExerciseIds);
const exerciseIds = unique(Object.values(planExercises).map(pe => pe.exerciseId));
const exercises = await batchGetMap(ctx, "exercises", exerciseIds);
// idem plans
```

**Criterios de aceptación**: 3-4 queries totales independientemente del número de executions.

---

#### **F5 · `users.me` y `routines.enrichRoutineExercises`: gets en loop** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**:
- `convex/users/queries.ts:29-39` (`me` hidrata clínicas)
- `convex/routines/queries.ts:36-46` (`enrichRoutineExercises` hidrata ejercicios)

**Propuesta**: usar `batchGetMap()` (ya existe como helper) en ambos.

---

#### **F6 · `plans.listEnCursoPacientesInClinics`: query por pacienteId** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `M`

> **Nota 2026-06-03 (cross-ref H2)**: la propuesta original (query con `or` clause sobre `by_pacienteId_estado`) queda **obsoleta** — Convex no soporta `or` con índices y la paginación manual es frágil. La solución acordada es `plansByClinicActive.count({ namespace: clinicId })` con backing aggregate filtrado en el trigger a `estado === "activo"` (ver H2 + plan de desarrollo, Fase 2 PR H6). Conteo O(log n) sin escanear memberships ni evaluar `isPlanEnCurso` per-row.

**Ubicación**: `convex/plans/queries.ts:160-174`.

**Detalle**: `Promise.all` de N queries (1 por paciente). Para una clínica con 100 pacientes = 100 queries paralelas.

**Propuesta**: query única con índice compuesto. Si `plans` tiene índice `by_estado` o `by_pacienteId_estado`, hacer una query global y filtrar:
```ts
const planesActivos = await ctx.db.query("plans")
  .withIndex("by_estado", q => q.eq("estado", "activo"))
  .collect();
const enCursoSet = new Set(planesActivos.filter(p => isPlanEnCurso(p, today) && pacienteIdSet.has(p.pacienteId)).map(p => p.pacienteId));
```
Solo si la tabla `plans` no es enorme. Si lo es, usar batched query con `or` clause sobre `by_pacienteId_estado` (no soportado nativamente en Convex — habría que paginar).

**Criterios de aceptación**: número de queries ≤ 2 independientemente del número de pacientes.

---

#### **F7 · Recompute inmediato de snapshots tras cada `execution`** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

> **Nota 2026-06-03 (cross-ref H5 + Fase 2 del plan)**: la propuesta de "marcar stale + cron compactor" queda **sustituida** por triggers del aggregate. El `scheduler.runAfter(0, recomputePatient, …)` desaparece por completo: cada `executions.insert` actualiza el aggregate en **la misma transacción** (no hay job diferido) y la UI lee los nuevos valores de inmediato vía `watchQuery`. El cron diario sigue existiendo, pero sólo para `riskScore` / `rachaActual` (heurísticas que no son agregaciones puras).

**Ubicación**: `convex/executions/mutations.ts` — `scheduler.runAfter(0, snapshots.recomputePatient, ...)` para 3 ventanas (7d, 15d, 30d).

**Detalle**: cada ejecución dispara 3 recomputes inmediatos por paciente + 3 por clínica. En horas pico (varios pacientes ejecutando a la vez), el scheduler acumula cola.

**Propuesta**:
- Cambiar a "mark stale + cron compactor": en mutation marca `snapshot.stale = true`; un cron cada N minutos procesa todos los stale en batch.
- O usar `scheduler.runAfter(60_000, ...)` (1 min de debounce) con deduplicación (si ya hay un recompute pending para ese paciente, no añadir otro).

**Criterios de aceptación**: número de `recomputePatient` ejecutados/hora baja en al menos 50% manteniendo la frescura de los datos en UI ≤ 1 minuto.

---

#### **F8 · Crons `recomputeAllPatients` y `recomputeAllClinics`** ![Media](https://img.shields.io/badge/Media-yellow) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

> **Nota 2026-06-03 (cross-ref H5/H6 + Fase 2 del plan)**: tras la Fase 2, estos crons se reducen a recalcular **sólo `riskScore`** (heurística que combina adherencia + inactividad + tendencia y no es agregación pura). `adherencia`, `dolorPromedio`, `pacientesActivos`, `adherenciaPromedio`, `dolorMedio` y `sesionesUltimos7d` pasan a leerse del aggregate sin escanear tablas. Estimación de reducción de bandwidth del cron `daily-maintenance`: ≥60%.

**Ubicación**: `convex/snapshots/internal.ts:398-435`.

**Detalle**: loops dobles (clínicas × 3 ventanas, pares paciente-clínica × 3 ventanas). Cron `daily-maintenance` (`convex/crons.ts:10-15`) los invoca todos. Hoy es viable pero escala lineal: 1000 clínicas activas → 3000 recomputes secuenciales.

**Propuesta**:
- Paralelizar con `Promise.all` para grupos pequeños (ej. 10 clínicas en paralelo).
- Saltar clínicas sin actividad en la ventana (`stale=false` y `lastExecutionDate < windowStart`).
- A futuro, sustituir cron único nocturno por procesado incremental basado en `stale=true`.

**Criterios de aceptación**: tiempo de ejecución del cron `daily-maintenance` permanece < 5 minutos aunque la base crezca a 1000 clínicas.

---

#### **F9 · Sin deduplicación de `watchQuery`** ![Baja](https://img.shields.io/badge/Baja-blue) ![Bajo](https://img.shields.io/badge/Bajo-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `apps/app/src/app/core/convex/convex.service.ts:188-248`.

**Detalle**: dos componentes que llaman `watchQuery(api.plans.list, sameArgs)` abren dos suscripciones independientes. Convex deduplica del lado del servidor (WebSocket), pero del lado cliente hay dos callbacks reaccionando al mismo update.

**Propuesta**: añadir un mapa por `(queryRef, argsHash)` en `ConvexService` con refcounting. La segunda llamada con la misma firma reutiliza la suscripción existente.

**Criterios de aceptación**: monitor reactivo muestra solo 1 suscripción real por query+args única en un momento dado.

---

### Bloque G — Caché y reactividad (notas, no acciones inmediatas)

#### **G1 · ServiceWorker con `lazy + prefetch`**
- `apps/app/ngsw-config.json:19-27`: assets `lazy install + prefetch update`. Correcto, salvo que después de A1 (reducir assets pesados) conviene auditar de nuevo.

#### **G2 · Sin TTL/caché aplicativo encima de Convex**
- Solo el cache de usuario (`session.service.ts:23` — 7 días en localStorage) tiene TTL. Convex `onUpdate` resuelve casi todos los casos. **No es un problema** — es una nota para entender el modelo de datos.

#### **G3 · `CustomRouteReuseStrategy` sin política documentada**
- `apps/app/src/app/core/config/route-reuse-strategy.ts`: cachea componentes al navegar. Bien para UX, pero conviene documentar qué rutas reusa y cuándo invalida — sino terminamos manteniendo estado stale por accidente.

---

### Bloque H — Aggregate component (`@convex-dev/aggregate`)

**Fecha de adición**: 2026-06-03 · **Estado**: evaluado, plan aprobado, sin código aún.

**Propósito del bloque**: documentar la introducción de `@convex-dev/aggregate` como palanca transversal que reemplaza el pipeline actual de snapshots/rollups (mantenido a base de `scheduler.runAfter` por execution + cron `daily-maintenance` con loops dobles) por **B-trees particionados por namespace** con escrituras O(log n) atómicas en la misma transacción que la mutation origen, y lecturas O(log n) para `count`, `sum`, `min`, `max`, `at`, `indexOf`, `paginate`, `random`.

**Aggregate vs snapshots actuales** (resumen):

| Aspecto | Snapshots (hoy) | Aggregate (Bloque H) |
|---------|----------------|---------------------|
| Frescura | ~1 s (scheduler runAfter 0) + cron diario | Transaccional (misma mutation) |
| Escritura | O(N) por recompute completo de ventana | O(log n) por insert |
| Lectura ordenada | `.collect()` + sort en memoria O(n log n) si no hay índice exacto | `.at(rank)` / `.paginate()` O(log n + k) |
| Conteo por ventana | Escan de 20 días con `.collect()` (F4, H3) | `.count({ bounds })` O(log n) |
| Atomicidad cross-table | Sin garantía (snapshots derivados) | Sí (trigger en misma transacción) |
| Coste de mantenimiento | Pipeline complejo de recompute (cron + on-write) | 1 línea por trigger por aggregate |
| Coste storage | Tabla `snapshot` denormalizada por ventana × paciente × clínica | Árboles internos (~O(n log n) nodos por aggregate) |
| Coste mutations | 3 recomputes per execution + cron diario | 1 update O(log n) por aggregate registrado |

**Riesgos generales del bloque** (detalle en cada ficha y en el plan):
- **Contención** por sortKey monotónico (`fecha`, `_creationTime`) — mitigado con namespacing por `clinicId` / `pacienteId`. En Kengo el peor caso (`executionsByClinic`) son ~1-2 escrituras/seg pico, dentro de tolerancia.
- **Cambio semántico de `dolorPromedio`** (avg de avgs por sesión → avg simple sobre executions). Aceptado en plan; pendiente validar diferencia <10% en cierre de Fase 2.
- **Eliminación irreversible** de `patientMetricsSnapshot` / `clinicMetricsSnapshot` en H9 — requiere 2 semanas de monitoring tras Fase 2 y dump previo (`npx convex export`).

**Estrategia transversal**: reemplazo directo por endpoint (sin doble escritura prolongada), validación shadow-read en dev/staging antes de cada PR, backfill paginado con `@convex-dev/migrations` (idempotente `insertIfDoesNotExist`).

**Plan ejecutable**: `~/.claude/plans/quiero-realizar-una-investigaci-n-sunny-muffin.md` (5 fases, 12 PRs, 3-4 semanas).

---

#### **H0 · Infraestructura del componente** ![Prerequisito](https://img.shields.io/badge/Prerequisito-lightgrey) ![—](https://img.shields.io/badge/—-lightgrey) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/package.json`, `convex/convex.config.ts`, `convex/aggregates/` (nuevo), `convex/_helpers/aggregateTriggers.ts` (nuevo).

**Detalle**: añadir `@convex-dev/aggregate` y `@convex-dev/migrations` a `convex/package.json`, registrar cada aggregate con un `name` propio en `convex.config.ts` (cada `app.use(aggregate, { name })` instancia un B-tree separado; sin esto los aggregates compartirían un único namespace y se pisarían) y crear el directorio `convex/aggregates/` con un archivo `TableAggregate` o `DirectAggregate` por cada uno: `executionsByPaciente`, `executionsByClinic`, `executionsByExercise`, `executionsByPacienteDolor`, `sessionsByClinic`, `plansByClinicActive`, `patientsByClinicAdherencia`, `patientsByClinicRiskScore`, `patientsByClinicDolor`.

**Propuesta**: ver Fase 0 del plan. Triggers vía `convex-helpers` para que cada `insert/update/delete` en la tabla origen actualice los aggregates relevantes en la misma transacción (si falla el `aggregate.insert`, la mutation revierte — invariante preservado).

**Criterios de aceptación**: `npx nx run convex:dev` arranca sin errores; un `.count()` sobre cualquier namespace de cualquier aggregate devuelve `0`; `convex/aggregates/README.md` documenta las decisiones de namespace/sortKey y las mitigaciones de contención (subir `maxNodeSize`, sortKey tuple `[fecha, _id]`, particionar namespace `clinicId` por día).

**Dependencias**: ninguna. Pre-requisito de H1-H9.

---

#### **H1 · `getPatientMetrics` ordenado por adherencia** ![Crítica](https://img.shields.io/badge/Crítica-red) ![Alto](https://img.shields.io/badge/Alto-orange) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/snapshots/queries.ts:46-56`.

**Detalle**: la rama `ordenarPor === "adherencia"` carga `.collect()` todos los snapshots de la clínica+ventana y los ordena en memoria con `.sort((a,b) => (a.adherencia ?? 101) - (b.adherencia ?? 101))` antes de hacer `.slice(0, limit)`. Con 200-1000 pacientes por clínica es O(n log n) cliente Convex pagado en cada lectura reactiva.

**Propuesta**: aggregate `patientsByClinicAdherencia` (`DirectAggregate`, namespace = `[clinicId, ventana]`, sortKey = `adherencia` number, id = `pacienteId`). Se alimenta desde `recomputePatient` (no por trigger sobre tabla, ya que `adherencia` es derivada). La query reescrita:
```ts
const top = await patientsByClinicAdherencia.paginate(ctx, {
  namespace: [args.clinicId, args.ventana],
  cursor: null,
  pageSize: limit,
});
const pacienteIds = top.page.map(item => item.id);
return await batchGetMap(ctx, "patientMetricsSnapshot", pacienteIds);
```
Hasta H9 el `batchGetMap` sigue leyendo del snapshot legacy; tras H9 se sustituye por `batchGetMap("patientDerivedMetrics", ...)`.

**Criterios de aceptación**:
- `.collect()` desaparece de `snapshots/queries.ts:46-56`.
- Shadow read sobre dataset seed compara orden devuelto vs versión legacy y verifica igualdad de `pacienteId` sequence.
- Latencia p95 < 50 ms (vs baseline actual a medir).

**Dependencias**: H0.

---

#### **H2 · Conteo `pacientesActivos` por clínica** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/snapshots/internal.ts:recomputeClinicForWindow` (cálculo de `pacientesActivos`) y `convex/plans/queries.ts:listEnCursoPacientesInClinics` (uso desde frontend).

**Detalle**: hoy se escanean memberships de la clínica y se evalúa `pacienteTienePlanEnCurso(pacienteId, today)` per-row → O(P × log n) donde P = pacientes de la clínica.

**Propuesta**: aggregate `plansByClinicActive` (`TableAggregate` sobre `plans`, namespace = `clinicId`, sortKey = `fechaFin`). El trigger filtra: sólo inserta si `estado === "activo"` Y `isPlanEnCurso(plan, today)`. Como `isPlanEnCurso` depende de la fecha actual, se complementa con un cron diario al amanecer Madrid que reevalúa el set (~1 escritura/plan/día que cambia de estado). El conteo de pacientes activos por clínica pasa a:
```ts
const pacientesActivos = await plansByClinicActive.count(ctx, { namespace: clinicId });
```
O(log n) sin tocar tabla `plans`.

**Criterios de aceptación**:
- `pacientesActivos` en `clinicMetricsSnapshot` (o su sucesor) coincide con el valor previo en un dataset de validación.
- `listEnCursoPacientesInClinics` se simplifica a `Promise.all(clinicIds.map(cid => plansByClinicActive.paginate(...)))`.

**Dependencias**: H0.

---

#### **H3 · `getActividadDiariaClinica` sin scan de 20 días** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: `convex/dashboard/queries.ts:144-152`.

**Detalle**: la query carga `.collect()` de todas las sesiones de los últimos 20 días de la clínica, las filtra (`esSintetica === true` se descarta) y construye `Map<fecha, count>` para contar sesiones por día. En clínicas activas con muchas sesiones esto se vuelve costoso.

**Propuesta**: aggregate `sessionsByClinic` (`TableAggregate` sobre `sessions`, namespace = `clinicId`, sortKey = `fecha` YYYY-MM-DD, `sumValue: doc => doc.esSintetica === true ? 0 : 1` — el sumValue 0/1 permite descartar sintéticas a nivel de aggregate sin tocar el query). La query reescrita:
```ts
const counts = await Promise.all(
  rangeOfDates(inicioPrevia, hoy).map(fecha =>
    sessionsByClinic.count(ctx, {
      namespace: args.clinicId,
      bounds: { lower: { key: fecha, inclusive: true }, upper: { key: fecha, inclusive: true } },
    }).then(c => [fecha, c] as const)
  )
);
```
O(20 × log n) en lugar de O(N) donde N = sesiones en 20 días.

**Criterios de aceptación**:
- `.collect()` desaparece de `dashboard/queries.ts:144-152`.
- `days[]`, `totalActual`, `totalAnterior` coinciden con la versión previa en staging.

**Dependencias**: H0.

---

#### **H4 · `exerciseUsageRollup` reemplazado por aggregate** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/snapshots/internal.ts:441-545` (`recomputeExerciseUsage`) y tabla `exerciseUsageRollup` en `convex/schema.ts:391-404`.

**Detalle**: el cron `recomputeExerciseUsage` escanea todas las executions del mes para cada clínica y agrupa por `exerciseId` para mantener un rollup `{vecesCompletado, vecesParcial, dolorMedio, pacientesUnicos}`. Es trabajo redundante respecto a lo que el aggregate hace gratis.

**Propuesta**: aggregate `executionsByExercise` (`TableAggregate` sobre `exerciseExecutions`, namespace = `[clinicId, exerciseId]`, sortKey = `fecha`, sumValue 1). Counts por ejercicio se obtienen con `.count({ namespace: [cid, exId], bounds: { lower: { key: anioMesInicio } } })`. La tabla `exerciseUsageRollup` y el cron se eliminan. **Caveat**: `pacientesUnicos` y `dolorMedio` requieren aggregates adicionales (`executionsByExerciseDolor` y, para unique patients, una estructura derivada — opción simple: mantener `pacientesUnicos` en un Set computado sólo cuando se necesite).

**Criterios de aceptación**:
- Tabla `exerciseUsageRollup` borrada del schema.
- Función `recomputeExerciseUsage` borrada.
- Habilita H7 sin trabajo adicional.

**Dependencias**: H0.

---

#### **H5 · `recomputePatientForWindow` adherencia/dolor desde aggregate** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/snapshots/internal.ts:recomputePatientForWindow` (~140 líneas, cierra ficha F7 y parte de F8).

**Detalle**: la función calcula `adherencia` y `dolorPromedio` recorriendo dailies de la ventana y agrupando ejecuciones por sesión ("promedio de promedios por sesión"). Trigger: cada execution + cron diario por 3 ventanas (7d/15d/30d) × pacientes activos.

**Propuesta**: aggregates `executionsByPaciente` (sumValue = `estado === "completado" ? 1 : 0`) y `executionsByPacienteDolor` (sumValue = `dolorEscala ?? 0`, sólo cuando `dolorEscala != null && estado === "completado"`). El recompute pasa a:
```ts
for (const ventana of ventanas) {
  const bounds = { lower: { key: windowStart(ventana), inclusive: true } };
  const sumCompletados = await executionsByPaciente.sum(ctx, { namespace: pacienteId, bounds });
  const totalExecs = await executionsByPaciente.count(ctx, { namespace: pacienteId, bounds });
  const adherencia = totalExecs > 0 ? sumCompletados / totalExecs : null;
  const sumDolor = await executionsByPacienteDolor.sum(ctx, { namespace: pacienteId, bounds });
  const countDolor = await executionsByPacienteDolor.count(ctx, { namespace: pacienteId, bounds });
  const dolorPromedio = countDolor > 0 ? sumDolor / countDolor : null;
  // rachaActual, ultimaActividad, riskScore: lógica custom (se queda en TS)
}
```
La función pasa de ~140 líneas a ~50.

**Caveat semántico**: `dolorPromedio` cambia de "promedio de promedios por sesión" a "promedio simple sobre ejecuciones con dolor reportado". Más robusto estadísticamente pero distinto. Validar con dato real que la diferencia es <10% en pacientes promedio antes de cerrar. Si fuese inaceptable, mantener cálculo legacy sólo para `dolorPromedio` y todo lo demás vía aggregate.

**Criterios de aceptación**:
- `recomputePatientForWindow` reducido a <60 líneas.
- Adherencia coincide bit a bit con la versión legacy en dataset de validación.
- Dolor promedio diff <10% documentado y aceptado.

**Dependencias**: H0.

---

#### **H6 · `recomputeClinicForWindow` agregados desde aggregate** ![Alta](https://img.shields.io/badge/Alta-orange) ![Alto](https://img.shields.io/badge/Alto-orange) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/snapshots/internal.ts:recomputeClinicForWindow`.

**Detalle**: calcula `adherenciaPromedio` (promedio de adherencia de snapshots de pacientes), `dolorMedio` (idem dolor), `sesionesUltimos7d` (count de sessions) y `pacientesActivos`. Recorre snapshots de todos los pacientes de la clínica.

**Propuesta**:
- `adherenciaPromedio` = `patientsByClinicAdherencia.sum / count` con `bounds` de la ventana.
- `dolorMedio` = aggregate análogo `patientsByClinicDolor`.
- `sesionesUltimos7d` = `sessionsByClinic.count({ namespace: clinicId, bounds: { lower: hace7d } })`.
- `pacientesActivos` = ver H2.
- `alertasPendientes` se mantiene query directa (volumen bajo, no candidato).

**Criterios de aceptación**:
- Todos los campos de `clinicMetricsSnapshot` (excepto `riskScore`-derivados) leen del aggregate.
- Tiempo de ejecución de `recomputeAllClinics` cae al menos 50%.

**Dependencias**: H0, H2.

---

#### **H7 · Nueva feature: "Ejercicio más usado por clínica esta semana"** ![—](https://img.shields.io/badge/Feature-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: nuevo query `convex/exercises/queries.ts:getTopExercisesByClinic` + nueva card en dashboard del fisio.

**Detalle**: actualmente no existe ninguna pantalla que muestre "ejercicio más prescrito/realizado" en una ventana temporal — el catálogo no tiene métrica de uso visible para el fisio. Cerrado el gap "top ejercicios" identificado en exploración frontend.

**Propuesta**: usando `executionsByExercise` (introducido en H4), iterar `exerciseIds` candidatos (o usar `.paginate` agrupando por namespace tuple `[clinicId, exerciseId]`) y devolver top-N por count en la ventana. UI: card opcional en `/inicio/fisio`.

**Criterios de aceptación**: card visible para el fisio cuando hay ≥3 ejercicios con uso en los últimos 7 días.

**Dependencias**: H0, H4.

---

#### **H8 · Nueva feature: "Top pacientes por adherencia"** ![—](https://img.shields.io/badge/Feature-blue) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Bajo](https://img.shields.io/badge/Bajo-green) `S`

**Ubicación**: nuevo query `convex/snapshots/queries.ts:getTopPatientsByAdherencia` + UI opcional.

**Detalle**: la app no tiene leaderboard ni ranking visible de pacientes por adherencia (gap identificado en exploración frontend).

**Propuesta**: `patientsByClinicAdherencia.paginate({ namespace: [clinicId, ventana] })` ordenado descendente. UI detrás de flag para evaluar engagement.

**Criterios de aceptación**: query devuelve top-N en <50 ms; UI muestra los 5-10 mejores con sus avatares.

**Dependencias**: H0, H1.

---

#### **H9 · Eliminación de tablas snapshot legacy** ![Media](https://img.shields.io/badge/Media-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) ![Medio](https://img.shields.io/badge/Medio-yellow) `M`

**Ubicación**: `convex/schema.ts:349-388` (definiciones de `patientMetricsSnapshot` y `clinicMetricsSnapshot`) + todos los consumers en `convex/` y `apps/app/src/`.

**Detalle**: una vez H1, H5, H6 estén en producción y validados durante ≥2 semanas, las tablas legacy ya no aportan valor. Sólo queda `riskScore`/`rachaActual`/`inactividadDias`/`ultimaActividad` como campos derivados que no son agregaciones puras.

**Propuesta**:
- Crear tabla mínima `patientDerivedMetrics` con `{ pacienteId, clinicId, ventana, riskScore, rachaActual, inactividadDias, ultimaActividad, actualizadoEn }` e índice `by_clinicId_ventana_riskScore`.
- Migración paginada `@convex-dev/migrations` que copia campos derivados desde `patientMetricsSnapshot` a `patientDerivedMetrics`.
- Borrar `patientMetricsSnapshot` y `clinicMetricsSnapshot` del schema.
- Actualizar `metricas-pacientes.service.ts` y `dashboard-fisio.service.ts` para leer aggregate + `patientDerivedMetrics`.

**Pre-requisito hard**: `grep -rn "patientMetricsSnapshot\|clinicMetricsSnapshot" convex/ apps/app/src/` debe devolver sólo la propia migración antes de mergear.

**Criterios de aceptación**:
- Tablas legacy eliminadas.
- `convex export` dump previo guardado durante 90 días.
- Bandwidth de storage Convex baja medible (~30-50% según volumen actual).

**Dependencias**: H1, H5, H6 en producción ≥2 semanas.

---

## 6. Anexos

### A. Patrones reutilizables que ya están en el código

- **`assetUrl(id, { fit, width, height, quality })`** (`apps/app/src/app/features/pacientes/.../pacientes-list.component.ts:275`) — construye URL de Convex/R2 con transformaciones. **Reusar en todas las imágenes** una vez se adopte `NgOptimizedImage` (`A2`).
- **`batchGetMap(ctx, table, ids)`** (helper Convex en `convex/_helpers/`) — get batched que evita N+1. **Usar en F3, F4, F5**.
- **`ConvexService.watchQuery`** (`apps/app/src/app/core/convex/convex.service.ts:188-248`) — gate de auth, desuscripción automática, integración con signals. Sin tocar.
- **`PageLoaderService`** (referenciado en `pacientes-list.component.ts:262`) — registro de `pageReady` por componente; permite que el shell muestre/oculte loading global. Reusar para coordinar `paciente-detail` (`E2`).

### B. Convenciones a establecer

1. **`@for` siempre con `track`** (`D1`). Idealmente con un lint rule.
2. **`OnPush` por defecto en componentes nuevos** (ya documentado en `apps/app/CLAUDE.md`, pero no se aplicó al 100%).
3. **`NgOptimizedImage` para todas las `<img>` nuevas** (`A2`).
4. **`takeUntilDestroyed` para cualquier `.subscribe()` en componentes** (`E3`).
5. **Lazy `await import()` para librerías solo-modal** (qrcode, pdfkit) (`B4`).

### C. Glosario de métricas

- **LCP** (Largest Contentful Paint): tiempo en que el elemento más grande del viewport aparece. Threshold "Good" < 2.5 s.
- **CLS** (Cumulative Layout Shift): suma de movimientos inesperados de elementos. Threshold "Good" < 0.1.
- **INP** (Interaction to Next Paint): peor latencia de interacción. Threshold "Good" < 200 ms. **No medido aquí** porque requiere interacción del usuario; pendiente de Lighthouse mobile en un plan de seguimiento.
- **TBT** (Total Blocking Time): suma de tareas largas. Threshold "Good" < 200 ms.
- **FCP** (First Contentful Paint): primer contenido pintado (texto o imagen).
- **TTFB** (Time To First Byte): primer byte de la respuesta HTTP.

### D. Cómo ampliar las mediciones en una sesión futura

1. **Lighthouse mobile**: `npx lighthouse http://localhost:4200/login --preset=mobile --output=html --output-path=./lh-login.html` (y para otras rutas). Captura LCP/CLS/INP/TBT con throttling de red 3G/4G.
2. **WebPageTest** (si se quiere medir desde un nodo geográfico real con SW poblado y vacío).
3. **`source-map-explorer`** sobre `chunk-GHEWJQFH.js`, `chunk-VQQ64ZC3.js`, `chunk-IZS4TLSW.js` para identificar qué pesa en initial.
4. **Instrumentar queries Convex** con `console.time` temporal en las hot (`exercises.listExercises`, `dashboard.planesPorVencer`) durante una sesión real para tener números de servidor.

### E. Lo que NO está cubierto y deberías saber

- **Capacitor / iOS / Android**: excluido por acuerdo. WebView en iOS tiene su propio behavior con SW (deshabilitado en native — `app.config.ts:22`).
- **Landing page** (`apps/landingpage/`): fuera de scope.
- **Backend Node (`apps/backend/`)**: fuera de scope.
- **Stripe billing**: las queries de Stripe (vía `@convex-dev/stripe`) no se han auditado — su uso es esporádico (suscripción) y no afecta el día a día.
- **Push notifications**: solo nativo; el código en `push-notification.service.ts` es no-op en web.
- **Tests**: no se ha evaluado cobertura ni performance de tests.

---

## Próximos pasos

Cuando decidas atacar la auditoría:
1. **Empezar por la Oleada 1** (sección 1 → hoja de ruta). Riesgo bajo, ROI alto, medible en una mañana.
2. **Medir antes/después** con Lighthouse mobile en `/login`, `/inicio/fisio`, `/mis-pacientes`, `/paciente-detail/:id`. Comparar con los baselines de la sección 3.2.
3. **Iterar** sobre Oleada 2 y 3 solo si la 1 no consigue los objetivos.

Este documento queda como referencia. Los hallazgos están numerados estables (A1-G3) para poder referenciarlos en PRs y commits futuros (ej. `fix(perf): A1 + A2 — portadas a WebP y NgOptimizedImage`).
