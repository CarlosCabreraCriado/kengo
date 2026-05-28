import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { esPaciente } from "../_helpers/permissions";
import {
  getMadridDateOffset,
  anioMes,
  getCurrentMadridDate,
} from "../_helpers/datetime";
import { computeRiskScore, computeRachaActual } from "../_helpers/rollupComputation";
import { pacienteTienePlanEnCurso } from "../_helpers/planStatus";

type Ventana = "7d" | "15d" | "30d";
const VENTANAS: Ventana[] = ["7d", "15d", "30d"];
const ventanaValidator = v.union(
  v.literal("7d"),
  v.literal("15d"),
  v.literal("30d"),
);

function ventanaDays(ventana: Ventana): number {
  if (ventana === "7d") return 7;
  if (ventana === "15d") return 15;
  return 30;
}

/**
 * Recompute idempotente de `patientMetricsSnapshot` para un paciente y todas
 * las ventanas indicadas (default: 7d y 30d).
 *
 * Lectura: dailyPatientRollup (últimos N días) + monthlyPatientRollup (para
 * tendencia).
 */
export const recomputePatient = internalMutation({
  args: {
    pacienteId: v.id("users"),
    ventanas: v.optional(v.array(ventanaValidator)),
  },
  handler: async (ctx, args): Promise<void> => {
    const ventanas = args.ventanas ?? VENTANAS;
    for (const ventana of ventanas) {
      await recomputePatientForWindow(ctx, args.pacienteId, ventana);
    }
  },
});

async function recomputePatientForWindow(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  ventana: Ventana,
): Promise<void> {
  const dias = ventanaDays(ventana);
  const desde = getMadridDateOffset(-dias + 1);
  const hasta = getMadridDateOffset(0);

  const dailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
    )
    .collect();

  // Métricas básicas derivadas del rollup diario: adherencia, racha,
  // última actividad.
  let diasCompletados = 0;
  let diasParciales = 0;
  let diasConPlanNoDescanso = 0;
  let ultimaActividad: string | undefined;
  const dailyByFecha = new Map<string, Doc<"dailyPatientRollup">>();

  for (const d of dailies) {
    dailyByFecha.set(d.fecha, d);
    if (d.estadoDia === "completado") {
      diasCompletados += 1;
      diasConPlanNoDescanso += 1;
    } else if (d.estadoDia === "parcial") {
      diasParciales += 1;
      diasConPlanNoDescanso += 1;
      if (d.totalCompletados > 0) {
        if (!ultimaActividad || d.fecha > ultimaActividad)
          ultimaActividad = d.fecha;
      }
    } else if (d.estadoDia === "fallido") {
      diasConPlanNoDescanso += 1;
    }
    if (d.totalCompletados > 0) {
      if (!ultimaActividad || d.fecha > ultimaActividad)
        ultimaActividad = d.fecha;
    }
  }

  // Dolor: promedio de promedios POR SESIÓN sobre exerciseExecutions
  // completadas en la ventana. Misma fórmula que el detalle de paciente
  // (ver apps/app/src/.../cumplimiento.service.ts:buildEstadisticas).
  const executions = await ctx.db
    .query("exerciseExecutions")
    .withIndex("by_pacienteId_fecha", (q) =>
      q.eq("pacienteId", pacienteId).gte("fecha", desde).lte("fecha", hasta),
    )
    .collect();

  const dolorPorSesion = new Map<
    Id<"sessions">,
    { sum: number; count: number }
  >();
  for (const ex of executions) {
    if (!ex.completado) continue;
    if (ex.dolorEscala === undefined) continue;
    const acc = dolorPorSesion.get(ex.sessionId) ?? { sum: 0, count: 0 };
    acc.sum += ex.dolorEscala;
    acc.count += 1;
    dolorPorSesion.set(ex.sessionId, acc);
  }

  let sumPromediosSesion = 0;
  let nSesionesConDolor = 0;
  for (const { sum, count } of dolorPorSesion.values()) {
    if (count === 0) continue;
    sumPromediosSesion += sum / count;
    nSesionesConDolor += 1;
  }

  // Adherencia estricta: % de días con plan que se completaron al 100%.
  // Misma fórmula que el detalle (`cumplimiento.service.ts:buildCumplimientoResponse`).
  // Si la ventana no tiene días con plan (todo descanso/sin_plan), se deja
  // `undefined` para excluir al paciente del agregado de la clínica.
  const adherencia =
    diasConPlanNoDescanso > 0
      ? Math.round((diasCompletados / diasConPlanNoDescanso) * 100)
      : undefined;
  const dolorPromedio =
    nSesionesConDolor > 0
      ? Math.round((sumPromediosSesion / nSesionesConDolor) * 100) / 100
      : undefined;

  const inactividadDias = ultimaActividad
    ? Math.max(
        0,
        diffDays(ultimaActividad, hasta) - 0,
      )
    : dias;

  // Racha actual: serie de los últimos N días en orden cronológico.
  const fechas: string[] = [];
  for (let i = -dias + 1; i <= 0; i++) {
    fechas.push(getMadridDateOffset(i));
  }
  const rachaActual = computeRachaActual(
    fechas.map((f) => dailyByFecha.get(f)?.estadoDia ?? "sin_plan"),
  );

  // Tendencia (solo afecta a riskScore): mes actual vs anterior.
  const mesActual = anioMes(hasta);
  const monthlyActual = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_anioMes", (q) =>
      q.eq("pacienteId", pacienteId).eq("anioMes", mesActual),
    )
    .unique();
  const tendenciaAdherencia = monthlyActual?.tendenciaAdherencia;

  // Para riskScore tratamos "sin adherencia medible" como 0%: el paciente
  // no ha tenido días con plan y su riesgo lo determina `inactividadDias`.
  const riskScore = computeRiskScore({
    inactividadDias,
    adherencia: adherencia ?? 0,
    tendenciaAdherencia,
  });

  // Resolver clinicId y fisioId del paciente (primer membership / primer plan).
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", pacienteId))
    .first();
  if (!membership) return; // paciente sin clínica → no snapshoteable

  const planActivo = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "activo"),
    )
    .first();
  // Si no hay plan activo, dejamos el snapshot existente o creamos con
  // fisioId del primer plan completado para que aparezca en listas.
  const fisioId =
    planActivo?.fisioId ??
    (
      await ctx.db
        .query("plans")
        .withIndex("by_pacienteId", (q) => q.eq("pacienteId", pacienteId))
        .first()
    )?.fisioId;
  if (!fisioId) return; // paciente sin fisio asignado → no snapshoteable

  const existing = await ctx.db
    .query("patientMetricsSnapshot")
    .withIndex("by_pacienteId_ventana", (q) =>
      q.eq("pacienteId", pacienteId).eq("ventana", ventana),
    )
    .unique();

  const payload = {
    pacienteId,
    clinicId: membership.clinicId,
    fisioId,
    ventana,
    adherencia,
    dolorPromedio,
    ultimaActividad,
    inactividadDias,
    rachaActual,
    riskScore,
    actualizadoEn: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert("patientMetricsSnapshot", payload);
  }
}

/**
 * Recompute idempotente de `clinicMetricsSnapshot` para una clínica y todas
 * las ventanas indicadas.
 */
export const recomputeClinic = internalMutation({
  args: {
    clinicId: v.id("clinics"),
    ventanas: v.optional(v.array(ventanaValidator)),
  },
  handler: async (ctx, args): Promise<void> => {
    const ventanas = args.ventanas ?? VENTANAS;
    for (const ventana of ventanas) {
      await recomputeClinicForWindow(ctx, args.clinicId, ventana);
    }
  },
});

async function recomputeClinicForWindow(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
  ventana: Ventana,
): Promise<void> {
  // Pacientes con membership en la clínica.
  const memberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_clinicId", (q) => q.eq("clinicId", clinicId))
    .collect();
  const pacienteIds = Array.from(
    new Set(
      memberships.filter((m) => esPaciente(m.puesto)).map((m) => m.userId),
    ),
  );

  // pacientesActivos: pacientes con al menos un plan EN CURSO (estado activo
  // y fechas Madrid vigentes). Misma definición que el filtro "Activos · N"
  // del listado y que `plans.queries.listEnCursoPacientesInClinics`, vía el
  // helper compartido `pacienteTienePlanEnCurso`.
  const hoyMadrid = getCurrentMadridDate();
  const enCursoFlags = await Promise.all(
    pacienteIds.map((pid) => pacienteTienePlanEnCurso(ctx, pid, hoyMadrid)),
  );
  const pacientesActivos = enCursoFlags.filter(Boolean).length;
  const enCurso = new Set<Id<"users">>(
    pacienteIds.filter((_, i) => enCursoFlags[i]),
  );

  // Snapshots por paciente para esa ventana.
  const snapshots: Array<{
    pacienteId: Id<"users">;
    doc: Doc<"patientMetricsSnapshot">;
  }> = [];
  for (const pid of pacienteIds) {
    const snap = await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", pid).eq("ventana", ventana),
      )
      .unique();
    if (snap) snapshots.push({ pacienteId: pid, doc: snap });
  }

  // Adherencia: promedio de pacientes con plan EN CURSO HOY y con adherencia
  // medible (no `undefined`). Coincide con la fórmula estricta del detalle.
  let adhSum = 0;
  let adhCount = 0;
  for (const { pacienteId: pid, doc: s } of snapshots) {
    if (!enCurso.has(pid)) continue;
    if (s.adherencia === undefined) continue;
    adhSum += s.adherencia;
    adhCount += 1;
  }
  const adherenciaPromedio =
    adhCount > 0 ? Math.round(adhSum / adhCount) : 0;

  // Dolor: agregado sobre todos los snapshots con dolorPromedio definido.
  let dolorSum = 0;
  let dolorCount = 0;
  for (const { doc: s } of snapshots) {
    if (s.dolorPromedio !== undefined) {
      dolorSum += s.dolorPromedio;
      dolorCount += 1;
    }
  }
  const dolorMedio =
    dolorCount > 0 ? Math.round((dolorSum / dolorCount) * 100) / 100 : undefined;

  // Sesiones últimos 7 días en la clínica.
  const desde7 = getMadridDateOffset(-6);
  const hasta = getMadridDateOffset(0);
  const sesiones7 = await ctx.db
    .query("sessions")
    .withIndex("by_clinicId_fecha", (q) =>
      q.eq("clinicId", clinicId).gte("fecha", desde7).lte("fecha", hasta),
    )
    .collect();
  const sesionesUltimos7d = sesiones7.length;

  // Alertas pendientes.
  const alertasPendientes = (
    await ctx.db
      .query("physioAlerts")
      .withIndex("by_clinicId_estado", (q) =>
        q.eq("clinicId", clinicId).eq("estado", "pendiente"),
      )
      .collect()
  ).length;

  const existing = await ctx.db
    .query("clinicMetricsSnapshot")
    .withIndex("by_clinicId_ventana", (q) =>
      q.eq("clinicId", clinicId).eq("ventana", ventana),
    )
    .unique();

  const payload = {
    clinicId,
    ventana,
    pacientesActivos,
    adherenciaPromedio,
    dolorMedio,
    sesionesUltimos7d,
    alertasPendientes,
    actualizadoEn: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert("clinicMetricsSnapshot", payload);
  }
}

/**
 * Recompute completo de todos los pacientes con plan activo. Invocado por
 * `daily-maintenance`.
 */
export const recomputeAllPatients = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ procesados: number }> => {
    const planesActivos = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const pacienteIds = Array.from(
      new Set(planesActivos.map((p) => p.pacienteId)),
    );
    for (const pid of pacienteIds) {
      for (const ventana of VENTANAS) {
        await recomputePatientForWindow(ctx, pid, ventana);
      }
    }
    return { procesados: pacienteIds.length };
  },
});

/**
 * Recompute de todas las clínicas activas. Invocado por `daily-maintenance`.
 */
export const recomputeAllClinics = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ procesados: number }> => {
    const clinics = await ctx.db.query("clinics").collect();
    for (const c of clinics) {
      for (const ventana of VENTANAS) {
        await recomputeClinicForWindow(ctx, c._id, ventana);
      }
    }
    return { procesados: clinics.length };
  },
});

/**
 * Recompute de `exerciseUsageRollup` para un mes (default: mes en curso).
 * Idempotente.
 */
export const recomputeExerciseUsage = internalMutation({
  args: {
    anioMes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ procesados: number }> => {
    const targetAnioMes = args.anioMes ?? anioMes(getMadridDateOffset(0));
    const desde = `${targetAnioMes}-01`;
    const hasta = `${targetAnioMes}-31`; // approx; comparación es lexicográfica YYYY-MM-DD

    const clinics = await ctx.db.query("clinics").collect();
    let procesados = 0;
    for (const clinic of clinics) {
      const executions = await ctx.db
        .query("exerciseExecutions")
        .withIndex("by_clinicId_fecha", (q) =>
          q.eq("clinicId", clinic._id).gte("fecha", desde).lte("fecha", hasta),
        )
        .collect();

      // Agrupar por exerciseId (resolviendo desde planExerciseId).
      // Cache planExerciseId → exerciseId para evitar lookups repetidos.
      const peCache = new Map<Id<"planExercises">, Id<"exercises">>();
      const stats = new Map<
        Id<"exercises">,
        {
          completado: number;
          parcial: number;
          dolores: number[];
          dolorMax?: number;
          pacientes: Set<Id<"users">>;
        }
      >();

      for (const ex of executions) {
        let exerciseId = peCache.get(ex.planExerciseId);
        if (!exerciseId) {
          const pe = await ctx.db.get(ex.planExerciseId);
          if (!pe) continue;
          exerciseId = pe.exerciseId;
          peCache.set(ex.planExerciseId, exerciseId);
        }
        let s = stats.get(exerciseId);
        if (!s) {
          s = {
            completado: 0,
            parcial: 0,
            dolores: [],
            pacientes: new Set(),
          };
          stats.set(exerciseId, s);
        }
        if (ex.completado) s.completado += 1;
        else s.parcial += 1;
        if (ex.dolorEscala !== undefined) {
          s.dolores.push(ex.dolorEscala);
          if (s.dolorMax === undefined || ex.dolorEscala > s.dolorMax) {
            s.dolorMax = ex.dolorEscala;
          }
        }
        s.pacientes.add(ex.pacienteId);
      }

      // vecesPrescrito = count de planExercises activos con ese exerciseId
      // en los planes activos de la clínica. Por simplicidad, lo dejamos en
      // 0 si no hay datos (puede mejorarse en una iteración futura).
      for (const [exerciseId, s] of stats.entries()) {
        const dolorMedio =
          s.dolores.length > 0
            ? Math.round(
                (s.dolores.reduce((a, b) => a + b, 0) / s.dolores.length) *
                  100,
              ) / 100
            : undefined;

        const existing = await ctx.db
          .query("exerciseUsageRollup")
          .withIndex("by_clinicId_anioMes", (q) =>
            q.eq("clinicId", clinic._id).eq("anioMes", targetAnioMes),
          )
          .filter((q) => q.eq(q.field("exerciseId"), exerciseId))
          .unique();

        const payload = {
          clinicId: clinic._id,
          exerciseId,
          anioMes: targetAnioMes,
          vecesPrescrito: 0,
          vecesCompletado: s.completado,
          vecesParcial: s.parcial,
          dolorMedio,
          dolorMax: s.dolorMax,
          pacientesUnicos: s.pacientes.size,
          actualizadoEn: Date.now(),
        };
        if (existing) {
          await ctx.db.patch(existing._id, payload);
        } else {
          await ctx.db.insert("exerciseUsageRollup", payload);
        }
        procesados += 1;
      }
    }
    return { procesados };
  },
});

function diffDays(desdeYMD: string, hastaYMD: string): number {
  const [y1, m1, d1] = desdeYMD.split("-").map(Number);
  const [y2, m2, d2] = hastaYMD.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}
