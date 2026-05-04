# Auditoría de zonas horarias en planificación y registro de sesiones

> **Fecha de la auditoría:** 2026-05-03
> **Alcance:** flujo end-to-end de planificación diaria y registro de sesiones de ejercicio del paciente, desde el cliente Angular hasta Convex.
> **Estado:** documento de hoja de ruta. **Ningún código se ha modificado todavía.** Cada apartado del [Inventario de bugs](#5-inventario-de-bugs) incluye snippet actual y snippet propuesto.

---

## Índice

1. [Resumen ejecutivo (TL;DR)](#1-resumen-ejecutivo-tldr)
2. [Reproducción del síntoma observado](#2-reproducción-del-síntoma-observado)
3. [Modelo mental y glosario](#3-modelo-mental-y-glosario)
4. [Arquitectura: cómo el backend razona en Madrid](#4-arquitectura-cómo-el-backend-razona-en-madrid)
5. [Decisión arquitectónica: ¿por qué no migrar a "todo UTC"?](#5-decisión-arquitectónica-por-qué-no-migrar-a-todo-utc)
6. [Inventario de bugs](#6-inventario-de-bugs)
7. [Causa raíz consolidada](#7-causa-raíz-consolidada)
8. [Plan de remediación por fases](#8-plan-de-remediación-por-fases)
9. [Roadmap futuro: pasarse a `timezone` por usuario](#9-roadmap-futuro-pasarse-a-timezone-por-usuario)
10. [Verificación end-to-end](#10-verificación-end-to-end)
11. [Anexo A — Tabla "ubicación → fix"](#11-anexo-a--tabla-ubicación--fix)
12. [Anexo B — Preguntas abiertas](#12-anexo-b--preguntas-abiertas)

---

## 1. Resumen ejecutivo (TL;DR)

- **Síntoma observado:** en `/actividad-personal/estadisticas → Historial reciente` aparecen sesiones marcadas como "Descanso" con métricas de dolor (`Dolor X/10`). Es lógicamente imposible si en un día de descanso no se realizan ejercicios.
- **A quién afecta:**
  - **Siempre y de forma sistemática:** pacientes en zonas horarias distintas a `Europe/Madrid` (Canarias UTC+0 invierno / UTC+1 verano).
  - **Cada noche en una franja horaria:** pacientes en Península que registran ejercicios entre `00:00` y `02:00 Madrid` (durante el horario de verano). En esa franja la fecha UTC ya cambió pero la fecha Madrid no, así que las executions se etiquetan con el día anterior.
  - **Eventualmente intermitente:** todos los pacientes durante el cambio CET ↔ CEST (último domingo de marzo y de octubre).
- **Gravedad:** funcional alta, integridad de datos media. Las sesiones se persisten, pero asociadas a la fecha equivocada → cumplimiento, rollups y estadísticas mienten en el borde de día.
- **Causa raíz (en una frase):** el cliente Angular envía la `fecha` (YYYY-MM-DD) calculada desde `new Date().toISOString().split('T')[0]` (UTC) cuando el contrato del backend dice que esa `fecha` debe representar el calendario `Europe/Madrid`.
- **Fix (en una frase):** centralizar el cálculo de fecha de referencia en un helper `madrid-date.util.ts` y reemplazar las ~12 ubicaciones donde el cliente usa `new Date().getDay()`, `toISOString()` o `setDate(+i)` para calcular días.

---

## 2. Reproducción del síntoma observado

Hay dos rutas para reproducir el bug. La primera es la que has visto:

### 2.1 Ruta 1 — Vista pasiva (datos ya corruptos)

1. Abrir un paciente con histórico real.
2. Navegar a `/actividad-personal/estadisticas`.
3. Bajar hasta la sección "Historial reciente".
4. Buscar un día con badge `—` (gris, descanso) o etiqueta `Descanso`.
5. Observar que en la columna derecha se pinta `Dolor X/10` con un punto de color (componente `ui2-status-dot`).

Esto se renderiza en `apps/app/src/app/features/actividad/pages/actividad-estadisticas/actividad-estadisticas.component.html:138-181` y los datos vienen del computed `historialReciente` en `estadisticas.service.ts:203-205`.

### 2.2 Ruta 2 — Reproducir end-to-end en local (forzar el bug en Península)

1. En el navegador, abrir DevTools → "Sensors" → forzar `Europe/Madrid` (o no tocar nada si ya estás ahí).
2. Adelantar el reloj del sistema operativo a las **00:30 hora Madrid en CET (invierno)** o **00:30 hora Madrid en CEST (verano)**.
   - En CET (UTC+1): 00:30 Madrid = 23:30 UTC del día anterior.
   - En CEST (UTC+2): 00:30 Madrid = 22:30 UTC del día anterior.
3. Como paciente con plan que NO tiene ejercicios el día UTC anterior pero SÍ los tiene hoy Madrid, completar un ejercicio de la lista actual y reportar dolor (>=1).
4. Recargar `/actividad-personal/estadisticas`.
5. Aparece el descanso del día anterior con dolor.

### 2.3 Ruta 3 — Reproducir como si fuera un usuario de Canarias

1. En DevTools → "Sensors" → forzar `Atlantic/Canary`.
2. Adelantar el reloj del sistema operativo al **viernes 23:30 hora Canarias (CET ya pasó)**, lo que en Madrid son las **00:30 del sábado**.
3. Completar un ejercicio que el plan tenga programado para sábado. Reportar dolor.
4. Esperado: la sesión se ve como "Descanso del viernes con dolor X/10" si el plan no tiene viernes en `diasSemana`.

---

## 3. Modelo mental y glosario

| Concepto | Tipo | Significado |
|----------|------|-------------|
| `fecha` | `string` `YYYY-MM-DD` | **Día calendario en Europe/Madrid.** Es el contrato de Kengo: toda `fecha` que aparece en `sessions`, `exerciseExecutions`, `dailyPatientRollup`, `plans.fechaInicio/Fin` representa un día Madrid. |
| `fechaHora` | `string` ISO 8601 con `Z` | **Instante absoluto UTC.** Es el momento exacto en el que ocurrió el evento. |
| `diaSemana` | `'L' \| 'M' \| 'X' \| 'J' \| 'V' \| 'S' \| 'D'` | Letra del día de la semana **en Europe/Madrid**. |
| CET / CEST | UTC+1 / UTC+2 | Hora oficial de la Península. CET en invierno, CEST en verano. |
| WET / WEST | UTC+0 / UTC+1 | Hora oficial de Canarias. WET en invierno, WEST en verano. |
| **Offset Canarias-Madrid** | `-1h` | **Constante todo el año.** Cuando en Madrid son las 00:00, en Canarias son las 23:00 del día anterior. El cambio horario estacional NO altera este offset, ambas zonas adelantan/atrasan a la vez. |

> **Implicación clave:** un paciente en Canarias está **siempre** una hora por detrás de Madrid. La franja crítica para él es las **23:00–00:00 Canarias** = `00:00–01:00 Madrid`. En esa hora el día Madrid ya cambió (sigue siendo "ayer" en Canarias).

---

## 4. Arquitectura: cómo el backend razona en Madrid

El backend Convex es el que tiene la verdad. Toda fecha que persiste se calcula con helpers de `convex/_helpers/datetime.ts`:

```ts
// convex/_helpers/datetime.ts:17-38
const TZ_MADRID = "Europe/Madrid";
const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getCurrentMadridDate(now: Date = new Date()): string {
  return YMD_FORMATTER.format(now);
}
```

```ts
// convex/_helpers/datetime.ts:144-149
export function getDiaSemana(fechaYMD: string): DiaSemana {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12)); // 12:00 UTC evita ambigüedad por DST
  return DIAS_SEMANA[date.getUTCDay()];
}
```

El backend abre/reanuda la sesión y calcula `totalEsperados` con esa `fecha` (sin recalcularla):

```ts
// convex/sessions/internal.ts:39-91 (extracto)
export async function openOrResumeImpl(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  fecha: string,                                  // ← viene del cliente
): Promise<Id<"sessions">> {
  // ...
  const diaSemana = getDiaSemana(fecha);          // ← deriva el día desde la `fecha` recibida
  const expectedItems = await getExpectedExercisesForPatientOnDate(
    ctx, pacienteId, fecha, diaSemana,
  );
  const { totalEsperados } = sumExpectedByPlan(expectedItems);
  // ... insert sessions con `fecha` literal del cliente
}
```

**Implicación crítica:** el backend confía ciegamente en la `fecha` que recibe del cliente. Si el cliente envía la fecha UTC, el backend tratará esa fecha UTC como si fuera una fecha Madrid, y `getDiaSemana()` devolverá el día de la semana equivocado.

`convex/executions/mutations.ts:212-261` también usa `args.fecha` para insertar la execution:

```ts
const sessionId = await openOrResumeImpl(ctx, pacienteId, args.fecha);
// ...
const executionId = await ctx.db.insert("exerciseExecutions", {
  // ...
  fecha: args.fecha,
  fechaHora: args.fechaHora,
  // ...
});
```

---

## 5. Decisión arquitectónica: ¿por qué no migrar a "todo UTC"?

Pregunta natural: "¿No sería mejor unificar todo en UTC en el backend?". Respuesta corta: **no resuelve el problema**, sólo lo desplaza.

### 5.1 Patrones de almacenamiento de fechas

| Patrón | Qué guarda | Pros | Contras |
|--------|-----------|------|---------|
| **A. UTC puro** | `fechaHora` (timestamp) | Simple para eventos | Agrupar por "día" siempre requiere convertir a un huso. No hay índice natural por `(paciente, día)`. |
| **B. UTC + día denormalizado en huso fijo** *(actual Kengo)* | `fechaHora` UTC + `fecha` YYYY-MM-DD en `Europe/Madrid` | Indexable, semántica clara de "día del paciente", idempotencia `(paciente, fecha)` para sesiones | Requiere disciplina: el huso de referencia es **un contrato** que todo el mundo (front + back) debe respetar. |
| **C. UTC + huso por usuario/clínica** | `fechaHora` UTC + `users.timezone` + `fecha` derivado | Soporta usuarios en cualquier país | Más complejo: rollups, crons y comparaciones cross-paciente se complican. |

### 5.2 Por qué "todo UTC" no es la solución

El sistema necesita responder:

- ¿Qué ejercicios tiene **hoy** este paciente?
- ¿Hizo los ejercicios del **lunes**?
- ¿Cumplió **esta semana**?

Esas preguntas no son sobre instantes, son sobre **días del calendario**, y un día sólo existe **dentro de un huso horario**. UTC no es un huso humano: nadie se levanta diciendo "hoy es lunes UTC".

Si guardáramos solo timestamps UTC, cada vez que quisiéramos agrupar por día tendríamos que convertir a un huso de referencia igualmente. Habríamos movido la lógica, no eliminado el problema.

### 5.3 Por qué el patrón B (actual) está bien

- Es el estándar para apps de salud/wellness con un único país de operación.
- Permite un índice eficiente `by_pacienteId_fecha` en `sessions` (ver `convex/schema.ts`).
- Da una idempotencia trivial para `(paciente, día)` que el rediseño de records aprovecha (BN1: una sesión por paciente y día).
- Hace que el cron nocturno sea trivial: un solo cron, una sola hora.

### 5.4 El bug es de disciplina, no arquitectónico

El backend respeta el contrato. El frontend no. El fix correcto es **enforce del contrato en el frontend**, no rediseñar la arquitectura.

### 5.5 Cuándo sí pasarse al patrón C

Cuando aparezca cualquiera de estos:

- Pacientes en Canarias **de manera estable** (no como excepción) → ya está pasando.
- Internacionalización a otros países (LatAm, UK, …).
- Fisios viajando entre husos.

Esa migración se describe como roadmap en [§9](#9-roadmap-futuro-pasarse-a-timezone-por-usuario). **No debe mezclarse con el fix de este documento.**

---

## 6. Inventario de bugs

### BUG 1 — Cliente envía la `fecha` en UTC al registrar una execution

**Archivo:** `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts:430-431`

```ts
const fechaHora = new Date().toISOString();
const fecha = fechaHora.split('T')[0]!;
```

**Por qué está mal:** `toISOString()` siempre devuelve UTC. La `fecha` que el cliente envía a `executions.mutations.create` es la fecha UTC, no Madrid. Esa `fecha` viaja a `openOrResumeImpl(ctx, pacienteId, fecha)` y a `db.insert("exerciseExecutions", { fecha, ... })` sin recalcularse.

**Caso reproducible:**

- Paciente en Península, viernes 00:30 Madrid (CET, UTC+1).
- `new Date().toISOString()` → `"jueves 23:30Z"` → `fecha = "jueves"`.
- Backend abre sesión `jueves`. Si el plan no tiene `J` en `diasSemana`, `totalEsperados = 0` → la sesión se marca como descanso.
- Las executions se insertan con `fecha = "jueves"` y con `dolorEscala`.
- Resultado: descanso del jueves con dolor X/10.

**Cómo arreglarlo:**

```ts
import { getMadridDate } from '../../../shared/utils/madrid-date.util';
// ...
const fechaHora = new Date().toISOString();   // sigue siendo el instante absoluto UTC, OK
const fecha = getMadridDate();                 // YYYY-MM-DD en Europe/Madrid
```

> El instante UTC en `fechaHora` está bien y debe mantenerse: representa el momento real en el que ocurrió el evento.

---

### BUG 2 — `obtenerRegistrosHoy` consulta con la fecha en UTC

**Archivo:** `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts:708-709`

```ts
async obtenerRegistrosHoy(pacienteId: string): Promise<RegistroEjercicio[]> {
  const hoy = new Date().toISOString().split('T')[0]!;
```

**Por qué está mal:** En el mismo archivo, `consultarSesionHoy()` (línea 669) usa correctamente `this.getMadridDate()`. Esta función usa UTC. Resultado: la **sesión** y los **registros** se buscan con criterios distintos de fecha. En la franja en que ambos no coinciden, el cliente "no ve" sus propios registros recién creados aunque el servidor sí los tenga.

**Caso reproducible:** mismo escenario que BUG 1. La sesión se consulta con `fecha = "viernes"` (Madrid OK), los registros con `hoy = "jueves"` (UTC). La página de actividad puede pintar checks intermitentes.

**Cómo arreglarlo:**

```ts
import { getMadridDate } from '../../../shared/utils/madrid-date.util';
// ...
const hoy = getMadridDate();
```

---

### BUG 3 — `filtrarEjerciciosHoy` usa `new Date().getDay()` en hora local del navegador

**Archivo:** `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts:742-744`

```ts
private filtrarEjerciciosHoy(items: EjercicioPlan[]): EjercicioPlan[] {
  const diasSemana: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const hoy = diasSemana[new Date().getDay()];
```

**Por qué está mal:** `new Date().getDay()` devuelve el día de la semana en **zona local del navegador**. En Canarias a las 23:30 locales (= 00:30 Madrid del día siguiente), el cliente filtra "viernes" y el backend espera "sábado".

**Cómo arreglarlo:**

```ts
import { getMadridDiaSemana } from '../../../shared/utils/madrid-date.util';
// ...
const hoy = getMadridDiaSemana();
```

---

### BUG 4 — `actividad-hoy.service.ts` repite el patrón

**Archivo:** `apps/app/src/app/features/actividad/data-access/actividad-hoy.service.ts:55`

```ts
private readonly diaHoy = computed(() => this.DIAS_SEMANA[new Date().getDay()]);
```

**Por qué está mal:** mismo patrón que BUG 3. Decide qué ejercicios tocan "hoy" en función del día de la semana en hora local del navegador.

**Cómo arreglarlo:**

```ts
import { getMadridDiaSemana } from '../../../shared/utils/madrid-date.util';
// ...
private readonly diaHoy = computed(() => getMadridDiaSemana());
```

---

### BUG 5 — `actividad-hoy.component.ts` repite el patrón y calcula `proximosDias` con offsets locales

**Archivo:** `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts:134, 145-208`

Línea 134:

```ts
readonly diaHoy = computed(() => this.DIAS_SEMANA[new Date().getDay()]);
```

Líneas 145-208 (extracto):

```ts
readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
  const resultado: DiaProximoConEjercicios[] = [];
  const hoy = new Date();

  for (let i = 1; i <= 14 && resultado.length < 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    const diaSemana = this.DIAS_SEMANA[fecha.getDay()];
    // ... filtrar ejercicios por diaSemana
  }
});
```

**Por qué está mal:**

- `diaHoy` con `new Date().getDay()` → mismo patrón de BUG 3.
- `proximosDias` calcula offsets en hora local. Esto es donde **sí** entra en juego el DST: en la semana del cambio (último domingo de marzo / octubre) un día tiene 23 o 25 horas, y `setDate(+i)` puede saltar un día o duplicarlo.

**Cómo arreglarlo:**

```ts
import { getMadridDiaSemana, offsetMadridDate, diaSemanaFromYMD } from '../../../../shared/utils/madrid-date.util';
// ...
readonly diaHoy = computed(() => getMadridDiaSemana());

readonly proximosDias = computed<DiaProximoConEjercicios[]>(() => {
  const resultado: DiaProximoConEjercicios[] = [];
  for (let i = 1; i <= 14 && resultado.length < 7; i++) {
    const fechaYMD = offsetMadridDate(i);
    const diaSemana = diaSemanaFromYMD(fechaYMD);
    // ... filtrar ejercicios por diaSemana, usar fechaYMD para todo lo que dependa de fecha
  }
});
```

---

### BUG 6 — Comparación de vigencia de plan mezcla UTC y Madrid

**Archivo:** `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts:354`

```ts
private esFechaEnRangoPlan(plan: PlanCompleto, fecha: Date): boolean {
  const fechaStr = fecha.toISOString().split('T')[0];
  if (plan.fechaInicio && fechaStr < plan.fechaInicio) {
```

**Por qué está mal:** `fecha.toISOString().split('T')[0]` es UTC. `plan.fechaInicio` y `plan.fechaFin` son Madrid (vienen del backend). En el borde del día, planes recién iniciados o que acaban de finalizar se ven o no se ven con un día de desfase.

**Cómo arreglarlo:**

```ts
import { getMadridDate } from '../../../../shared/utils/madrid-date.util';
// ...
private esFechaEnRangoPlan(plan: PlanCompleto, fecha: Date): boolean {
  const fechaStr = getMadridDate(fecha);
  if (plan.fechaInicio && fechaStr < plan.fechaInicio) {
```

---

### BUG 7 — Estadísticas: `ultimosNDias`, `dayLetterFor`, `formatHistoryDay` mezclan UTC y local

**Archivo:** `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts:450-477, 540-559`

```ts
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ultimosNDias(n: number): string[] {
  const hoy = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    result.push(toIsoDate(d));
  }
}

function dayLetterFor(fecha: string): string {
  const d = new Date(fecha);   // interpreta YYYY-MM-DD como UTC midnight, getDay() en local → off-by-one
  const dow = d.getDay();
  ...
}

function formatHistoryDay(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);   // interpreta como local
  ...
}
```

**Por qué está mal:** mezcla los tres husos (UTC, local, implícito Madrid) sin criterio. El gráfico de "últimos 10 días", el cómputo de "Hoy / Ayer" en el historial y la letra del día (`L`, `M`, …) salen desalineados respecto al backend en cualquier navegador no-Madrid o en el borde del día.

**Cómo arreglarlo:**

```ts
import { getMadridDate, offsetMadridDate, diaSemanaFromYMD, ymdToDateForDisplay } from '../../../shared/utils/madrid-date.util';

function ultimosNDias(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) result.push(offsetMadridDate(-i));
  return result;
}

function dayLetterFor(fecha: string): string {
  // Reusar el algoritmo del backend para coherencia 1:1 con convex/_helpers/datetime.ts:144-149
  const dia = diaSemanaFromYMD(fecha);   // 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D'
  // mapear a la letra para mostrar (la utilidad ya devuelve la letra correcta)
  return dia;
}

function formatHistoryDay(fecha: string): string {
  const d = ymdToDateForDisplay(fecha);   // 12:00 UTC, evita saltos de día por DST
  const hoyYMD = getMadridDate();
  const ayerYMD = offsetMadridDate(-1);
  const dia = d.getUTCDate();
  const mes = MESES_CORTO[d.getUTCMonth()] ?? '';
  const dayLetter = dayLetterFor(fecha);
  if (fecha === hoyYMD) return `Hoy · ${dayLetter} ${dia} ${mes}`;
  if (fecha === ayerYMD) return `Ayer · ${dayLetter} ${dia} ${mes}`;
  return `${dayLetter} ${dia} ${mes}`;
}
```

---

### BUG 8 — `cumplimiento.service.ts` mezcla `hoy` UTC con `inicioAno` local

**Archivo:** `apps/app/src/app/features/pacientes/data-access/cumplimiento.service.ts:68-96` (extracto)

```ts
const hoy = new Date().toISOString().slice(0, 10);     // UTC
const inicioAno = new Date().getFullYear() + '-01-01'; // año local
```

**Por qué está mal:** mezcla otra vez UTC y local. El `inicioAno` además puede no coincidir con el año que ve el paciente en su calendario en la franja de 31 de diciembre / 1 de enero.

**Cómo arreglarlo:**

```ts
import { getMadridDate } from '../../../shared/utils/madrid-date.util';
// ...
const hoy = getMadridDate();
const inicioAno = `${hoy.slice(0, 4)}-01-01`;
```

---

### BUG 9 — Pintado del dolor en días de descanso (síntoma visible)

**Archivo TS:** `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts:522-538`

```ts
function buildSesionVm(s: SesionReciente): SesionHistoricaVm {
  const esperados = s.totalEsperados ?? 0;
  const completados = s.totalCompletados ?? 0;
  const esDescanso = esperados === 0 || s.esSintetica === true;
  // ...
  return {
    // ...
    pain: s.dolorPromedio != null ? Math.round(s.dolorPromedio) : null,  // ← se pinta SIEMPRE que haya valor
    rest: esDescanso || undefined,
  };
}
```

**Archivo HTML:** `apps/app/src/app/features/actividad/pages/actividad-estadisticas/actividad-estadisticas.component.html:169-174`

```html
@if (h.pain !== null) {
  <span class="ae-hist__pain">
    <ui2-status-dot [color]="painDotColor(h.pain)">
      <span class="ae-hist__pain-text">Dolor {{ h.pain }}/10</span>
    </ui2-status-dot>
  </span>
}
```

**Por qué está mal:** la VM marca `rest: true` y a la vez pinta `pain: X` cuando el backend devuelve la sesión (mal etiquetada por BUG 1) con `totalEsperados = 0` y `dolorPromedio` calculado a partir de las executions reales.

**Cómo arreglarlo (parche cosmético, defensa en profundidad):**

```ts
return {
  // ...
  pain: !esDescanso && s.dolorPromedio != null ? Math.round(s.dolorPromedio) : null,
  rest: esDescanso || undefined,
};
```

> Este parche evita la incongruencia visual mientras se despliega el fix de zona horaria. **No soluciona la causa raíz**, sólo el síntoma.

---

### BUG 10 — Cron nocturno con horario contradictorio a la spec

**Archivo:** `convex/crons.ts:33-38`

```ts
crons.daily(
  "nightly-session-close",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sessions.internal.closeOpenSessionsAtEndOfDay,
  {},
);
```

**Por qué es ambiguo:** el comentario en `convex/_helpers/datetime.ts:55-73` y el documento `docs/PLAN_REDISENO_RECORDS.md` dicen "23:55 hora Madrid". El cron real corre a 02:00 UTC fijo, lo que en Madrid equivale a:

| Estación | Madrid | Canarias |
|----------|--------|----------|
| Invierno (CET / WET) | 03:00 | 02:00 |
| Verano (CEST / WEST) | 04:00 | 03:00 |

El handler `closeOpenSessionsAtEndOfDay` (`convex/sessions/internal.ts:227-245`) mitiga esto cerrando sólo sesiones con `s.fecha < hoyMadrid`, así que no causa pérdida de datos. **Pero la divergencia spec ↔ implementación es trampa para futuras refactorizaciones.**

**Cómo arreglarlo:** sólo actualizar comentario, no el horario.

```ts
// Cierre nocturno de sesiones del día anterior. Hora fija: 02:00 UTC.
//   Equivale a 03:00 Madrid (CET) / 04:00 Madrid (CEST).
// El handler cierra sesiones con `fecha < hoyMadrid`, así que el desfase
// con respecto a la spec ("23:55 Madrid") es intencional y seguro: las
// sesiones del día anterior se cierran con ~3-4h de retraso pero antes de
// que `daily-maintenance` (03:00 UTC = 04:00 / 05:00 Madrid) recompute
// rollups y snapshots.
crons.daily(
  "nightly-session-close",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sessions.internal.closeOpenSessionsAtEndOfDay,
  {},
);
```

---

## 7. Causa raíz consolidada

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cliente Angular en navegador (zona local: Atlantic/Canary o Local) │
└──────────────────────────────────────────────────────────────────────┘
        │
        │ 1. Filtra ejercicios "de hoy" con `new Date().getDay()`
        │    → día de la semana en hora LOCAL del navegador (BUG 3,4,5)
        │
        │ 2. Usuario completa ejercicio, reporta dolor.
        │
        │ 3. `registrarEjercicioCompletado` calcula:
        │       fechaHora = new Date().toISOString()      → UTC instant ✅
        │       fecha     = fechaHora.split('T')[0]       → fecha UTC ❌ (BUG 1)
        │
        │ 4. Envía mutation `executions.create({ fecha = UTC, fechaHora = UTC })`
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Backend Convex (asume `fecha` ∈ Europe/Madrid)                      │
└──────────────────────────────────────────────────────────────────────┘
        │
        │ 5. `openOrResumeImpl(pacienteId, fecha=UTC)`:
        │       diaSemana = getDiaSemana(fecha=UTC)       → día WRONG
        │       expected  = getExpectedExercisesForPatientOnDate(...)
        │                 → si plan no tiene ese día → totalEsperados = 0
        │       insert sessions { fecha=UTC, totalEsperados=0 }
        │
        │ 6. insert exerciseExecutions { fecha=UTC, dolorEscala=5 }
        │
        │ 7. recomputeAggregatesAndCheckAutoClose:
        │       agg.dolorPromedio = 5
        │       totalCompletados >= totalEsperados (5 >= 0) → close!
        │       motivoCierre = "auto_completitud"
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Datos persistidos:                                                  │
│   sessions { fecha=UTC, totalEsperados=0, dolorPromedio=5 }        │
└──────────────────────────────────────────────────────────────────────┘
        │
        │ 8. Frontend pide listRecentByPaciente.
        │
        │ 9. estadisticas.service.ts buildSesionVm:
        │       esDescanso = (esperados === 0) → true
        │       pain        = round(5)         → 5
        │       rest        = true
        │
        │ 10. Template renderiza badge "—" + texto "Descanso" + "Dolor 5/10"
        ▼
                              SÍNTOMA VISIBLE
```

---

## 8. Plan de remediación por fases

### Fase 0 — Parche cosmético (1 línea, despliegue inmediato)

Elimina la incongruencia visual mientras se despliega el fix completo. **No soluciona el problema de datos**, sólo evita el síntoma reportado por el usuario.

- **Archivo:** `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts:535`
- **Cambio:** ver [BUG 9](#bug-9--pintado-del-dolor-en-días-de-descanso-síntoma-visible).

### Fase 1 — Helper compartido + reemplazos en frontend

#### 1.1 Crear `apps/app/src/app/shared/utils/madrid-date.util.ts`

```ts
import type { DiaSemana } from '../../../types/global';

const TZ_MADRID = 'Europe/Madrid';

const YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_MADRID,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ_MADRID,
  weekday: 'short',
});

const DIAS: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MAP_EN_TO_DIA: Record<string, DiaSemana> = {
  Mon: 'L', Tue: 'M', Wed: 'X', Thu: 'J', Fri: 'V', Sat: 'S', Sun: 'D',
};

/** Fecha YYYY-MM-DD en Europe/Madrid. */
export function getMadridDate(now: Date = new Date()): string {
  return YMD.format(now);
}

/** Día de la semana ('L'..'D') en Europe/Madrid. */
export function getMadridDiaSemana(now: Date = new Date()): DiaSemana {
  return MAP_EN_TO_DIA[WEEKDAY.format(now)]!;
}

/**
 * Día de la semana de una fecha YYYY-MM-DD interpretada como Madrid.
 * Coincide 1:1 con `getDiaSemana` del backend.
 */
export function diaSemanaFromYMD(ymd: string): DiaSemana {
  const [y, m, d] = ymd.split('-').map(Number);
  // 12:00 UTC evita ambigüedades de DST.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  // getUTCDay(): 0=Sun..6=Sat. Convertimos a 0=Mon..6=Sun.
  const idx = (date.getUTCDay() + 6) % 7;
  return DIAS[idx]!;
}

/** Fecha YYYY-MM-DD desplazada `offsetDays` desde hoy (Madrid). */
export function offsetMadridDate(offsetDays: number, now: Date = new Date()): string {
  const [y, m, d] = getMadridDate(now).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Construye un `Date` a partir de YYYY-MM-DD seguro contra DST en cualquier
 * zona del cliente. Útil para extraer día/mes/año de la cadena para mostrar.
 * NUNCA usar getDay() / getMonth() / getDate() sobre el resultado: usar
 * getUTCDay() / getUTCMonth() / getUTCDate().
 */
export function ymdToDateForDisplay(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
```

#### 1.2 Reemplazos en código (orden sugerido)

1. `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts` → BUGS 1, 2, 3.
2. `apps/app/src/app/features/actividad/data-access/actividad-hoy.service.ts` → BUG 4.
3. `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts` → BUGS 5, 6.
4. `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts` → BUG 7.
5. `apps/app/src/app/features/pacientes/data-access/cumplimiento.service.ts` → BUG 8.

> Eliminar también el método privado `getMadridDate` de `sesion-state.service.ts:736-740` (ya cubierto por el helper).

### Fase 2 — Defensa en backend (cinturón y tirantes)

Aunque el cliente esté arreglado, hay clientes en cache (Capacitor mobile, navegadores con la build vieja). Conviene proteger la mutación.

**Archivo:** `convex/executions/mutations.ts:208-273` (función `createImpl`).

```ts
// (al inicio)
import { getCurrentMadridDate } from "../_helpers/datetime";
// ...
async function createImpl(ctx, pacienteId, args) {
  const expected = getCurrentMadridDate();
  if (args.fecha !== expected) {
    // Cliente desactualizado o desfasado por bug histórico de TZ.
    // Forzamos la fecha a la canónica Madrid.
    args = { ...args, fecha: expected };
  }
  // ... resto del código actual
}
```

> Ver [Anexo B](#12-anexo-b--preguntas-abiertas) para la decisión de usar fallback silencioso vs lanzar error.

Aplicar la misma defensa en `executions.mutations.createBatch` (líneas 43-128).

### Fase 3 — Documentar el cron nocturno

Sólo actualizar comentario en `convex/crons.ts:33-38`. Ver [BUG 10](#bug-10--cron-nocturno-con-horario-contradictorio-a-la-spec).

### Fase 4 — Migración de datos legacy (opcional)

**Recomendación: NO ejecutar.** Justificación:

- Sólo afectaría a sesiones cerradas con `fecha` desplazada por BUG 1.
- Detectarlas requeriría comparar `fecha` con `fechaHora` y deducir si la `fecha` correcta sería otra → algoritmo no trivial y reversible con riesgo de empeorar datos correctos.
- El histórico ya está cerrado y referenciado por rollups y snapshots (BN3). Recomputarlos en bloque es costoso.
- El equipo de fisios entenderá un punto de corte ("antes de fecha X, las estadísticas tenían un sesgo conocido").

Si se decide hacerlo, abrir un proyecto separado: requiere diseño de la mutation, dry-run, snapshot previo, plan de rollback.

---

## 9. Roadmap futuro: pasarse a `timezone` por usuario

**Fuera del alcance de este fix.** Documentado aquí para que se pueda planificar como proyecto independiente cuando producto lo priorice.

### 9.1 Trigger para esta migración

- Pacientes en Canarias se vuelven una zona habitual y operativa, no excepcional.
- Apertura comercial en otros países (LatAm, UK).
- Fisios o pacientes que viajan entre husos.

### 9.2 Cambios necesarios

1. **Schema:** añadir `users.timezone` (`v.string()`) con default `"Europe/Madrid"` en `convex/schema.ts`.
2. **Backend:**
   - Sustituir `getCurrentMadridDate()` por `getCurrentDateForUser(userId)` en `convex/_helpers/datetime.ts`.
   - Refactorizar `convex/sessions/internal.ts:openOrResumeImpl`, `closeOpenSessionsAtEndOfDay`, etc., para resolver el huso del paciente.
   - Refactorizar `convex/rollups/internal.ts` y `convex/snapshots/internal.ts` (rollups y snapshots se calculan por paciente, así que esto es más natural).
3. **Cron nocturno:** cambiar `crons.daily("nightly-session-close", { hourUTC: 2 }, ...)` por una banda horaria (varios crons o un solo cron que itere por husos relevantes).
4. **Frontend:**
   - Reemplazar el helper `madrid-date.util.ts` por `user-date.util.ts` que tome el huso del usuario activo.
   - Pasar `getMadridDate()` → `getDateForCurrentUser()`.
5. **Migración de datos:** recomputar `fecha` de las `sessions` y `exerciseExecutions` históricas según el `timezone` actual del paciente (asumiendo que no cambia retroactivamente).

### 9.3 Tamaño estimado

Proyecto de ~1-2 sprints. Requiere alineación con producto, plan de comunicación con clínicas y plan de migración con dry-run.

---

## 10. Verificación end-to-end

### 10.1 Tests unitarios nuevos

`apps/app/src/app/shared/utils/madrid-date.util.spec.ts`:

```ts
import { getMadridDate, getMadridDiaSemana, diaSemanaFromYMD, offsetMadridDate } from './madrid-date.util';

describe('madrid-date.util', () => {
  describe('getMadridDate', () => {
    it('en CET (invierno) cuenta el día Madrid, no UTC', () => {
      // Lunes 22:30Z = Lunes 23:30 Madrid → "lunes"
      expect(getMadridDate(new Date('2026-01-12T22:30:00Z'))).toBe('2026-01-12');
      // Lunes 23:30Z = Martes 00:30 Madrid → "martes"
      expect(getMadridDate(new Date('2026-01-12T23:30:00Z'))).toBe('2026-01-13');
    });
    it('en CEST (verano) maneja UTC+2', () => {
      // Lunes 21:30Z = Lunes 23:30 Madrid → "lunes"
      expect(getMadridDate(new Date('2026-07-13T21:30:00Z'))).toBe('2026-07-13');
      // Lunes 22:30Z = Martes 00:30 Madrid → "martes"
      expect(getMadridDate(new Date('2026-07-13T22:30:00Z'))).toBe('2026-07-14');
    });
    it('en el cambio CET→CEST (último dom de marzo)', () => {
      // 2026-03-29 02:00 CET → 03:00 CEST. Sin saltos.
      expect(getMadridDate(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29');
      expect(getMadridDate(new Date('2026-03-29T02:30:00Z'))).toBe('2026-03-29');
    });
  });

  describe('getMadridDiaSemana', () => {
    it('coincide con backend para todas las horas críticas', () => {
      expect(getMadridDiaSemana(new Date('2026-01-12T22:30:00Z'))).toBe('L');
      expect(getMadridDiaSemana(new Date('2026-01-12T23:30:00Z'))).toBe('M');
    });
  });

  describe('diaSemanaFromYMD', () => {
    it('coincide con convex/_helpers/datetime.ts:getDiaSemana', () => {
      expect(diaSemanaFromYMD('2026-05-03')).toBe('D'); // domingo
      expect(diaSemanaFromYMD('2026-03-29')).toBe('D'); // cambio horario CET→CEST
      expect(diaSemanaFromYMD('2026-10-25')).toBe('D'); // cambio CEST→CET
    });
  });

  describe('offsetMadridDate', () => {
    it('atraviesa DST sin saltos', () => {
      expect(offsetMadridDate(7, new Date('2026-03-22T12:00:00Z'))).toBe('2026-03-29');
    });
  });
});
```

### 10.2 Tests E2E (manual o Playwright)

#### Escenario A — Canarias 23:30 viernes

1. DevTools → Sensors → forzar `Atlantic/Canary`.
2. Reloj del SO en `viernes 23:30 hora Canarias` (`viernes 23:30Z` invierno / `sábado 00:30Z` verano).
3. Como paciente con plan que tiene ejercicios sólo los sábados, completar uno y reportar dolor.

**Esperado:**
- La execution se persiste con `fecha = "<sábado>"` (Madrid).
- El "Historial reciente" muestra "Hoy · S {dia} {mes}" y NO un descanso del viernes con dolor.

#### Escenario B — Madrid 00:30 sábado en CEST

1. DevTools → Sensors → forzar `Europe/Madrid`.
2. Reloj del SO en `sábado 00:30 Madrid` (= `viernes 22:30Z` en CEST).
3. Mismo plan, mismo flujo.

**Esperado:** idéntico al Escenario A.

#### Escenario C — Cambio horario CET→CEST

1. Reloj del SO en el último domingo de marzo, 02:00 Madrid → salta a 03:00 Madrid.
2. Verificar `proximosDias` desde el día anterior: deben aparecer 7 días contiguos sin saltarse uno.

### 10.3 Smoke en producción tras desplegar

Query manual a Convex Dashboard:

```ts
db.query("sessions")
  .filter(s => s.totalEsperados === 0 && s.dolorPromedio != null && s._creationTime > <DEPLOY_TIMESTAMP>)
  .collect();
```

Esperado: array vacío para sesiones nuevas posteriores al deploy. Sesiones legacy seguirán apareciendo (Fase 4 = no se migran).

---

## 11. Anexo A — Tabla "ubicación → fix"

Checklist para el implementador. Marcar cuando esté hecho.

| # | Bug | Archivo | Líneas | Acción |
|---|-----|---------|--------|--------|
| 0 | Helper | `apps/app/src/app/shared/utils/madrid-date.util.ts` | nuevo | Crear con código de §8.1.1 |
| 1 | 1 | `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts` | 430-431 | `fecha = getMadridDate()` |
| 2 | 2 | `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts` | 708-709 | `hoy = getMadridDate()` |
| 3 | 3 | `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts` | 742-744 | `hoy = getMadridDiaSemana()` |
| 4 | — | `apps/app/src/app/features/sesion/data-access/sesion-state.service.ts` | 736-740 | Eliminar `private getMadridDate()` |
| 5 | 4 | `apps/app/src/app/features/actividad/data-access/actividad-hoy.service.ts` | 55 | `getMadridDiaSemana()` |
| 6 | 5 | `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts` | 134 | `getMadridDiaSemana()` |
| 7 | 5 | `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts` | 145-208 | Reescribir `proximosDias` con `offsetMadridDate` + `diaSemanaFromYMD` |
| 8 | 6 | `apps/app/src/app/features/actividad/pages/actividad-hoy/actividad-hoy.component.ts` | 354 | `fechaStr = getMadridDate(fecha)` |
| 9 | 7 | `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts` | 450-466 | Reescribir `ultimosNDias`, eliminar `toIsoDate` |
| 10 | 7 | `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts` | 468-477 | Reescribir `dayLetterFor` con `diaSemanaFromYMD` |
| 11 | 7 | `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts` | 540-559 | Reescribir `formatHistoryDay` con `ymdToDateForDisplay` y `getMadridDate` |
| 12 | 8 | `apps/app/src/app/features/pacientes/data-access/cumplimiento.service.ts` | 68-96 | `hoy = getMadridDate()` y `inicioAno` derivado |
| 13 | 9 | `apps/app/src/app/features/actividad/data-access/estadisticas.service.ts` | 535 | `pain: !esDescanso && ...` (parche cosmético) |
| 14 | 2 (back) | `convex/executions/mutations.ts` | 208-273 (`createImpl`) | Forzar `args.fecha = getCurrentMadridDate()` si difiere |
| 15 | 2 (back) | `convex/executions/mutations.ts` | 43-128 (`createBatch`) | Mismo enforcement que en `createImpl` |
| 16 | 10 | `convex/crons.ts` | 33-38 | Sólo actualizar comentario, no el horario |
| 17 | tests | `apps/app/src/app/shared/utils/madrid-date.util.spec.ts` | nuevo | Crear tests de §10.1 |

---

## 12. Anexo B — Preguntas abiertas

### B.1 ¿Fallback silencioso o error duro en backend?

En `convex/executions/mutations.ts:createImpl`, cuando el cliente envía una `fecha` distinta de `getCurrentMadridDate()`:

| Opción | Comportamiento | Pros | Contras |
|--------|---------------|------|---------|
| **A. Fallback silencioso** | Forzar `args.fecha = expected` y continuar | Resiliente a clientes en cache (móvil con builds viejas) | Encubre bugs futuros del cliente |
| **B. Error duro** | `throw new Error("fecha inválida")` y devolver al cliente | Visibilidad total; el cliente debe arreglarse | Pacientes con build vieja pierden la sesión hasta reinstalar |
| **C. Híbrido** | Fallback silencioso + log + métrica `tz_mismatch` | Visibilidad sin romper UX | Algo más de código |

**Recomendación:** opción C. Decidir antes de implementar Fase 2.

### B.2 ¿Migrar datos legacy?

Según [§8 Fase 4](#fase-4--migración-de-datos-legacy-opcional). Recomendación: **no**.

Decidir con producto si la pérdida de fidelidad histórica es aceptable o si hay un compromiso con clínicas que requiera limpieza.

### B.3 ¿Plan para Capacitor mobile?

La app móvil compila con Capacitor. Los binarios instalados en App Store / Play Store no se actualizan automáticamente. La defensa de Fase 2 cubre ese caso, pero si quisiéramos consistencia inmediata, hay que forzar update mínimo (mecanismo de "version gate" en login).

Decidir con producto si se quiere implementar version gate o se acepta la deriva natural.
