/**
 * Mutations públicas de sesión.
 *
 * Tras Fase 5 (drop legacy), estas mutations operan sobre el modelo nuevo
 * (`sessions` rediseñada: campos `clinicId`, `fecha`, `estado`, agregados,
 * `observacionesPaciente`). El frontend `registro-sesion.service.ts` las
 * llama al inicio y al cierre de la sesión clínica diaria.
 *
 * Bajo el capó delegan en los helpers internos (`openOrResumeImpl`,
 * `closeImpl`) que centralizan la lógica BN1 (1 sesión por paciente, día).
 */

import { v } from "convex/values";
import { mutation } from "../_helpers/mutationWithTriggers";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { assertCanAccessClinic } from "../_helpers/authorization";
import { membershipEsPaciente } from "../_helpers/patientAccess";
import { getCurrentMadridDate } from "../_helpers/datetime";
import { closeImpl, openOrResumeImpl } from "./internal";

/**
 * Abre o reanuda la sesión del día del paciente autenticado. Idempotente:
 * llamarla varias veces el mismo día devuelve siempre la misma sesión.
 *
 * El argumento `fechaInicio` se acepta por compatibilidad con la firma
 * legacy pero solo se usa para derivar la fecha (YYYY-MM-DD Madrid). La
 * sesión real lleva el `fechaInicio` del momento de creación o del primer
 * ejercicio.
 */
export const create = mutation({
  args: {
    fechaInicio: v.optional(v.string()),
    // `clinicId` opcional durante el rollout. Cuando el frontend envía la
    // clínica activa del paciente, la sesión queda atada a ella y solo
    // contabiliza ejercicios de planes de esa clínica.
    clinicId: v.optional(v.id("clinics")),
    observacionesGenerales: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sessions">> => {
    const user = await getAuthenticatedUser(ctx);
    if (args.clinicId) {
      // Acepta al paciente puro y al fisio/admin que actúa como su propio
      // paciente (`tambienEsPaciente: true`), igual que el resto del backend
      // (`resolveAndAssertPacienteAndClinic`). El guard estricto `["paciente"]`
      // rechazaba a estos últimos al iniciar su sesión en /mi-plan.
      const membership = await assertCanAccessClinic(
        ctx,
        user._id,
        args.clinicId,
      );
      if (!membershipEsPaciente(membership)) {
        throw new Error("No tienes acceso a este recurso");
      }
    }
    // La fecha de la sesión es SIEMPRE la fecha actual Europe/Madrid, la
    // misma que `enforceMadridFecha` fuerza en las executions. Derivarla de
    // `args.fechaInicio` (ISO UTC) desalineaba sesión y ejecuciones de noche
    // (23:00-00:00 Madrid caía en el día UTC anterior).
    const fecha = getCurrentMadridDate();
    const fechaCliente = args.fechaInicio?.slice(0, 10);
    if (fechaCliente && fechaCliente !== fecha) {
      console.warn(
        `[tz_mismatch] sessions.create paciente=${user._id} ` +
          `fecha_recibida=${fechaCliente} fecha_esperada=${fecha} — forzando fecha Madrid.`,
      );
    }
    return await openOrResumeImpl(ctx, user._id, fecha, args.clinicId);
  },
});

/**
 * Cierra la sesión actual del paciente. Si se aporta `observacionesGenerales`,
 * se persiste como `observacionesPaciente` del modelo nuevo. La auto-decisión
 * `completada` vs `completada_parcial` la toma `closeImpl` según los
 * agregados (`totalCompletados >= totalEsperados`).
 *
 * El frontend pasa la firma legacy `{ sessionId, fechaFin?, observacionesGenerales? }`;
 * `fechaFin` se ignora (la genera `closeImpl` con `Date.now`).
 */
export const complete = mutation({
  args: {
    sessionId: v.id("sessions"),
    fechaFin: v.optional(v.string()),
    observacionesGenerales: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await getAuthenticatedUser(ctx);

    if (args.observacionesGenerales?.trim()) {
      await ctx.db.patch(args.sessionId, {
        observacionesPaciente: args.observacionesGenerales,
      });
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    // Materializa la observación general como alerta `comentario` para el
    // fisio (la idempotencia por sessionId la gestiona `createCommentAlert`).
    if (args.observacionesGenerales?.trim()) {
      await ctx.runMutation(internal.alerts.internal.createCommentAlert, {
        pacienteId: session.pacienteId,
        sessionId: args.sessionId,
        exerciseExecutionId: undefined,
        texto: args.observacionesGenerales,
      });
    }

    // Solo cerramos si está abierta. Si ya se cerró por completitud o cron
    // nocturno, la mutation es idempotente (no hace nada).
    if (session.estado === "en_curso") {
      await closeImpl(ctx, args.sessionId, "auto_completitud");
    }
  },
});
