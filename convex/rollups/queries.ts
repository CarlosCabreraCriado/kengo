import { v } from "convex/values";
import { query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { resolveAndAssertPacienteAndClinic } from "../_helpers/patientAccess";
import {
  getActivePlansForPatientOnDate,
  getExpectedExercisesForPatientOnDate,
} from "../_helpers/expectedExercises";
import { addDaysToYMD, getDiaSemana } from "../_helpers/datetime";
import { getPatientToday } from "../_helpers/patientTz";
import {
  buildVirtualDailyRollup,
  missingDatesInRange,
  VirtualDailyRollup,
} from "../_helpers/virtualDaily";

/**
 * Cota superior de días virtuales por consulta: acota el coste de la
 * reconstrucción al vuelo en rangos amplios (p.ej. "año en curso" del modo
 * paciente). Las vistas que calculan adherencia usan ventanas ≤ 30 días.
 */
const MAX_VIRTUAL_DAYS = 62;

/**
 * Devuelve los rollups diarios de un paciente entre dos fechas (inclusivas).
 * Sustituye a `compliance.queries.getByPaciente`.
 *
 * Aislamiento por clínica: si llega `clinicId`, filtra estrictamente los
 * rollups de esa clínica vía el índice particionado. Los rollups legados
 * sin `clinicId` quedan excluidos (los aborda el backfill 3b).
 *
 * Días sin rollup persistido: para cada fecha ya pasada (hasta AYER en la TZ
 * del paciente) del rango que no tenga documento, se reconstruye al vuelo un
 * rollup virtual (`fallido`/`descanso` según el plan vigente, ver
 * `_helpers/virtualDaily.ts`) si el paciente tenía plan ese día. Así la
 * adherencia mostrada no depende de que el cron de materialización haya
 * corrido: un día programado sin sesión cuenta en el denominador aunque no
 * exista en BD. Los días virtuales llevan `virtual: true` (los consumidores
 * lo ignoran). "Hoy" nunca se rellena: aún puede completarse.
 */
export const getDailyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desde: v.string(),
    hasta: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    const persisted: Doc<"dailyPatientRollup">[] = targetClinicId
      ? await ctx.db
          .query("dailyPatientRollup")
          .withIndex("by_pacienteId_clinicId_fecha", (q) =>
            q
              .eq("pacienteId", targetUserId)
              .eq("clinicId", targetClinicId)
              .gte("fecha", args.desde)
              .lte("fecha", args.hasta),
          )
          .collect()
      : await ctx.db
          .query("dailyPatientRollup")
          .withIndex("by_pacienteId_fecha", (q) =>
            q
              .eq("pacienteId", targetUserId)
              .gte("fecha", args.desde)
              .lte("fecha", args.hasta),
          )
          .collect();

    const virtuales = await buildVirtualDailiesForGaps(
      ctx,
      targetUserId,
      targetClinicId,
      args.desde,
      args.hasta,
      persisted,
    );
    if (virtuales.length === 0) return persisted;

    const out: (Doc<"dailyPatientRollup"> | VirtualDailyRollup)[] = [
      ...persisted,
      ...virtuales,
    ];
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  },
});

/**
 * Reconstruye rollups virtuales para las fechas de `[desde, hasta]` ya
 * pasadas (≤ ayer en la TZ del paciente) sin rollup persistido y con plan
 * vigente. Sin `clinicId`, se emite un virtual por cada clínica con plan
 * vigente ese día que no tenga ya rollup.
 */
async function buildVirtualDailiesForGaps(
  ctx: QueryCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics"> | undefined,
  desde: string,
  hasta: string,
  persisted: Doc<"dailyPatientRollup">[],
): Promise<VirtualDailyRollup[]> {
  const ayer = addDaysToYMD(await getPatientToday(ctx, pacienteId), -1);
  const hastaPasado = hasta < ayer ? hasta : ayer;

  // Con filtro de clínica hay como mucho un rollup por fecha; sin filtro,
  // una fecha "presente" es la que ya tiene rollup en alguna clínica y se
  // completa por clínica más abajo.
  const presentes = new Set(persisted.map((d) => d.fecha));
  const presentesPorClinica = new Set(
    persisted.map((d) => `${d.clinicId}|${d.fecha}`),
  );

  let huecos = missingDatesInRange(desde, hastaPasado, clinicId ? presentes : new Set());
  if (huecos.length > MAX_VIRTUAL_DAYS) {
    huecos = huecos.slice(-MAX_VIRTUAL_DAYS); // los más recientes
  }
  if (huecos.length === 0) return [];

  const ahora = Date.now();
  const out: VirtualDailyRollup[] = [];
  for (const fecha of huecos) {
    const planes = (
      await getActivePlansForPatientOnDate(ctx, pacienteId, fecha, clinicId)
    ).filter((p) => p.clinicId !== undefined);
    if (planes.length === 0) continue;

    const clinicIds = new Set(planes.map((p) => p.clinicId!));
    for (const cId of clinicIds) {
      if (presentesPorClinica.has(`${cId}|${fecha}`)) continue;
      const expected = await getExpectedExercisesForPatientOnDate(
        ctx,
        pacienteId,
        fecha,
        getDiaSemana(fecha),
        cId,
      );
      out.push(
        buildVirtualDailyRollup({
          pacienteId,
          clinicId: cId,
          fecha,
          planIds: planes.filter((p) => p.clinicId === cId).map((p) => p._id),
          expected,
          ahora,
        }),
      );
    }
  }
  return out;
}

/**
 * Devuelve los rollups semanales de un paciente entre dos semanas ISO
 * (inclusivas, formato "YYYY-Www"). El orden es ascendente.
 *
 * Aislamiento por clínica: si llega `clinicId`, filtra estrictamente los
 * rollups particionados (sub-fase 3a). Rollups legados sin `clinicId`
 * quedan excluidos (los aborda el backfill 3b).
 */
export const getWeeklyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desdeAnioSemana: v.string(),
    hastaAnioSemana: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    if (targetClinicId) {
      return await ctx.db
        .query("weeklyPatientRollup")
        .withIndex("by_pacienteId_clinicId_anioSemana", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .eq("clinicId", targetClinicId)
            .gte("anioSemana", args.desdeAnioSemana)
            .lte("anioSemana", args.hastaAnioSemana),
        )
        .collect();
    }

    return await ctx.db
      .query("weeklyPatientRollup")
      .withIndex("by_pacienteId_anioSemana", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("anioSemana", args.desdeAnioSemana)
          .lte("anioSemana", args.hastaAnioSemana),
      )
      .collect();
  },
});

/**
 * Devuelve los rollups mensuales de un paciente entre dos meses (inclusivos,
 * formato "YYYY-MM"). El orden es ascendente.
 *
 * Aislamiento por clínica: ver nota en `getWeeklyByPaciente`.
 */
export const getMonthlyByPaciente = query({
  args: {
    pacienteId: v.optional(v.string()),
    clinicId: v.optional(v.id("clinics")),
    desdeAnioMes: v.string(),
    hastaAnioMes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const { pacienteId: targetUserId, clinicId: targetClinicId } =
      await resolveAndAssertPacienteAndClinic(
        ctx,
        args.pacienteId,
        args.clinicId,
        user._id,
      );

    if (targetClinicId) {
      return await ctx.db
        .query("monthlyPatientRollup")
        .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
          q
            .eq("pacienteId", targetUserId)
            .eq("clinicId", targetClinicId)
            .gte("anioMes", args.desdeAnioMes)
            .lte("anioMes", args.hastaAnioMes),
        )
        .collect();
    }

    return await ctx.db
      .query("monthlyPatientRollup")
      .withIndex("by_pacienteId_anioMes", (q) =>
        q
          .eq("pacienteId", targetUserId)
          .gte("anioMes", args.desdeAnioMes)
          .lte("anioMes", args.hastaAnioMes),
      )
      .collect();
  },
});
