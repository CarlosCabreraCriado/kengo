# Plan: Rediseño del modelo de datos para registro de actividad

> Documento de implementación. Define el nuevo modelo de datos para el registro de la actividad del paciente (sesiones, ejecuciones, agregaciones) y el plan de migración por fases desde el modelo actual (`planRecords` + `dailyCompliance` + `clinicMetrics`).
>
> Este plan es **independiente** del análisis arquitectónico general (`/Users/carloscabrera/.claude/plans/quiero-que-realices-un-synchronous-aho.md`). Una vez completada esta migración, se reevaluará qué propuestas del plan original siguen siendo necesarias y cuáles han quedado resueltas.

---

## 1. Contexto y motivación

El modelo actual de registro de actividad presenta limitaciones que penalizarán el crecimiento de la plataforma:

- **Cada ejecución de ejercicio es un documento independiente** (`planRecords`), sin agrupación por sesión clínica. La sesión existe en el schema pero está infrautilizada (`sessionId` opcional).
- **Solo hay un nivel de agregación** (`dailyCompliance`). Métricas semanales/mensuales se calculan recorriendo días.
- **El dashboard del fisio** hace triple loop on-the-fly (fisios → planes → cumplimientos) → coste O(F·P·D).
- **Denormalizaciones se quedan stale** sin mecanismo de sincronización.
- **No existen métricas que el producto puede demandar**: frecuencia de uso de ejercicios, alertas automáticas (dolor alto, inactividad, adherencia baja), histogramas, scoring.
- **No hay política de retención** ni archivado de datos antiguos.

El rediseño introduce **tres capas claramente separadas** sobre la actividad del paciente:

1. **Write log inmutable**: `sessions` (la visita clínica) + `exerciseExecutions` (cada ejercicio realizado).
2. **Read models multinivel**: rollups por día/semana/mes y snapshots por paciente/clínica.
3. **Capa de alertas**: `physioAlerts` con tipos extendidos y severidad.

---

## Estado de implementación

> Vista rápida del avance del plan. Mantener este bloque y el §13 (checklist consolidado) sincronizados conforme se completan TODOs.

**Última actualización**: 2026-04-26

| Fase | Estado | Progreso | Bloqueadores |
|---|---|---|---|
| 0 — Preparación | NO INICIADA | 0 / 19 | — |
| 1 — Doble escritura | NO INICIADA | 0 / 27 | Fase 0 completa |
| 2 — Backfill histórico | NO INICIADA | 0 / 11 | Fase 1 estable ≥7 días |
| 3 — Conmutar lectores | NO INICIADA | 0 / 28 | Fase 2 validada |
| 4 — Funcionalidades nuevas | NO INICIADA | 0 / 6 | Fase 3 + decisiones AS2–AS5 |
| 5 — Apagar legacy | NO INICIADA | 0 / 8 | 30 días Fase 3 estables |
| Decisiones AS1–AS9 (paralelo) | NO INICIADA | 0 / 9 | — |
| Métricas post-Fase 5 | PENDIENTE | 0 / 3 | Fase 5 completa |

Estados permitidos: `NO INICIADA`, `EN CURSO`, `BLOQUEADA`, `COMPLETADA`.

**Total de TODOs**: 111. Detalle en §13. Próximos pasos inmediatos en §12.

---

## 2. Decisiones de negocio (validadas)

| # | Decisión | Valor confirmado |
|---|---|---|
| BN1 | Sesiones por día | **1 sesión por (paciente, día)**. Reanudable: si vuelve más tarde el mismo día, retoma la misma sesión. |
| BN2 | Planes por sesión | **Una sesión agrupa ejercicios de TODOS los planes activos del paciente**. Schema: `sessions.planIds: Id[]`. |
| BN3 | Frescura para el fisio | **Tiempo real**. El cierre de sesión actualiza síncronamente `patientMetricsSnapshot` y `clinicMetricsSnapshot`. |
| BN4 | Cierre de sesión | **Auto-cierre cuando se completa todo lo esperado del día**. Sin botón explícito. |
| BN5 | Comportamiento "más de lo esperado" | Si tras auto-cierre el paciente vuelve y registra más ejecuciones: **la sesión se reabre y se vuelve a cerrar al final del día** (cron 23:55 hora Madrid). |
| BN6 | Comportamiento "no completa todo" | Cron diario 23:55 marca la sesión como **`completada_parcial`** (no `abandonada`). |
| BN7 | Edición/borrado | **Inmutable**. Solo se permiten nuevas ejecuciones del día en curso. Sin edición retroactiva por paciente ni fisio. |
| BN8 | Backfill histórico | **1 sesión sintética por (paciente, día)** con `fechaInicio = min(fechaHora records)`, `fechaFin = max(fechaHora records)`. Agregados calculados desde records. |
| BN9 | Retención | **Indefinida**. Sin archivado automático ni borrado. (Reevaluable cuando supere ~10M docs.) |

### Defaults asumidos (validar antes de Fase 4)

| # | Asunción | Default propuesto |
|---|---|---|
| AS1 | Hora del cron de cierre nocturno | **23:55 hora Madrid** (Europe/Madrid) |
| AS2 | Umbral alerta `dolor_alto` | **dolorEscala ≥ 8** en al menos 1 ejecución de la sesión |
| AS3 | Umbral alerta `inactividad` | **≥ 5 días consecutivos sin sesión completada** y con plan activo |
| AS4 | Umbral alerta `adherencia_baja` | **adherencia < 50% en ventana de 7 días** y con plan activo |
| AS5 | Umbral alerta `tendencia_negativa` | **adherencia mensual cae > 20 puntos vs mes anterior** |
| AS6 | Ventanas de `patientMetricsSnapshot` | **7d, 30d, 365d** |
| AS7 | Notas | **Mantener `notaPaciente` en `exerciseExecutions` y añadir `observacionesPaciente` en `sessions`** |
| AS8 | Cron de mantenimiento existente | Se mantiene a 03:00 UTC; se le añaden tareas nuevas |
| AS9 | Migración de `physioNotifications` | Se renombra/extiende a `physioAlerts` con migración de datos existentes |

---

## 3. Modelo de datos nuevo (schema completo)

Todas las tablas se añaden a `convex/schema.ts`. Las tablas legacy (`planRecords`, `dailyCompliance`, `clinicMetrics`, `sessions` actual) **permanecen durante toda la migración** y se eliminan/marcan como deprecadas en la Fase 5.

### 3.1 Capa 1: Write log

#### `sessions` (rediseñada — sustituye a la actual)

```ts
sessions: defineTable({
  // identidad
  pacienteId: v.id("users"),
  clinicId: v.id("clinics"),
  planIds: v.array(v.id("plans")),       // todos los planes activos del paciente
                                          // a los que pertenecen sus ejecuciones

  // tiempo
  fecha: v.string(),                      // YYYY-MM-DD (clave para "1 por día")
  fechaInicio: v.string(),                // ISO timestamp
  fechaFin: v.optional(v.string()),       // ISO timestamp, null mientras esté abierta

  // estado
  estado: v.union(
    v.literal("en_curso"),
    v.literal("completada"),
    v.literal("completada_parcial"),
  ),
  motivoCierre: v.optional(v.union(
    v.literal("auto_completitud"),        // se completaron todos los esperados
    v.literal("cron_nocturno"),           // cron 23:55 cerró por fin de día
  )),

  // agregados pre-computados (se rellenan al cerrar y al reabrir)
  totalEsperados: v.number(),
  totalCompletados: v.number(),
  duracionTotalSeg: v.optional(v.number()),  // suma de duracionRealSeg
  dolorMin: v.optional(v.number()),
  dolorMax: v.optional(v.number()),
  dolorPromedio: v.optional(v.number()),
  esfuerzoPromedio: v.optional(v.number()),

  // observación general del paciente (opcional)
  observacionesPaciente: v.optional(v.string()),

  // marcado para backfill
  esSintetica: v.optional(v.boolean()),   // true para sesiones generadas en Fase 2
})
  .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
  .index("by_clinicId_fecha", ["clinicId", "fecha"])
  .index("by_estado_fechaInicio", ["estado", "fechaInicio"]),  // cron auto-cierre
```

**Justificación de campos**:
- `planIds` array porque BN2 (un paciente puede tener varios planes activos en una sesión).
- `estado` triple porque BN5/BN6 distinguen entre completada al 100% y completada parcial.
- `motivoCierre` para auditoría y métricas: ¿cuántas sesiones cierran por completitud vs por cron nocturno?
- `esSintetica` para identificar las generadas en backfill y excluirlas de métricas que requieran datos precisos (ej. duración).

#### `exerciseExecutions` (sustituye a `planRecords`)

```ts
exerciseExecutions: defineTable({
  // identidad
  sessionId: v.id("sessions"),            // OBLIGATORIO
  planExerciseId: v.id("planExercises"),

  // denormalizados MÍNIMOS (solo los que se usan en índices/agregaciones)
  pacienteId: v.id("users"),
  planId: v.id("plans"),
  clinicId: v.id("clinics"),

  // tiempo
  fecha: v.string(),                      // YYYY-MM-DD
  fechaHora: v.string(),                  // ISO timestamp

  // métricas
  completado: v.boolean(),
  repeticionesRealizadas: v.optional(v.number()),
  duracionRealSeg: v.optional(v.number()),
  dolorEscala: v.optional(v.number()),    // 1-10
  esfuerzoEscala: v.optional(v.number()), // 1-10
  notaPaciente: v.optional(v.string()),
})
  .index("by_sessionId", ["sessionId"])
  .index("by_pacienteId_fecha", ["pacienteId", "fecha"])
  .index("by_planExerciseId", ["planExerciseId"])
  .index("by_clinicId_fecha", ["clinicId", "fecha"])     // exerciseUsageRollup
  .index("by_planExerciseId_fecha", ["planExerciseId", "fecha"]),  // métricas por ejercicio
```

**Diferencias clave vs `planRecords`**:
- Sin `tituloPlan`, `nombreEjercicio` denormalizados (el detalle se obtiene desde `planExercises`/`exercises` cuando hace falta mostrar nombres).
- `sessionId` obligatorio.
- Mantiene `pacienteId/planId/clinicId` para indexar rollups sin joins.

### 3.2 Capa 2: Read models por paciente

#### `dailyPatientRollup` (sustituye a `dailyCompliance`)

```ts
dailyPatientRollup: defineTable({
  pacienteId: v.id("users"),
  fecha: v.string(),                      // YYYY-MM-DD

  // agregaciones por plan (para drill-down)
  planAggregates: v.array(v.object({
    planId: v.id("plans"),
    esperados: v.number(),
    completados: v.number(),
    dolorMedio: v.optional(v.number()),
  })),

  // totales del día
  totalEsperados: v.number(),
  totalCompletados: v.number(),
  dolorPromedio: v.optional(v.number()),
  esfuerzoPromedio: v.optional(v.number()),

  // estado derivado
  estadoDia: v.union(
    v.literal("completado"),     // 100% completados
    v.literal("parcial"),        // 0 < completados < esperados
    v.literal("fallido"),        // 0 completados con esperados > 0
    v.literal("descanso"),       // esperados = 0 según plan
    v.literal("sin_plan"),       // sin plan activo ese día
  ),

  // referencia para drill-down
  sessionIds: v.array(v.id("sessions")),

  // metadata
  actualizadoEn: v.number(),
})
  .index("by_pacienteId_fecha", ["pacienteId", "fecha"]),
```

#### `weeklyPatientRollup` (nueva)

```ts
weeklyPatientRollup: defineTable({
  pacienteId: v.id("users"),
  anioSemana: v.string(),                 // ISO 8601: "2026-W17"

  // recuentos
  diasCompletados: v.number(),
  diasParciales: v.number(),
  diasFallidos: v.number(),
  diasDescanso: v.number(),

  // métricas
  adherencia: v.number(),                 // % calculado
  dolorMedio: v.optional(v.number()),
  dolorMax: v.optional(v.number()),
  rachaMaxima: v.number(),                // dentro de la semana
  sesionesCount: v.number(),

  actualizadoEn: v.number(),
  stale: v.boolean(),                     // marcado por mutaciones, procesado en cron
})
  .index("by_pacienteId_anioSemana", ["pacienteId", "anioSemana"])
  .index("by_stale", ["stale"]),
```

#### `monthlyPatientRollup` (nueva)

```ts
monthlyPatientRollup: defineTable({
  pacienteId: v.id("users"),
  anioMes: v.string(),                    // "2026-04"

  diasCompletados: v.number(),
  diasParciales: v.number(),
  diasFallidos: v.number(),
  diasDescanso: v.number(),
  adherencia: v.number(),
  dolorMedio: v.optional(v.number()),
  dolorMax: v.optional(v.number()),
  rachaMaxima: v.number(),
  sesionesCount: v.number(),

  // tendencia
  tendenciaAdherencia: v.optional(v.number()),  // delta vs mes anterior

  actualizadoEn: v.number(),
  stale: v.boolean(),
})
  .index("by_pacienteId_anioMes", ["pacienteId", "anioMes"])
  .index("by_stale", ["stale"]),
```

### 3.3 Capa 2 bis: Snapshots para listas y dashboards

#### `patientMetricsSnapshot` (sustituye query `dashboard.patientMetrics`)

```ts
patientMetricsSnapshot: defineTable({
  pacienteId: v.id("users"),
  clinicId: v.id("clinics"),
  fisioId: v.id("users"),                 // primer fisio asignado (suficiente para queries)
  ventana: v.union(v.literal("7d"), v.literal("30d"), v.literal("365d")),

  // métricas
  adherencia: v.number(),
  dolorPromedio: v.optional(v.number()),
  ultimaActividad: v.optional(v.string()),  // YYYY-MM-DD
  inactividadDias: v.number(),
  rachaActual: v.number(),
  riskScore: v.number(),                  // 0-100, calculado a partir de inactividad+adherencia+tendencia

  actualizadoEn: v.number(),
})
  .index("by_clinicId_ventana_riskScore", ["clinicId", "ventana", "riskScore"])
  .index("by_fisioId_ventana_adherencia", ["fisioId", "ventana", "adherencia"])
  .index("by_pacienteId_ventana", ["pacienteId", "ventana"]),
```

#### `clinicMetricsSnapshot` (sustituye `clinicMetrics`)

```ts
clinicMetricsSnapshot: defineTable({
  clinicId: v.id("clinics"),
  ventana: v.union(v.literal("7d"), v.literal("30d"), v.literal("365d")),

  pacientesActivos: v.number(),
  adherenciaPromedio: v.number(),
  dolorMedio: v.optional(v.number()),
  sesionesUltimos7d: v.number(),
  tendenciaAdherencia: v.optional(v.number()),
  alertasPendientes: v.number(),

  actualizadoEn: v.number(),
})
  .index("by_clinicId_ventana", ["clinicId", "ventana"]),
```

#### `exerciseUsageRollup` (nueva — habilita métricas de uso)

```ts
exerciseUsageRollup: defineTable({
  clinicId: v.id("clinics"),
  exerciseId: v.id("exercises"),
  anioMes: v.string(),                    // "2026-04"

  vecesPrescrito: v.number(),             // count de planExercises activos con este exerciseId
  vecesCompletado: v.number(),            // count de exerciseExecutions completados
  vecesParcial: v.number(),               // count de exerciseExecutions no completados
  dolorMedio: v.optional(v.number()),
  dolorMax: v.optional(v.number()),
  pacientesUnicos: v.number(),

  actualizadoEn: v.number(),
})
  .index("by_clinicId_anioMes", ["clinicId", "anioMes"])
  .index("by_exerciseId_anioMes", ["exerciseId", "anioMes"]),
```

### 3.4 Capa 3: Alertas

#### `physioAlerts` (sustituye `physioNotifications` con tipos extendidos)

```ts
physioAlerts: defineTable({
  tipo: v.union(
    v.literal("comentario"),              // existente
    v.literal("dolor_alto"),              // existente (no usado)
    v.literal("inactividad"),             // nuevo
    v.literal("adherencia_baja"),         // nuevo
    v.literal("tendencia_negativa"),      // nuevo
  ),
  severidad: v.union(
    v.literal("info"),
    v.literal("warn"),
    v.literal("alta"),
  ),
  estado: v.union(
    v.literal("pendiente"),
    v.literal("revisada"),
    v.literal("descartada"),
  ),

  pacienteId: v.id("users"),
  clinicId: v.id("clinics"),
  generadoPor: v.union(
    v.literal("manual"),                  // creada por mutation explícita
    v.literal("evento_sesion"),           // disparada por sessions.close
    v.literal("regla_diaria"),            // generada en cron
  ),

  // payload variable según tipo (campos opcionales relevantes)
  sessionId: v.optional(v.id("sessions")),
  exerciseExecutionId: v.optional(v.id("exerciseExecutions")),
  texto: v.optional(v.string()),
  dolorEscala: v.optional(v.number()),
  inactividadDias: v.optional(v.number()),
  adherenciaPct: v.optional(v.number()),
  pacienteNombre: v.string(),             // denormalizado mínimo

  fechaGeneracion: v.string(),            // ISO
  fechaRevision: v.optional(v.string()),
  revisadaPor: v.optional(v.id("users")),
})
  .index("by_clinicId_estado", ["clinicId", "estado"])
  .index("by_clinicId_estado_severidad", ["clinicId", "estado", "severidad"])
  .index("by_pacienteId_estado", ["pacienteId", "estado"]),
```

---

## 4. Flujos de escritura

### 4.1 Apertura de sesión (implícita)

**Cuándo**: el paciente abre la app y registra el primer ejercicio del día.

**Flujo**:
```
mutation `sessions.openOrResume` (interna, llamada por exerciseExecutions.create):
  1. Read by_pacienteId_fecha (paciente, hoy)
  2. Si existe sesión "en_curso" → devuelve sessionId
  3. Si existe sesión "completada"/"completada_parcial" → la reabre (estado="en_curso") y devuelve sessionId
  4. Si no existe → insert nueva sesión (estado="en_curso", planIds = planes activos del paciente HOY,
                                          totalEsperados = calculado, totales=0)
```

### 4.2 Registro de ejecución

**Mutation pública**: `exerciseExecutions.create` (sustituye `records.create`).
**Mutation pública batch**: `exerciseExecutions.createBatch` (sustituye `records.createBatch`).

**Flujo del create (single)**:
```
1. Read planExercise (validar pertenencia)
2. Resolve sessionId vía sessions.openOrResume
3. Insert exerciseExecutions con denormalizados mínimos
4. Trigger interno: sessions.recomputeAggregatesAndCheckAutoClose(sessionId)
   - Read all exerciseExecutions by_sessionId
   - Recompute agregados de sesión (dolorMin/Max/Avg, esfuerzo, duración total, totales)
   - Si totalCompletados >= totalEsperados:
     - Update sesión: estado="completada", motivoCierre="auto_completitud", fechaFin=now
     - Trigger: rollups.recomputeDayAndPropagate(pacienteId, fecha)
   - Else: solo actualizar agregados, mantener estado="en_curso"
5. Si nota presente → insert physioAlerts tipo="comentario"
```

**Flujo del createBatch**: idéntico pero hace los inserts y la recomputación una sola vez al final.

### 4.3 Cierre de sesión (auto)

**Disparadores**:
- **Por completitud**: cuando `totalCompletados >= totalEsperados` tras un insert.
- **Por cron nocturno**: 23:55 hora Madrid, cierra todas las sesiones `en_curso` del día (estado → `completada_parcial`, `motivoCierre="cron_nocturno"`).

**Mutation interna**: `sessions.close`:
```
1. Update sessions: estado, motivoCierre, fechaFin
2. Trigger: rollups.recomputeDayAndPropagate(pacienteId, fecha)
3. Trigger alertas síncronas:
   - Si dolorMax >= 8 → insert physioAlerts tipo="dolor_alto", severidad="alta"
4. Trigger snapshots síncronos (BN3: tiempo real):
   - patientMetricsSnapshot.recompute(pacienteId, ventanas: [7d, 30d, 365d])
   - clinicMetricsSnapshot.recompute(clinicId, ventanas: [7d, 30d, 365d])
```

### 4.4 Reapertura de sesión

**Cuándo**: el paciente registra una ejecución después de que la sesión del día se haya cerrado (ej. quiere hacer "más de lo esperado").

**Flujo**: parte de `sessions.openOrResume` ya gestionado (paso 3 de 4.1):
```
- Update sesión: estado="en_curso", motivoCierre=null, fechaFin=null
- Continúa el flujo normal
- Volverá a auto-cerrar si vuelve a alcanzar totalEsperados (con el nuevo total) o por cron 23:55
```

### 4.5 Recomputación de rollups (post-write)

**Función interna**: `rollups.recomputeDayAndPropagate(pacienteId, fecha)`:
```
1. Recompute dailyPatientRollup(pacienteId, fecha) en tiempo real:
   - Read sessions by_pacienteId_fecha
   - Read planes activos en esa fecha → calcular esperados (igual que dailyCompliance hoy)
   - Calcular planAggregates, totales, estadoDia
   - Upsert idempotente
2. Mark stale weeklyPatientRollup(pacienteId, anioSemana(fecha))
3. Mark stale monthlyPatientRollup(pacienteId, anioMes(fecha))
```

Los rollups stale se procesan en el cron diario (ver §4.6).

### 4.6 Cron jobs

#### Nuevo cron `nightly-session-close` — 23:55 hora Madrid

```ts
crons.daily("nightly-session-close",
  { hourUTC: 22, minuteUTC: 55 },         // 22:55 UTC = 23:55 CET, 00:55 CEST (ajustar según mes)
  internal.sessions.internal.closeOpenSessionsAtEndOfDay
);
```

**Tarea**: para cada sesión `en_curso` con `fecha = ayer` (hora Madrid):
- Update estado="completada_parcial", motivoCierre="cron_nocturno", fechaFin=23:59:59
- Trigger rollups + snapshots + alertas (mismo flujo que close por completitud)

> **Nota sobre timezone**: hay que decidir si el "día" es UTC o hora Madrid. El campo `fecha` actual usa string YYYY-MM-DD; conviene definir explícitamente cuál es el TZ de referencia. Asumimos **Europe/Madrid** para coherencia con usuarios; el cron se calculará dinámicamente para soportar el cambio CET/CEST.

#### Cron `daily-maintenance` — 03:00 UTC (existente, ampliado)

Tareas existentes:
- Expirar planes vencidos (mantenida).
- Recalcular dailyCompliance (legacy, eliminada en Fase 5).

Tareas nuevas:
1. **Process stale weeklyPatientRollup** (recompute desde dailyPatientRollup × 7 días).
2. **Process stale monthlyPatientRollup** (recompute desde dailyPatientRollup × N días del mes).
3. **Recompute patientMetricsSnapshot** para todos los pacientes con plan activo (3 ventanas).
4. **Recompute clinicMetricsSnapshot** para todas las clínicas activas.
5. **Recompute exerciseUsageRollup** del mes en curso.
6. **Generate physioAlerts** de reglas diarias:
   - `inactividad`: pacientes con plan activo y `inactividadDias >= 5` sin alerta pendiente del mismo tipo.
   - `adherencia_baja`: pacientes con `adherencia (7d) < 50%` sin alerta pendiente.
   - `tendencia_negativa`: pacientes con `tendenciaAdherencia (mensual) < -20`.

---

## 5. Flujos de lectura

Mapeo de queries actuales → queries nuevas. Cada query existente del backend será reemplazada por una equivalente que lea de los nuevos read models.

| Query actual | Query nueva | Tabla(s) leída(s) | Reads |
|---|---|---|---|
| `records.queries.listByPacienteAndDate` | `executions.queries.listByPacienteAndDate` | `exerciseExecutions by_pacienteId_fecha` | O(N) ejecuciones del día |
| `records.queries.listByPacienteAndDateExpanded` | `sessions.queries.getByPacienteAndDateWithExecutions` | `sessions` + `exerciseExecutions by_sessionId` | 1 + N (acotado) |
| `records.queries.listByPacienteInRange` | `executions.queries.listByPacienteInRange` (paginada) | `exerciseExecutions by_pacienteId_fecha` | paginado |
| `records.queries.listByPacienteSinceDate` | reemplazada por rollups (semana/mes) | `dailyPatientRollup` | 7-30 |
| `compliance.queries.getByPaciente` | `rollups.queries.getDailyByPaciente` | `dailyPatientRollup by_pacienteId_fecha` | K días |
| `dashboard.queries.fisioSummary` | `dashboard.queries.fisioSummaryFromSnapshots` | `clinicMetricsSnapshot` + `physioAlerts` | O(C) |
| `dashboard.queries.patientMetrics` | `dashboard.queries.patientMetricsFromSnapshots` | `patientMetricsSnapshot by_clinicId_ventana_*` | 1 query indexada |

Y queries nuevas habilitadas:

| Query nueva | Caso de uso | Tabla(s) | Reads |
|---|---|---|---|
| `rollups.queries.getWeeklyByPaciente` | gráficas semanales históricas | `weeklyPatientRollup` | K semanas |
| `rollups.queries.getMonthlyByPaciente` | progreso mensual / gráfica anual | `monthlyPatientRollup` | 1-12 |
| `exercises.queries.getUsageByClinic` | "ejercicios más usados este mes" | `exerciseUsageRollup` | 1 query indexada |
| `alerts.queries.listPendingByClinic` | bandeja de alertas del fisio | `physioAlerts by_clinicId_estado` | paginado |

---

## 6. Plan de migración por fases

### Fase 0 — Preparación (1 día)

**Objetivo**: añadir las nuevas tablas al schema sin tocar lecturas/escrituras existentes.

**Tareas**:
1. Añadir tablas nuevas a `convex/schema.ts`:
   - `sessions` (rediseñada — añadir nuevos campos manteniendo compatibilidad con existentes vía `v.optional`)
   - `exerciseExecutions`
   - `dailyPatientRollup`
   - `weeklyPatientRollup`
   - `monthlyPatientRollup`
   - `patientMetricsSnapshot`
   - `clinicMetricsSnapshot`
   - `exerciseUsageRollup`
   - `physioAlerts`
2. Crear estructura de carpetas:
   ```
   convex/
     executions/      (queries.ts, mutations.ts)
     rollups/         (queries.ts, mutations.ts, internal.ts)
     snapshots/       (queries.ts, internal.ts)
     alerts/          (queries.ts, mutations.ts, internal.ts)
   ```
3. Implementar funciones internas helpers (sin exponerlas):
   - `_helpers/datetime.ts`: `getCurrentMadridDate()`, `anioSemanaISO()`, `anioMes()`, `madridCronHour()`.
   - `_helpers/rollupComputation.ts`: cálculos puros (totales, agregados, estado del día).
4. Tests unitarios de los helpers (sin BD).

**Criterios de éxito**:
- `npx convex dev` sin errores de schema.
- Tests de helpers pasan.
- Ningún cambio funcional visible.

**Reversión**: revertir el commit del schema.

---

### Fase 1 — Doble escritura (3-5 días)

**Objetivo**: que cada escritura en el modelo legacy se replique también en el modelo nuevo, sin tocar lecturas. El modelo legacy sigue siendo la fuente de verdad.

**Tareas**:

1. Implementar `executions.mutations.create` y `executions.mutations.createBatch`:
   - Copia de la lógica actual de `records.mutations` adaptada al nuevo schema.
   - Incluye `sessions.openOrResume`, recomputación de agregados, auto-cierre, snapshots síncronos.
   - Inserta ejecuciones, sesiones, rollups, snapshots, alertas.

2. Modificar `records.mutations.create` y `records.mutations.createBatch` para que ADEMÁS escriban en el nuevo modelo:
   - Tras el insert en `planRecords`, llama a `internal.executions.mutations.createFromLegacy` con los mismos datos.
   - Si la escritura nueva falla, **se loggea pero NO bloquea** la mutation legacy (objetivo: no romper producción).

3. Implementar `_helpers/legacyToNew.ts` para convertir documentos legacy a nuevos en runtime.

4. Implementar nuevo cron `nightly-session-close` (Fase 1 ya activo, aunque solo procesará sesiones del nuevo modelo).

5. Implementar tareas nuevas del `daily-maintenance` (rollups stale, snapshots, alertas) que solo procesarán datos del nuevo modelo.

6. Métricas de validación (logs estructurados):
   - Conteo de inserts en planRecords vs exerciseExecutions por día.
   - Discrepancias detectadas (logs de errores en escritura nueva).

**Criterios de éxito**:
- Después de N días en producción, conteo `planRecords = exerciseExecutions` (o discrepancia documentada).
- Logs sin errores en doble escritura.
- Sesiones se crean correctamente para nuevos pacientes.
- Snapshots se actualizan al cerrar sesión.

**Reversión**: comentar la llamada a `createFromLegacy` en `records.mutations`. Las nuevas tablas quedan con datos parciales, pero no afectan a nada (no hay lectores aún).

---

### Fase 2 — Backfill histórico (1-2 días de cron + validación)

**Objetivo**: poblar las nuevas tablas con todos los datos históricos de `planRecords` y `dailyCompliance`.

**Tareas**:

1. Internal mutation `migrations.backfillSessionsAndExecutions` (paginada para no exceder límites de Convex):
   - Itera `planRecords` agrupado por `(pacienteId, fecha)`.
   - Para cada grupo:
     - Crea 1 `sessions` con `esSintetica=true`, `fechaInicio = min(fechaHora)`, `fechaFin = max(fechaHora)`, `estado = "completada"` (o `completada_parcial` si totalCompletados < totalEsperados de ese día), `motivoCierre = null`.
     - Crea N `exerciseExecutions` desde los `planRecords` del grupo, asignando el `sessionId`.
     - Calcula agregados de la sesión.
2. Internal mutation `migrations.backfillRollupsFromExecutions`:
   - Para cada `(pacienteId, fecha)` con datos: upsert `dailyPatientRollup`.
   - Para cada `(pacienteId, anioSemana)`: upsert `weeklyPatientRollup`.
   - Para cada `(pacienteId, anioMes)`: upsert `monthlyPatientRollup`.
3. Internal mutation `migrations.backfillSnapshots`:
   - Para cada paciente activo: upsert `patientMetricsSnapshot` (3 ventanas).
   - Para cada clínica: upsert `clinicMetricsSnapshot` (3 ventanas).
   - Recompute `exerciseUsageRollup` para los últimos 12 meses.
4. Internal mutation `migrations.backfillAlertsFromNotifications`:
   - Migra `physioNotifications` (tipo `comentario`) a `physioAlerts`.
   - Tipo `dolor_alto` queda sin migrar (no había datos).
5. Script de validación (lee y compara):
   - Para 100 pacientes aleatorios: count `planRecords` == count `exerciseExecutions`.
   - Para 30 días aleatorios × 50 pacientes: agregaciones `dailyCompliance` vs `dailyPatientRollup` con tolerancia de error documentada.

**Ejecución**: vía Convex Dashboard (`npx convex run`) o internal action en producción. Paginación crítica: 100-500 docs por batch, scheduler.runAfter para encadenar.

**Criterios de éxito**:
- 100% de pacientes con planRecords tienen sesiones sintéticas.
- Conteos por (paciente, fecha) coinciden 1:1 entre planRecords y exerciseExecutions.
- dailyPatientRollup totales coinciden con dailyCompliance (±1% por edge cases en `esperados`).

**Reversión**: borrar todos los docs `esSintetica=true` y rollups generados antes del corte. (Mantener un timestamp del backfill facilita esto.)

---

### Fase 3 — Conmutar lectores (5-7 días, gradual)

**Objetivo**: migrar las queries del frontend (y backend) a los nuevos read models, una a una.

**Estrategia**: feature flag por query. Permite alternar lecturas legacy/nuevo sin redeployar.

**Tareas**: ordenar de menor a mayor riesgo, una por commit:

1. **Notificaciones / alertas** (riesgo bajo, datos simétricos):
   - Frontend: `notifications.service` → leer de `physioAlerts`.
   - Validar que la bandeja del fisio se sigue viendo correcta.

2. **Cumplimiento histórico del paciente**:
   - `cumplimiento.service.getCumplimiento` → leer de `dailyPatientRollup`.
   - Comparar visualmente con la versión legacy en preview.

3. **Estadísticas semanales/mensuales del paciente**:
   - `actividad-estadisticas.component` → leer de `weeklyPatientRollup` y `monthlyPatientRollup` para ventanas largas; mantener `exerciseExecutions` para "últimos 5 ejercicios".

4. **Calendario y actividad hoy** (ya leen del plan, no requiere cambio mayor):
   - Validar que `dailyPatientRollup` del día en curso refleja lo registrado.

5. **Detalle de sesión del fisio**:
   - `paciente-detail.component` historial agrupado → leer `sessions by_pacienteId_fecha` + `exerciseExecutions by_sessionId`.
   - **Mejora UX**: ahora cada sesión es 1 doc, no un grupo arbitrario por fecha.

6. **Tabla de pacientes con métricas** (alto impacto):
   - `pacientes-list.component` + `metricas-pacientes.service` → leer `patientMetricsSnapshot`.
   - Validar ordenación y filtrado.

7. **Dashboard fisio** (alto impacto, último por seguridad):
   - `dashboard-fisio.service` → leer `clinicMetricsSnapshot` + `physioAlerts`.

**Criterios de éxito por query**:
- Test E2E manual: comparar página antes/después.
- Métricas mostradas coinciden (con tolerancia documentada para casos edge).
- Latencia mejora (medible en Convex Dashboard).

**Reversión**: feature flag → vuelve a query legacy.

---

### Fase 4 — Activar nuevas funcionalidades (opcional, según producto)

**Objetivo**: encender las métricas y alertas que el modelo nuevo habilita.

**Tareas**:

1. **Alertas automáticas**:
   - Validar/ajustar umbrales con producto (AS2-AS5).
   - Publicar UI de bandeja de alertas mejorada (filtros por tipo/severidad).
   - Configurar notificaciones push/email (fuera del alcance técnico de este plan).

2. **Métricas nuevas**:
   - Vista "Ejercicios más usados" (`exerciseUsageRollup`).
   - Histograma de dolor por ejercicio.
   - Score de riesgo de abandono visible en tabla de pacientes.

3. **Mejoras UX de sesión**:
   - Vista de "tu sesión de hoy" con duración total al cerrar.
   - Histórico de sesiones con duración media, dolor medio, completitud.

**Criterio de éxito**: validación con 1-2 fisios reales antes de lanzar.

---

### Fase 5 — Apagar doble escritura y archivar legacy (1-2 días)

**Objetivo**: dejar el modelo nuevo como única fuente de verdad.

**Tareas**:

1. Eliminar la llamada a `createFromLegacy` en `records.mutations.create*`.
2. Marcar `records.mutations.*` y `records.queries.*` como deprecadas (comentario + log de deprecación).
3. Eliminar tareas de `daily-maintenance` que recalculaban `dailyCompliance` y `clinicMetrics`.
4. Hacer `planRecords`, `dailyCompliance`, `clinicMetrics`, `physioNotifications` y la `sessions` legacy **read-only** (sin mutations expuestas).
5. Período de validación de 30 días con doble lectura disponible vía feature flag (por si hay regresiones).
6. Tras periodo: eliminar las tablas legacy (drop schema) o mantenerlas como `_legacy` archive table.

**Criterios de éxito**:
- Cero llamadas a queries/mutations legacy en logs durante 30 días.
- Métricas en producción estables.

**Reversión**: si algo falla → restaurar feature flag de doble lectura.

---

## 7. Consideraciones operativas

### 7.1 Manejo de errores en doble escritura (Fase 1)

Política: **el modelo legacy NUNCA se rompe por fallos del modelo nuevo**.

```ts
// Pseudocódigo en records.mutations.create
const recordId = await ctx.db.insert("planRecords", {...});
try {
  await ctx.runMutation(internal.executions.mutations.createFromLegacy, {recordId, ...});
} catch (err) {
  console.error("[migration] dual-write failed", { recordId, err });
  // NO re-throw
}
```

### 7.2 Idempotencia en recálculo de rollups

Todos los `recompute*` deben ser idempotentes:
- Usar `upsert` (read + insert/update por índice).
- Si se ejecutan dos veces seguidas → mismo resultado.
- Permite re-ejecución segura tras fallos parciales.

### 7.3 Coste de escritura por sesión cerrada

Estimación de writes en una sesión típica (6 ejercicios):
- 6 inserts `exerciseExecutions`
- 1 update `sessions`
- 1 upsert `dailyPatientRollup`
- 2 marks "stale" (weekly + monthly)
- 1 upsert `patientMetricsSnapshot` × 3 ventanas = 3 writes
- 1 upsert `clinicMetricsSnapshot` × 3 ventanas = 3 writes
- 0-1 inserts `physioAlerts`
- **Total**: ~17 writes por sesión completa.

Comparado con el actual (~6 inserts planRecords + 1 upsert dailyCompliance = 7 writes), es un **+10 writes/sesión**. Aceptable dado el ahorro masivo en lecturas.

### 7.4 Timezone

El cron nocturno (`nightly-session-close`) debe respetar Europe/Madrid:
- Cron Convex se configura en UTC. Hay que ajustar dinámicamente para CET (22:55 UTC) o CEST (21:55 UTC).
- Alternativa: programar a 23:55 UTC (00:55-01:55 Madrid) y aceptar el desfase.
- **Recomendación**: usar 22:55 UTC fijo (= 23:55 CET / 00:55 CEST). Decidir con producto.

### 7.5 Volumetría estimada tras migración

Por paciente activo (3 planes, 5 ejercicios/día, 5 días/semana):
- ~150 `exerciseExecutions`/mes (igual que `planRecords` actual).
- ~22 `sessions`/mes (1 por día activo).
- ~30 `dailyPatientRollup`/mes.
- ~4 `weeklyPatientRollup`/mes.
- ~1 `monthlyPatientRollup`/mes.
- 3 `patientMetricsSnapshot` (estables, se actualizan in-place).

Para una clínica con 100 pacientes:
- ~15.000 executions/mes (igual que hoy).
- ~2.200 sessions/mes (nuevo).
- ~3.000 daily rollups/mes (vs 9.000 dailyCompliance hoy — REDUCCIÓN).
- ~400 weekly rollups/mes.
- ~100 monthly rollups/mes.

**Total docs nuevos por clínica/mes**: ~6.000 (vs ~9.000 hoy). En conjunto, **menos** documentos pero mejor estructurados.

---

## 8. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Doble escritura introduce latencia perceptible | Media | Bajo | La nueva escritura es asíncrona vía `scheduler.runAfter(0)` para no bloquear la respuesta legacy. |
| R2 | Backfill genera carga inadmisible en producción | Media | Medio | Paginación de 100-500 docs por batch, ejecución nocturna, monitoring durante. |
| R3 | Snapshots desincronizados tras la migración | Baja | Medio | Cron diario actúa como red de seguridad — recalcula todo desde rollups. |
| R4 | Sesiones sintéticas con datos imprecisos confunden al fisio | Media | Bajo | Marcar `esSintetica=true` y mostrar etiqueta UI (ej. "datos importados"). |
| R5 | Cron nocturno falla y deja sesiones abiertas indefinidas | Baja | Medio | Monitoring + reintentos. Si una sesión queda abierta varios días, el siguiente cron la cierra. |
| R6 | Fase 3 (conmutar lectores) introduce regresiones | Media | Alto | Feature flags por query; rollback inmediato. Comparativa visual obligatoria por query. |
| R7 | Volumetría real supera estimaciones | Baja | Medio | Convex escala. Si snapshots×3 ventanas resulta caro, reducir a 30d únicamente. |
| R8 | Producto pide cambios al modelo en mitad de la migración | Media | Alto | Cerrar el alcance antes de empezar; cambios mayores → bloquear hasta Fase 5. |

---

## 9. Verificación end-to-end

### 9.1 Tests unitarios (Fase 0)

- Helpers de datetime (anioSemana ISO, anioMes, conversión TZ).
- Helpers de rollup computation (cálculo de estado del día, agregados).

### 9.2 Tests de integración (Fase 1)

- Insert ejecución → sesión creada/reanudada.
- Insert ejecución que completa todos los esperados → sesión auto-cerrada.
- Insert ejecución después de sesión cerrada → sesión reabierta.
- Cron nocturno cierra sesiones en_curso del día anterior.
- Update de sesión recalcula dailyPatientRollup.

### 9.3 Validación de backfill (Fase 2)

Script de comparación que para 1.000 muestras aleatorias verifica:
- `count(planRecords by paciente, día) == count(exerciseExecutions by paciente, día)`.
- `dailyCompliance.ejerciciosCompletados ≈ dailyPatientRollup.totalCompletados` (±1).
- `clinicMetrics.adherenciaPromedio ≈ clinicMetricsSnapshot[30d].adherenciaPromedio` (±1pp).

### 9.4 Validación visual (Fase 3)

Por cada query migrada, comparativa side-by-side en preview:
- Misma página, datos legacy vs datos nuevo.
- Capturas guardadas en PR para revisión.

### 9.5 Métricas de éxito post-Fase 5

- Latencia de queries de dashboard: **−80%** (target).
- Reads facturables por sesión cerrada: **−70%** (target, gracias a snapshots).
- Cero discrepancias en métricas mostradas durante 30 días.

---

## 10. Archivos principales afectados

### Backend Convex

| Archivo | Acción | Fase |
|---|---|---|
| `convex/schema.ts` | Añadir tablas nuevas | 0 |
| `convex/_helpers/datetime.ts` | Crear | 0 |
| `convex/_helpers/rollupComputation.ts` | Crear | 0 |
| `convex/sessions/queries.ts` | Reescribir | 1 |
| `convex/sessions/mutations.ts` | Reescribir | 1 |
| `convex/sessions/internal.ts` | Crear (openOrResume, close, recomputeAggregates) | 1 |
| `convex/executions/queries.ts` | Crear | 1 |
| `convex/executions/mutations.ts` | Crear | 1 |
| `convex/rollups/queries.ts` | Crear | 1 |
| `convex/rollups/internal.ts` | Crear | 1 |
| `convex/snapshots/queries.ts` | Crear | 1 |
| `convex/snapshots/internal.ts` | Crear | 1 |
| `convex/alerts/queries.ts` | Crear | 1 |
| `convex/alerts/mutations.ts` | Crear | 1 |
| `convex/alerts/internal.ts` | Crear | 1 |
| `convex/records/mutations.ts` | Modificar para doble escritura | 1 |
| `convex/crons.ts` | Añadir nightly-session-close + ampliar daily-maintenance | 1 |
| `convex/migrations/sessions.ts` | Crear (backfill) | 2 |
| `convex/migrations/rollups.ts` | Crear (backfill) | 2 |
| `convex/migrations/snapshots.ts` | Crear (backfill) | 2 |
| `convex/notifications/*` | Mantener hasta Fase 5 | — |
| `convex/records/*` | Marcar deprecadas en Fase 5 | 5 |
| `convex/compliance/*` | Eliminar tareas de cron en Fase 5 | 5 |

### Frontend Angular

| Archivo | Acción | Fase |
|---|---|---|
| `apps/app/src/app/features/sesion/data-access/registro-sesion.service.ts` | Migrar a `executions.mutations.createBatch` | 3 |
| `apps/app/src/app/features/actividad/data-access/actividad-hoy.service.ts` | Leer de `dailyPatientRollup` | 3 |
| `apps/app/src/app/features/actividad/components/actividad-estadisticas.component.ts` | Leer de weekly/monthly rollups | 3 |
| `apps/app/src/app/features/actividad/components/actividad-calendario.component.ts` | Leer de dailyPatientRollup × ventana | 3 |
| `apps/app/src/app/features/pacientes/data-access/cumplimiento.service.ts` | Leer de `dailyPatientRollup` | 3 |
| `apps/app/src/app/features/pacientes/data-access/metricas-pacientes.service.ts` | Leer de `patientMetricsSnapshot` | 3 |
| `apps/app/src/app/features/pacientes/components/pacientes-list.component.ts` | Adaptar a nuevo formato de métricas | 3 |
| `apps/app/src/app/features/pacientes/components/paciente-detail.component.ts` | Mostrar histórico por sesiones | 3 |
| `apps/app/src/app/features/pacientes/components/sesion-detail.component.ts` | Leer de `sessions` + `exerciseExecutions` | 3 |
| `apps/app/src/app/features/dashboard/data-access/dashboard-fisio.service.ts` | Leer de `clinicMetricsSnapshot` | 3 |
| `apps/app/src/app/features/notificaciones/data-access/notificaciones.service.ts` | Migrar a `physioAlerts` | 3 |

---

## 11. Estimación de esfuerzo

| Fase | Esfuerzo (1 dev senior, 50% dedicación) | Esfuerzo (full-time) |
|---|---|---|
| 0 — Preparación | 2 días | 1 día |
| 1 — Doble escritura | 8-10 días | 4-5 días |
| 2 — Backfill | 3-4 días | 1-2 días |
| 3 — Conmutar lectores | 10-14 días | 5-7 días |
| 4 — Funcionalidades nuevas | depende de producto | depende de producto |
| 5 — Apagar legacy | 2 días | 1 día |
| **Total (sin Fase 4)** | **~25-32 días** | **~12-16 días** |

---

## 12. Próximos pasos inmediatos

1. **Validar este plan** con el equipo (técnico + producto).
2. **Resolver decisiones AS1-AS9** (defaults asumidos en §2): timezone, umbrales, ventanas.
3. **Crear branch dedicada** (`migration/records-redesign`) para todas las fases.
4. **Aprobar criterio de éxito** de cada fase antes de comenzar la siguiente.
5. **Definir métricas de monitoring** (latencia de queries, conteo de doble escritura) antes de Fase 1.
6. Comenzar **Fase 0** (schema + helpers).

---

## 13. Checklist consolidado de TODOs

> Lista única de tareas para tracking del progreso. Cada tarea referencia su sección detallada en el plan. Reglas de uso al final de la sección.

### Fase 0 — Preparación (ref §6 Fase 0)

**Schema** (`convex/schema.ts`):
- [ ] 0.1 Añadir tabla `sessions` rediseñada (campos nuevos opcionales para compat con la `sessions` actual)
- [ ] 0.2 Añadir tabla `exerciseExecutions` con índices `by_sessionId`, `by_pacienteId_fecha`, `by_planExerciseId`, `by_clinicId_fecha`, `by_planExerciseId_fecha`
- [ ] 0.3 Añadir tabla `dailyPatientRollup` con índice `by_pacienteId_fecha`
- [ ] 0.4 Añadir tabla `weeklyPatientRollup` con índices `by_pacienteId_anioSemana`, `by_stale`
- [ ] 0.5 Añadir tabla `monthlyPatientRollup` con índices `by_pacienteId_anioMes`, `by_stale`
- [ ] 0.6 Añadir tabla `patientMetricsSnapshot` con índices `by_clinicId_ventana_riskScore`, `by_fisioId_ventana_adherencia`, `by_pacienteId_ventana`
- [ ] 0.7 Añadir tabla `clinicMetricsSnapshot` con índice `by_clinicId_ventana`
- [ ] 0.8 Añadir tabla `exerciseUsageRollup` con índices `by_clinicId_anioMes`, `by_exerciseId_anioMes`
- [ ] 0.9 Añadir tabla `physioAlerts` con índices `by_clinicId_estado`, `by_clinicId_estado_severidad`, `by_pacienteId_estado`

**Estructura de carpetas**:
- [ ] 0.10 Crear `convex/executions/` con `queries.ts`, `mutations.ts`
- [ ] 0.11 Crear `convex/rollups/` con `queries.ts`, `mutations.ts`, `internal.ts`
- [ ] 0.12 Crear `convex/snapshots/` con `queries.ts`, `internal.ts`
- [ ] 0.13 Crear `convex/alerts/` con `queries.ts`, `mutations.ts`, `internal.ts`

**Helpers**:
- [ ] 0.14 Crear `convex/_helpers/datetime.ts` (`getCurrentMadridDate`, `anioSemanaISO`, `anioMes`, `madridCronHour`)
- [ ] 0.15 Crear `convex/_helpers/rollupComputation.ts` (cálculos puros: totales, agregados, estado del día)

**Tests**:
- [ ] 0.16 Tests unitarios de `_helpers/datetime.ts`
- [ ] 0.17 Tests unitarios de `_helpers/rollupComputation.ts`

**Verificación**:
- [ ] 0.18 `npx convex dev` sin errores de schema
- [ ] 0.19 Tests de helpers pasan en CI

### Fase 1 — Doble escritura (ref §6 Fase 1)

**Mutations nuevas**:
- [ ] 1.1 Implementar `executions.mutations.create`
- [ ] 1.2 Implementar `executions.mutations.createBatch`
- [ ] 1.3 Implementar `sessions.openOrResume` (interna)
- [ ] 1.4 Implementar `sessions.recomputeAggregatesAndCheckAutoClose` (interna)
- [ ] 1.5 Implementar `sessions.close` (interna) con triggers a rollups + snapshots + alertas
- [ ] 1.6 Implementar `rollups.recomputeDayAndPropagate` (interna)
- [ ] 1.7 Implementar `snapshots.recomputePatient` y `snapshots.recomputeClinic` (3 ventanas)

**Doble escritura**:
- [ ] 1.8 Crear helper `convex/_helpers/legacyToNew.ts`
- [ ] 1.9 Modificar `records.mutations.create` para invocar `internal.executions.mutations.createFromLegacy` con manejo no-bloqueante (ref §7.1)
- [ ] 1.10 Modificar `records.mutations.createBatch` con la misma estrategia
- [ ] 1.11 Logs estructurados de validación (conteos `planRecords` vs `exerciseExecutions`, errores)

**Crons**:
- [ ] 1.12 Crear cron `nightly-session-close` (22:55 UTC, ref §7.4)
- [ ] 1.13 Ampliar `daily-maintenance`: procesar stale `weeklyPatientRollup`
- [ ] 1.14 Ampliar `daily-maintenance`: procesar stale `monthlyPatientRollup`
- [ ] 1.15 Ampliar `daily-maintenance`: recompute `patientMetricsSnapshot` (3 ventanas)
- [ ] 1.16 Ampliar `daily-maintenance`: recompute `clinicMetricsSnapshot` (3 ventanas)
- [ ] 1.17 Ampliar `daily-maintenance`: recompute `exerciseUsageRollup` mes en curso
- [ ] 1.18 Ampliar `daily-maintenance`: generar alertas de reglas diarias (`inactividad`, `adherencia_baja`, `tendencia_negativa`)

**Tests de integración** (ref §9.2):
- [ ] 1.19 Test: insert ejecución → sesión creada o reanudada
- [ ] 1.20 Test: insert que completa todos los esperados → auto-cierre por completitud
- [ ] 1.21 Test: insert tras sesión cerrada → reapertura
- [ ] 1.22 Test: cron nocturno cierra sesiones `en_curso` del día anterior
- [ ] 1.23 Test: update de sesión recalcula `dailyPatientRollup`

**Criterios de éxito Fase 1**:
- [ ] 1.24 Conteo `planRecords ≈ exerciseExecutions` por día (en producción ≥7 días)
- [ ] 1.25 Logs sin errores en doble escritura durante ≥7 días
- [ ] 1.26 Sesiones se crean correctamente para nuevos pacientes (verificación manual)
- [ ] 1.27 Snapshots se actualizan al cerrar sesión (verificación manual)

### Fase 2 — Backfill histórico (ref §6 Fase 2)

**Migrations**:
- [ ] 2.1 Implementar `migrations.backfillSessionsAndExecutions` (paginada, idempotente)
- [ ] 2.2 Implementar `migrations.backfillRollupsFromExecutions` (daily/weekly/monthly)
- [ ] 2.3 Implementar `migrations.backfillSnapshots` (patient/clinic + `exerciseUsageRollup` últimos 12 meses)
- [ ] 2.4 Implementar `migrations.backfillAlertsFromNotifications`

**Validación**:
- [ ] 2.5 Script: `count(planRecords) == count(exerciseExecutions)` por (paciente, día) en 100 pacientes aleatorios
- [ ] 2.6 Script: `dailyCompliance ≈ dailyPatientRollup` en 30 días × 50 pacientes (±1%)
- [ ] 2.7 Script: `clinicMetrics ≈ clinicMetricsSnapshot[30d]` (±1pp)

**Ejecución**:
- [ ] 2.8 Ejecutar backfill en preview/staging y validar
- [ ] 2.9 Ejecutar backfill en producción (paginado, monitoreado)

**Criterios de éxito Fase 2**:
- [ ] 2.10 100% pacientes con `planRecords` tienen sesiones sintéticas (`esSintetica=true`)
- [ ] 2.11 Conteos paciente×fecha coinciden 1:1 entre `planRecords` y `exerciseExecutions`

### Fase 3 — Conmutar lectores (ref §6 Fase 3)

> Cada query se migra mediante feature flag, validación visual side-by-side y retirada del flag tras estable.

**3.1 Notificaciones → `physioAlerts`** (riesgo bajo):
- [ ] 3.1.a Feature flag para alternar entre `physioNotifications` y `physioAlerts`
- [ ] 3.1.b Migrar `notificaciones.service.ts` a leer de `alerts.queries`
- [ ] 3.1.c Comparativa visual de bandeja de fisio antes/después
- [ ] 3.1.d Retirar feature flag tras estable

**3.2 Cumplimiento histórico → `dailyPatientRollup`**:
- [ ] 3.2.a Feature flag
- [ ] 3.2.b Migrar `cumplimiento.service.ts` a `rollups.queries.getDailyByPaciente`
- [ ] 3.2.c Comparativa visual
- [ ] 3.2.d Retirar feature flag

**3.3 Estadísticas semanales/mensuales → weekly/monthly rollups**:
- [ ] 3.3.a Feature flag
- [ ] 3.3.b Migrar `actividad-estadisticas.component.ts` a leer de weekly/monthly rollups (mantener `exerciseExecutions` para "últimos 5")
- [ ] 3.3.c Comparativa visual
- [ ] 3.3.d Retirar feature flag

**3.4 Calendario / actividad hoy**:
- [ ] 3.4.a Validar que `dailyPatientRollup` del día en curso refleja lo registrado
- [ ] 3.4.b Ajustes en `actividad-hoy.service.ts` y `actividad-calendario.component.ts` si necesario

**3.5 Detalle de sesión del fisio → `sessions` + `exerciseExecutions`**:
- [ ] 3.5.a Feature flag
- [ ] 3.5.b Migrar `paciente-detail.component.ts` y `sesion-detail.component.ts`
- [ ] 3.5.c Comparativa visual (UX mejorada: 1 doc por sesión)
- [ ] 3.5.d Retirar feature flag

**3.6 Tabla de pacientes con métricas → `patientMetricsSnapshot`** (alto impacto):
- [ ] 3.6.a Feature flag
- [ ] 3.6.b Migrar `metricas-pacientes.service.ts` y `pacientes-list.component.ts`
- [ ] 3.6.c Comparativa visual: ordenación + filtrado correctos
- [ ] 3.6.d Validar latencia (Convex Dashboard)
- [ ] 3.6.e Retirar feature flag

**3.7 Dashboard fisio → `clinicMetricsSnapshot` + `physioAlerts`** (alto impacto, último):
- [ ] 3.7.a Feature flag
- [ ] 3.7.b Migrar `dashboard-fisio.service.ts`
- [ ] 3.7.c Comparativa visual
- [ ] 3.7.d Validar latencia
- [ ] 3.7.e Retirar feature flag

### Fase 4 — Funcionalidades nuevas (ref §6 Fase 4)

- [ ] 4.1 Validar/ajustar umbrales AS2–AS5 con producto
- [ ] 4.2 UI de bandeja de alertas con filtros por tipo y severidad
- [ ] 4.3 Vista "Ejercicios más usados" desde `exerciseUsageRollup`
- [ ] 4.4 Histograma de dolor por ejercicio
- [ ] 4.5 Risk score visible en tabla de pacientes
- [ ] 4.6 Mejoras UX de sesión (duración total al cerrar, histórico con duración/dolor/completitud)

### Fase 5 — Apagar doble escritura y archivar legacy (ref §6 Fase 5)

- [ ] 5.1 Eliminar llamada a `createFromLegacy` en `records.mutations.create*`
- [ ] 5.2 Marcar `records.mutations.*` y `records.queries.*` como deprecadas (comentario + log)
- [ ] 5.3 Eliminar tareas de `daily-maintenance` que recalculaban `dailyCompliance` y `clinicMetrics`
- [ ] 5.4 Hacer read-only: `planRecords`, `dailyCompliance`, `clinicMetrics`, `physioNotifications`, `sessions` legacy
- [ ] 5.5 Configurar feature flag de doble lectura por 30 días
- [ ] 5.6 Tras 30 días sin regresiones: drop schema legacy o renombrado a `_legacy`
- [ ] 5.7 Cero llamadas a queries/mutations legacy en logs durante 30 días (verificación)
- [ ] 5.8 Métricas en producción estables tras 30 días (verificación)

### Decisiones AS1–AS9 (ref §2, antes de Fase 4)

- [ ] AS1 Confirmar hora exacta del cron de cierre nocturno (22:55 UTC fijo vs ajuste CET/CEST)
- [ ] AS2 Confirmar umbral `dolor_alto` (default: dolorEscala ≥ 8)
- [ ] AS3 Confirmar umbral `inactividad` (default: ≥5 días consecutivos sin sesión)
- [ ] AS4 Confirmar umbral `adherencia_baja` (default: <50% en 7d)
- [ ] AS5 Confirmar umbral `tendencia_negativa` (default: caída >20pp mensual)
- [ ] AS6 Confirmar ventanas de `patientMetricsSnapshot` (default: 7d, 30d, 365d)
- [ ] AS7 Confirmar dualidad de notas (`notaPaciente` en ejecución + `observacionesPaciente` en sesión)
- [ ] AS8 Confirmar mantenimiento del cron `daily-maintenance` a 03:00 UTC
- [ ] AS9 Confirmar estrategia de migración de `physioNotifications` → `physioAlerts`

### Métricas post-Fase 5 (ref §9.5)

- [ ] M1 Latencia de queries dashboard: −80% (target)
- [ ] M2 Reads facturables por sesión cerrada: −70% (target)
- [ ] M3 Cero discrepancias en métricas mostradas durante 30 días

---

### Reglas de uso del checklist

1. **Marcar `- [x]`** cuando una TODO se complete; idealmente en el commit que la cierra.
2. **Actualizar la tabla "Estado de implementación"** al inicio del documento cuando una fase pase de NO INICIADA → EN CURSO → COMPLETADA, y refrescar progreso (`X / N`).
3. **Actualizar "Última actualización"** cada vez que se modifique cualquier estado.
4. **No reordenar ni renombrar TODOs existentes** — si el alcance cambia, añadir TODOs nuevos al final de su fase con prefijo `(adición)`.
5. Cada TODO tiene un código (ej. `2.5`, `3.6.b`, `AS1`) para referenciar en commits, PRs y discusiones.

---

> **Documento vivo**. Actualizar tras cada fase con lecciones aprendidas y desviaciones del plan.
