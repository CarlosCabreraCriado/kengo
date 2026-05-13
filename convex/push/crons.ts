import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getCurrentMadridDate } from "../_helpers/datetime";

const REMINDER_TITLE = "Tu plan de hoy te espera";
const REMINDER_BODY =
  "Aún no has hecho tus ejercicios de hoy. Cuando quieras, abrimos sesión.";

/**
 * Recordatorio diario para pacientes con plan activo cuyo rollup del día NO
 * está completado/descanso. Programado por `crons.daily` a las 17:00 UTC.
 *
 * Encola un `sendPushToUser` por paciente, escalonado 50 ms entre cada uno
 * para no saturar el scheduler de Convex y respetar el límite de 10 min por
 * action. Cada `sendPushToUser` es responsable de iterar todos los
 * dispositivos del paciente.
 */
export const sendDailyPatientReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const today = getCurrentMadridDate();
    const candidatos: Id<"users">[] = await ctx.runQuery(
      internal.push.queries.getReminderCandidates,
      { today },
    );

    console.log(
      `[Push] Recordatorios diarios para ${candidatos.length} pacientes (${today})`,
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
        },
      );
    }

    return candidatos.length;
  },
});
