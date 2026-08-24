import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const REMINDER_TITLE = "Tu plan de hoy te espera";
const REMINDER_BODY =
  "Aún no has hecho tus ejercicios de hoy. Cuando quieras, abrimos sesión.";

/**
 * Recordatorio diario para pacientes con plan activo cuyo rollup del día NO
 * está completado/descanso. Programado por `crons.daily` a las 17:00 UTC.
 *
 * El "hoy" de cada paciente se resuelve en `getReminderCandidates` con SU
 * zona horaria (a las 17:00 UTC la fecha civil coincide en Europa/África/
 * América, pero el criterio es por-paciente igualmente). La HORA de envío
 * sigue siendo fija (18:00 Madrid / 17:00 Canarias); mejora futura: cron
 * horario que seleccione pacientes cuya hora local esté en [18:00, 19:00).
 *
 * Encola un `sendPushToUser` por paciente, escalonado 50 ms entre cada uno
 * para no saturar el scheduler de Convex y respetar el límite de 10 min por
 * action. Cada `sendPushToUser` es responsable de iterar todos los
 * dispositivos del paciente.
 */
export const sendDailyPatientReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const candidatos: Id<"users">[] = await ctx.runQuery(
      internal.push.queries.getReminderCandidates,
      {},
    );

    console.log(
      `[Push] Recordatorios diarios para ${candidatos.length} pacientes`,
    );

    for (let i = 0; i < candidatos.length; i++) {
      await ctx.scheduler.runAfter(
        i * 50,
        internal.push.actions.sendPushToUser,
        {
          userId: candidatos[i],
          title: REMINDER_TITLE,
          body: REMINDER_BODY,
          data: { type: "daily_reminder" },
          notificationKey: "dailyReminder",
        },
      );
    }

    return candidatos.length;
  },
});
