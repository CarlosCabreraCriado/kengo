import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getDiaSemana } from "../_helpers/datetime";
import { getExpectedExercisesForPatientOnDate } from "../_helpers/expectedExercises";

/**
 * Devuelve todos los push tokens registrados para un usuario.
 * Internal: solo se invoca desde la action `sendPushToUser`.
 */
export const getTokensForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Candidatos para el recordatorio diario: pacienteIds únicos con al menos un
 * plan activo que HOY tienen ejercicios pendientes de verdad.
 *
 * Un paciente es candidato si tiene token registrado Y cumple:
 *  - Si ya existe algún `dailyPatientRollup` de hoy: se envía salvo que TODOS
 *    estén en "completado"/"descanso" (respeta el trabajo ya materializado por
 *    una sesión abierta ese día). Tras la partición por clínica un paciente
 *    puede tener N rollups el mismo día (uno por clínica); política: 1 push por
 *    paciente.
 *  - Si NO existe rollup de hoy (lo habitual antes de que el paciente abra la
 *    app): se calcula en vivo con `getExpectedExercisesForPatientOnDate`, que
 *    filtra `diasSemana`, vigencia (`fechaInicio`/`fechaFin`) y versiones
 *    supersedidas. Si no hay ejercicios esperados hoy (día de descanso, plan
 *    fuera de ventana), NO se manda push.
 *
 * Antes este selector trataba "sin rollup" como "pendiente", enviando el
 * recordatorio en días de descanso. Ahora usa la misma fuente de verdad que
 * `computeEstadoDia`, alineándolo con lo que la app muestra al paciente.
 */
export const getReminderCandidates = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const plansActivos = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();

    const uniquePacienteIds = Array.from(
      new Set(plansActivos.map((p) => p.pacienteId)),
    ) as Id<"users">[];

    const diaSemana = getDiaSemana(today);
    const candidatos: Id<"users">[] = [];
    for (const pacienteId of uniquePacienteIds) {
      // Comprobar token primero: es la lectura más barata y descarta a la
      // mayoría de pacientes antes de los cálculos de rollup/esperados.
      const tieneToken = await ctx.db
        .query("pushTokens")
        .withIndex("by_userId", (q) => q.eq("userId", pacienteId))
        .first();
      if (!tieneToken) continue;

      const rollups = await ctx.db
        .query("dailyPatientRollup")
        .withIndex("by_pacienteId_fecha", (q) =>
          q.eq("pacienteId", pacienteId).eq("fecha", today),
        )
        .collect();

      if (rollups.length > 0) {
        // Ya hay actividad materializada hoy: enviar salvo que todo esté
        // completado o sea descanso.
        const todoResuelto = rollups.every(
          (r) => r.estadoDia === "completado" || r.estadoDia === "descanso",
        );
        if (todoResuelto) continue;
        candidatos.push(pacienteId);
        continue;
      }

      // Sin rollup de hoy: ¿tiene ejercicios esperados realmente?
      const esperados = await getExpectedExercisesForPatientOnDate(
        ctx,
        pacienteId,
        today,
        diaSemana,
      );
      if (esperados.length === 0) continue; // descanso / fuera de vigencia

      candidatos.push(pacienteId);
    }
    return candidatos;
  },
});
