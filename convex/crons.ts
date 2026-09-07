import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Mantenimiento diario: repara cadenas de versiones de planes rotas + expira
// planes vencidos + sync del aggregate de pacientes activos + rollups stale +
// snapshots + alertas. Cada paso corre en su propia transacción encadenada
// (ver `compliance/internal.ts`).
// Hora fija: 03:00 UTC.
//   Península invierno: 04:00 / verano: 05:00
//   Canarias  invierno: 03:00 / verano: 04:00
crons.daily(
  "daily-maintenance",
  { hourUTC: 3, minuteUTC: 0 },
  internal.compliance.internal.dailyMaintenance,
  {},
);

// Limpieza semanal de keys huérfanas en R2 (avatars/logos/clinic-files que ya
// no están referenciadas en BD y tienen >7 días).
crons.weekly(
  "r2-orphan-cleanup",
  { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.storage.cleanup.cleanupOrphanR2Keys,
  {},
);

// Cierre nocturno de sesiones del día anterior (rediseño records — Fase 1).
// Hora fija: 02:00 UTC.
//
// TZ-safe: el handler `closeOpenSessionsAtEndOfDay` barre `fecha < hoy-Madrid`
// como superset barato (índice) y solo cierra una sesión cuando su día ya
// terminó EN LA TZ DE SU PACIENTE (`shouldCloseSession`). Efectos por TZ:
//   - Madrid/Canarias: la sesión de ayer se cierra a las 03-04h locales.
//   - TZ por detrás de Madrid (América): la sesión del día en curso se
//     POSPONE (no se cierra prematuramente); cae en el ciclo siguiente.
//   - TZ por delante de Madrid (Asia/Pacífico): la sesión se cierra un ciclo
//     más tarde de su medianoche local — inofensivo.
// Convex no soporta crons con TZ ni horas dinámicas, de ahí la hora UTC fija.
crons.daily(
  "nightly-session-close",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sessions.internal.closeOpenSessionsAtEndOfDay,
  {},
);

// Materialización de rollups "fallidos" para pacientes activos: crea
// `dailyPatientRollup` para cada paciente con plan activo (leído de `plans`,
// no del aggregate) cuyos últimos 7 días (EN SU TZ, sin pasar de ayer) no
// quedaron registrados (no abrió la app). Sin esto, la adherencia y la racha
// calculadas ignoran los días "no abiertos" e inflan las métricas reales
// (ver AUDITORIA_AGGREGATES_CONVEX.md Bug 2).
// Se ejecuta a las 02:30 UTC, entre `nightly-session-close` (02:00) y
// `daily-maintenance` (03:00), para que `recomputeAllPatients` vea ya los
// rollups materializados.
crons.daily(
  "daily-materialize-missing-rollups",
  { hourUTC: 2, minuteUTC: 30 },
  internal.rollups.internal.materializeMissingDailyRollupsForYesterday,
  {},
);

// Periodos de gracia agotados: marca `unpaid` las clínicas en `past_due` cuyo
// `graceUntil` ya expiró. Hora 03:30 UTC, después del `daily-maintenance` para
// no solapar y dejar que cualquier `invoice.paid` del día anterior se procese
// antes.
crons.daily(
  "billing-grace-expired",
  { hourUTC: 3, minuteUTC: 30 },
  internal.billing.internal.checkGracePeriodsExpired,
  {},
);

// Reconciliación de trials: recupera clínicas que se quedaron sin fila
// `clinicBilling` (fallo del `startTrialForClinic` encolado al crearse la
// clínica) reencolando el arranque del trial. Idempotente. Hora 03:45 UTC,
// tras `billing-grace-expired` (03:30).
crons.daily(
  "billing-reconcile-trials",
  { hourUTC: 3, minuteUTC: 45 },
  internal.billing.internal.reconcileMissingTrials,
  {},
);

// Reconciliación de contratos a medida: relee de Stripe el price y la quantity
// de cada suscripción viva para refrescar `clinicBilling.limiteFisios`. Red de
// seguridad por si se pierde el webhook con el que ventas amplía las plazas
// desde el Dashboard: sin esto la clínica seguiría bloqueada en 9 fisios sin
// que nadie lo detecte. Hora 04:15 UTC, entre `directus-catalog-sync` (04:00)
// y `push-log-cleanup` (04:30).
crons.daily(
  "billing-reconcile-limites-a-medida",
  { hourUTC: 4, minuteUTC: 15 },
  internal.billing.actions.reconcileLimitesAMedida,
  {},
);

// Reconciliación de titularidad de tarjetas: espejo Stripe → `clinicPaymentMethods`
// (altas que perdió el webhook, bajas hechas desde el Dashboard, defaults).
// Sin esto, un titular no vería su tarjeta en "Mi cuenta" o el owner no
// recibiría el aviso al retirarse la activa. Hora 05:00 UTC: tras el resto de
// reconciliaciones de billing (03:30–04:15) y `push-log-cleanup` (04:30).
crons.daily(
  "billing-reconcile-metodos-pago",
  { hourUTC: 5, minuteUTC: 0 },
  internal.billing.actions.reconcilePaymentMethods,
  { apply: true },
);

// Sync diario del catálogo de ejercicios desde Directus (CMS administrado por
// admins). Pull incremental por `date_updated` sobre las colecciones
// `ejercicios`, `categorias` y `ejercicios_categorias`. Detecta borrados
// comparando el set de IDs vivos en Directus con los `directusId` en Convex.
// Hora 04:00 UTC: tras `daily-maintenance` (03:00) y `billing-grace-expired`
// (03:30), antes del horario laboral europeo.
crons.daily(
  "directus-catalog-sync",
  { hourUTC: 4, minuteUTC: 0 },
  internal.sync.actions.syncFromDirectus,
  {},
);

// Recordatorio diario push para pacientes con plan activo que aún no han
// completado la sesión del día ("hoy" resuelto por paciente con SU TZ).
// Hora fija 17:00 UTC:
//   Península invierno (CET): 18:00 / verano (CEST): 19:00
//   Canarias  invierno (WET): 17:00 / verano (WEST): 18:00
crons.daily(
  "daily-patient-reminder",
  { hourUTC: 17, minuteUTC: 0 },
  internal.push.crons.sendDailyPatientReminders,
  {},
);

// Limpieza del log de envíos push (`pushSendLog`): borra registros con más de
// 30 días. Hora 04:30 UTC, tras el sync de Directus y lejos del recordatorio
// de las 17:00.
crons.daily(
  "push-log-cleanup",
  { hourUTC: 4, minuteUTC: 30 },
  internal.push.mutations.purgeOldPushLogs,
  {},
);

// Purga de push tokens sin actividad en 60 días (dispositivos abandonados
// cuyo token FCM sigue "vivo" y nunca llega a UNREGISTERED). Hora 04:45 UTC,
// tras `push-log-cleanup` (04:30).
crons.daily(
  "push-token-cleanup",
  { hourUTC: 4, minuteUTC: 45 },
  internal.push.mutations.purgeStalePushTokens,
  {},
);

export default crons;
