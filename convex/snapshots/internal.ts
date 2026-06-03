import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import {
  getMadridDateOffset,
  anioMes,
  getCurrentMadridDate,
} from "../_helpers/datetime";
import { computeRiskScore, computeRachaActual } from "../_helpers/rollupComputation";
import { pacienteTienePlanEnCurso } from "../_helpers/planStatus";
import { executionsByPaciente } from "../aggregates/executionsByPaciente";
import { executionsByPacienteDolor } from "../aggregates/executionsByPacienteDolor";
import { patientsByClinicAdherencia } from "../aggregates/patientsByClinicAdherencia";
import { patientsByClinicRiskScore } from "../aggregates/patientsByClinicRiskScore";
import { patientsByClinicDolor } from "../aggregates/patientsByClinicDolor";
import { patientsWithActivePlanByClinic } from "../aggregates/patientsWithActivePlanByClinic";
import { plansByClinicActive } from "../aggregates/plansByClinicActive";
import { sessionsByClinic } from "../aggregates/sessionsByClinic";

type Ventana = "7d" | "15d" | "30d";
export const VENTANAS: Ventana[] = ["7d", "15d", "30d"];
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
 * las ventanas indicadas (default: 7d, 15d, 30d).
 *
 * Tras la partición por clínica (fase 3a), el snapshot pasa a ser
 * `(pacienteId, clinicId, ventana)`: si el paciente está en varias clínicas
 * con planes, se generan N snapshots por ventana. Se itera sobre las clínicas
 * donde el paciente tiene rol `paciente` y al menos un plan activo.
 */
export const recomputePatient = internalMutation({
  args: {
    pacienteId: v.id("users"),
    ventanas: v.optional(v.array(ventanaValidator)),
  },
  handler: async (ctx, args): Promise<void> => {
    const ventanas = args.ventanas ?? VENTANAS;
    const clinicIds = await getPacienteClinicIdsWithActivePlans(
      ctx,
      args.pacienteId,
    );
    for (const clinicId of clinicIds) {
      for (const ventana of ventanas) {
        await recomputePatientForWindow(ctx, args.pacienteId, clinicId, ventana);
      }
    }
  },
});

/**
 * Devuelve las clínicas donde el paciente tiene al menos un plan activo
 * (vigente). Es el conjunto que justifica un snapshot por clínica.
 */
async function getPacienteClinicIdsWithActivePlans(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
): Promise<Id<"clinics">[]> {
  const planesActivos = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "activo"),
    )
    .collect();
  const set = new Set<Id<"clinics">>();
  for (const p of planesActivos) {
    if (p.clinicId) set.add(p.clinicId);
  }
  return [...set];
}

async function recomputePatientForWindow(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
  ventana: Ventana,
): Promise<void> {
  const dias = ventanaDays(ventana);
  const desde = getMadridDateOffset(-dias + 1);
  const hasta = getMadridDateOffset(0);

  const dailies = await ctx.db
    .query("dailyPatientRollup")
    .withIndex("by_pacienteId_clinicId_fecha", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    )
    .collect();

  // Iteramos dailies sólo para `ultimaActividad` y `dailyByFecha` (rachaActual).
  // Adherencia y dolorPromedio se leen del aggregate.
  let ultimaActividad: string | undefined;
  const dailyByFecha = new Map<string, Doc<"dailyPatientRollup">>();
  for (const d of dailies) {
    dailyByFecha.set(d.fecha, d);
    if (d.totalCompletados > 0) {
      if (!ultimaActividad || d.fecha > ultimaActividad)
        ultimaActividad = d.fecha;
    }
  }

  // Adherencia (sum/count) y dolorPromedio leídos directamente del aggregate
  // particionado por (paciente, clínica). PR H5: sustituye el cálculo previo
  // que iteraba dailies + executions con fórmulas distintas.
  const aggNamespace: [Id<"users">, Id<"clinics">] = [pacienteId, clinicId];
  const aggBounds = {
    lower: { key: desde, inclusive: true },
    upper: { key: hasta, inclusive: true },
  } as const;
  const adhCount = await executionsByPaciente.count(ctx, {
    namespace: aggNamespace,
    bounds: aggBounds,
  });
  const adhSum = await executionsByPaciente.sum(ctx, {
    namespace: aggNamespace,
    bounds: aggBounds,
  });
  const adherencia =
    adhCount > 0 ? Math.round((adhSum / adhCount) * 100) : undefined;

  const dolorCount = await executionsByPacienteDolor.count(ctx, {
    namespace: aggNamespace,
    bounds: aggBounds,
  });
  const dolorSum = await executionsByPacienteDolor.sum(ctx, {
    namespace: aggNamespace,
    bounds: aggBounds,
  });
  const dolorPromedio =
    dolorCount > 0 ? Math.round((dolorSum / dolorCount) * 100) / 100 : undefined;

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

  // Tendencia (solo afecta a riskScore): mes actual vs anterior, de esta clínica.
  const mesActual = anioMes(hasta);
  const monthlyActual = await ctx.db
    .query("monthlyPatientRollup")
    .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
      q
        .eq("pacienteId", pacienteId)
        .eq("clinicId", clinicId)
        .eq("anioMes", mesActual),
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

  // Resolver fisioId desde un plan de esta clínica (activo o, en su defecto,
  // cualquiera). Buscamos primero el plan activo de la clínica.
  const planesActivosClinica = await ctx.db
    .query("plans")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "activo"),
    )
    .collect();
  const planActivoClinica = planesActivosClinica.find(
    (p) => p.clinicId === clinicId,
  );
  let fisioId = planActivoClinica?.fisioId;
  if (!fisioId) {
    const planesPaciente = await ctx.db
      .query("plans")
      .withIndex("by_pacienteId", (q) => q.eq("pacienteId", pacienteId))
      .collect();
    fisioId = planesPaciente.find((p) => p.clinicId === clinicId)?.fisioId;
  }
  if (!fisioId) return; // sin fisio en esta clínica → no snapshoteable

  // El snapshot existente puede haber sido escrito por la versión antigua
  // (sin distinguir clínica). Si el snapshot de esta `(paciente, ventana)`
  // tiene un `clinicId` distinto, lo dejamos en paz y creamos uno nuevo
  // (el backfill normalizará el modelo).
  const existing = await ctx.db
    .query("patientMetricsSnapshot")
    .withIndex("by_pacienteId_ventana", (q) =>
      q.eq("pacienteId", pacienteId).eq("ventana", ventana),
    )
    .filter((q) => q.eq(q.field("clinicId"), clinicId))
    .first();

  const payload = {
    pacienteId,
    clinicId,
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

  // Mantener DirectAggregates sincronizados con los valores del snapshot.
  // patientsByClinicAdherencia ordena por adherencia (asc) y se lee desde
  // getPatientMetrics (orden adherencia) y recomputeClinic.adherenciaPromedio
  // (sum/count, PR H6b). Para que sum() devuelva la suma de adherencias hay
  // que pasar `sumValue: adherencia` explícito en insert/replace — por
  // defecto DirectAggregate asume sumValue=0.
  // Sync tolerante (H6c): usamos las variantes *IfExists / *OrInsert para
  // que purgas externas (p.ej. la cascada de plan completado/cancelado en
  // `_syncPatientActiveStateInClinic`) no rompan el siguiente recompute.
  // Si la entry no existía cuando se esperaba, `replaceOrInsert` la inserta;
  // `deleteIfExists` es no-op. El comportamiento en condiciones normales es
  // idéntico al sync original.
  const dirNS: [Id<"clinics">, Ventana] = [clinicId, ventana];
  const oldAdh = existing?.adherencia;
  if (oldAdh != null && adherencia != null && oldAdh !== adherencia) {
    await patientsByClinicAdherencia.replaceOrInsert(
      ctx,
      { namespace: dirNS, key: oldAdh, id: pacienteId },
      { namespace: dirNS, key: adherencia, sumValue: adherencia },
    );
  } else if (oldAdh == null && adherencia != null) {
    await patientsByClinicAdherencia.insertIfDoesNotExist(ctx, {
      namespace: dirNS,
      key: adherencia,
      id: pacienteId,
      sumValue: adherencia,
    });
  } else if (oldAdh != null && adherencia == null) {
    await patientsByClinicAdherencia.deleteIfExists(ctx, {
      namespace: dirNS,
      key: oldAdh,
      id: pacienteId,
    });
  }

  const oldRisk = existing?.riskScore;
  if (oldRisk != null && oldRisk !== riskScore) {
    await patientsByClinicRiskScore.replaceOrInsert(
      ctx,
      { namespace: dirNS, key: oldRisk, id: pacienteId },
      { namespace: dirNS, key: riskScore },
    );
  } else if (oldRisk == null) {
    await patientsByClinicRiskScore.insertIfDoesNotExist(ctx, {
      namespace: dirNS,
      key: riskScore,
      id: pacienteId,
    });
  }

  // patientsByClinicDolor (PR H6): sum/count desde recomputeClinic. Necesita
  // `sumValue: dolorPromedio` para que sum() devuelva suma de dolores.
  const oldDolor = existing?.dolorPromedio;
  if (oldDolor != null && dolorPromedio != null && oldDolor !== dolorPromedio) {
    await patientsByClinicDolor.replaceOrInsert(
      ctx,
      { namespace: dirNS, key: oldDolor, id: pacienteId },
      { namespace: dirNS, key: dolorPromedio, sumValue: dolorPromedio },
    );
  } else if (oldDolor == null && dolorPromedio != null) {
    await patientsByClinicDolor.insertIfDoesNotExist(ctx, {
      namespace: dirNS,
      key: dolorPromedio,
      id: pacienteId,
      sumValue: dolorPromedio,
    });
  } else if (oldDolor != null && dolorPromedio == null) {
    await patientsByClinicDolor.deleteIfExists(ctx, {
      namespace: dirNS,
      key: oldDolor,
      id: pacienteId,
    });
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
  // pacientesActivos (F7-close): pacientes ÚNICOS con al menos un plan en
  // curso, leído del DirectAggregate `patientsWithActivePlanByClinic`. La
  // unicidad la garantiza el aggregate (id=pacienteId); el sync vive en
  // `_syncPatientActiveStateInClinic` (mutations de planes + sweep diario).
  const pacientesActivos = await patientsWithActivePlanByClinic.count(ctx, {
    namespace: clinicId,
  });

  // Adherencia (PR H6b): se lee del DirectAggregate
  // `patientsByClinicAdherencia` vía sum()/count(). Tras H6c los aggregates
  // solo contienen pacientes con plan activo en la clínica, por lo que
  // sum/count representa correctamente la "salud actual" sin necesidad de
  // iterar snapshots ni filtrar por enCurso.
  const adherenciaPromedio = await loadAdherenciaPromedio(
    ctx,
    clinicId,
    ventana,
  );

  // Dolor (PR H6): se lee del DirectAggregate `patientsByClinicDolor`, que se
  // mantiene en sync desde `recomputePatientForWindow`. Sustituye la iteración
  // previa sobre snapshots.
  const dolorMedio = await loadDolorMedio(ctx, clinicId, ventana);

  // Sesiones últimos 7 días en la clínica (PR H6): se leen del aggregate
  // `sessionsByClinic`. Su `sumValue = esSintetica ? 0 : 1`, por lo que sum()
  // cuenta sólo sesiones reales — el legacy contaba TODO en el rango
  // (incluidas sintéticas). Cambio semántico aceptado.
  const desde7 = getMadridDateOffset(-6);
  const hasta = getMadridDateOffset(0);
  const sesionesUltimos7d = await loadSesionesUltimos7d(
    ctx,
    clinicId,
    desde7,
    hasta,
  );

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
 * `daily-maintenance`. Genera un snapshot por (paciente, clínica, ventana).
 *
 * F8-simplify: el set de trabajo se descubre iterando los namespaces del
 * aggregate `plansByClinicActive` (clínicas con ≥1 plan activo) y, por
 * clínica, leyendo planes vía `by_clinicId_estado`. Equivalente semántico al
 * `.collect() by_estado` previo, sin el riesgo de chocar contra el límite de
 * lectura por mutation cuando la tabla `plans` crece.
 */
export const recomputeAllPatients = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ procesados: number }> => {
    const pares = new Set<string>();
    for await (const clinicId of plansByClinicActive.iterNamespaces(ctx)) {
      const plans = await ctx.db
        .query("plans")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "activo"),
        )
        .collect();
      for (const p of plans) {
        pares.add(`${p.pacienteId}|${p.clinicId}`);
      }
    }
    for (const key of pares) {
      const [pid, cid] = key.split("|") as [Id<"users">, Id<"clinics">];
      for (const ventana of VENTANAS) {
        await recomputePatientForWindow(ctx, pid, cid, ventana);
      }
    }
    return { procesados: pares.size };
  },
});

/**
 * Sweep diario que reevalúa `patientsWithActivePlanByClinic` para todos
 * los pares `(pacienteId, clinicId)` con plan en estado "activo".
 * Necesario porque `isPlanEnCurso` depende de la fecha actual (un plan
 * con `fechaInicio` futura entra "en curso" al amanecer; uno con
 * `fechaFin` vencida sale). Las mutations de `plans` sincronizan el
 * aggregate cuando cambia `estado`/`fechas`, pero no pueden anticiparse
 * al cambio de día.
 *
 * Idempotente: el helper hace `insertIfDoesNotExist` / `deleteIfExists`.
 * Pares con varios planes activos se procesan una sola vez (Set por
 * `pacienteId|clinicId`).
 *
 * Invocado por `compliance.dailyMaintenance` después de
 * `expireOverduePlansImpl` (que ya sincronizó los planes que vencen
 * hoy) y antes de `recomputeAllClinics` (que leerá el aggregate fresco).
 */
export const syncActivePatientsAllClinics = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ procesados: number }> => {
    const paresVistos = new Set<string>();
    let procesados = 0;
    for await (const clinicId of plansByClinicActive.iterNamespaces(ctx)) {
      const plans = await ctx.db
        .query("plans")
        .withIndex("by_clinicId_estado", (q) =>
          q.eq("clinicId", clinicId).eq("estado", "activo"),
        )
        .collect();
      for (const p of plans) {
        const key = `${p.pacienteId}|${clinicId}`;
        if (paresVistos.has(key)) continue;
        paresVistos.add(key);
        await _syncPatientActiveStateInClinic(ctx, p.pacienteId, clinicId);
        procesados += 1;
      }
    }
    return { procesados };
  },
});

/**
 * Recompute de todas las clínicas con planes activos. Invocado por
 * `daily-maintenance`.
 *
 * F8-simplify — trade-off: iteramos sólo namespaces de `plansByClinicActive`,
 * es decir, clínicas con al menos un plan en estado "activo". Una clínica que
 * pierde su último plan activo NO entra al cron hasta que reaparezca un plan;
 * su `clinicMetricsSnapshot` queda con los últimos valores (pacientesActivos
 * puede mostrar el conteo de ayer). Si en el futuro la UI muestra clínicas
 * "vacías", añadir un cron de limpieza o forzar recompute en el trigger de
 * `plans` cuando el último activo cae.
 */
export const recomputeAllClinics = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ procesados: number }> => {
    let procesados = 0;
    for await (const clinicId of plansByClinicActive.iterNamespaces(ctx)) {
      for (const ventana of VENTANAS) {
        await recomputeClinicForWindow(ctx, clinicId, ventana);
      }
      procesados += 1;
    }
    return { procesados };
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

async function loadDolorMedio(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
  ventana: Ventana,
): Promise<number | undefined> {
  const ns: [Id<"clinics">, Ventana] = [clinicId, ventana];
  const count = await patientsByClinicDolor.count(ctx, { namespace: ns });
  const sum = await patientsByClinicDolor.sum(ctx, { namespace: ns });
  return count > 0 ? Math.round((sum / count) * 100) / 100 : undefined;
}

async function loadSesionesUltimos7d(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
  desde7: string,
  hasta: string,
): Promise<number> {
  return await sessionsByClinic.sum(ctx, {
    namespace: clinicId,
    bounds: {
      lower: { key: desde7, inclusive: true },
      upper: { key: hasta, inclusive: true },
    },
  });
}

async function loadAdherenciaPromedio(
  ctx: QueryCtx,
  clinicId: Id<"clinics">,
  ventana: Ventana,
): Promise<number> {
  const ns: [Id<"clinics">, Ventana] = [clinicId, ventana];
  const count = await patientsByClinicAdherencia.count(ctx, { namespace: ns });
  if (count === 0) return 0;
  const sum = await patientsByClinicAdherencia.sum(ctx, { namespace: ns });
  return Math.round(sum / count);
}

/**
 * Purga los `patientMetricsSnapshot` de un paciente en una clínica concreta
 * (las 3 ventanas) junto con sus entradas en los DirectAggregates
 * particionados por `(clinicId, ventana)`:
 *   - `patientsByClinicAdherencia`
 *   - `patientsByClinicRiskScore`
 *   - `patientsByClinicDolor`
 *
 * Pensado para invocarse desde la cascada de `clinicMemberships.remove`
 * cuando un paciente sale de una clínica: sin esta purga, los snapshots
 * y aggregates quedan huérfanos y desvían el `dolorMedio`/adherencia que
 * lee `recomputeClinicForWindow`.
 *
 * Usa el mismo patrón de mutación de aggregates que
 * `recomputePatientForWindow`: las métricas opcionales (`adherencia`,
 * `dolorPromedio`) solo se eliminan del aggregate si están definidas en
 * el snapshot; `riskScore` siempre está (es obligatorio en schema).
 */
async function _deletePatientSnapshotsForClinic(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<{ deletedSnapshots: number; ventanasProcesadas: Ventana[] }> {
  const ventanasProcesadas: Ventana[] = [];
  let deletedSnapshots = 0;

  for (const ventana of VENTANAS) {
    const snap = await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", pacienteId).eq("ventana", ventana),
      )
      .filter((q) => q.eq(q.field("clinicId"), clinicId))
      .first();
    if (!snap) continue;

    const dirNS: [Id<"clinics">, Ventana] = [clinicId, ventana];

    if (snap.adherencia != null) {
      await patientsByClinicAdherencia.delete(ctx, {
        namespace: dirNS,
        key: snap.adherencia,
        id: pacienteId,
      });
    }

    await patientsByClinicRiskScore.delete(ctx, {
      namespace: dirNS,
      key: snap.riskScore,
      id: pacienteId,
    });

    if (snap.dolorPromedio != null) {
      await patientsByClinicDolor.delete(ctx, {
        namespace: dirNS,
        key: snap.dolorPromedio,
        id: pacienteId,
      });
    }

    await ctx.db.delete(snap._id);
    deletedSnapshots += 1;
    ventanasProcesadas.push(ventana);
  }

  return { deletedSnapshots, ventanasProcesadas };
}

export { _deletePatientSnapshotsForClinic };

/**
 * Variante "clínica entera" del helper anterior: purga TODOS los
 * `patientMetricsSnapshot` de una clínica junto con sus entradas en los
 * 3 DirectAggregates particionados por `(clinicId, ventana)`.
 *
 * Pensado para invocarse desde `migrations/deleteClinicCascade.run` antes
 * del borrado masivo de la tabla, para no dejar entradas huérfanas en los
 * aggregates (mismo bug que `clinicMemberships.remove` antes de la
 * cascada).
 *
 * Iteramos por el índice `by_clinicId_ventana_riskScore`, que cubre TODOS
 * los snapshots de la clínica en una sola query independientemente del
 * paciente. Por cada snapshot encontrado purgamos sus entradas en los 3
 * aggregates con el mismo criterio que `_deletePatientSnapshotsForClinic`
 * (las métricas opcionales solo se borran si están definidas).
 */
async function _deleteAllPatientSnapshotsForClinic(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<{ deletedSnapshots: number }> {
  const snaps = await ctx.db
    .query("patientMetricsSnapshot")
    .withIndex("by_clinicId_ventana_riskScore", (q) =>
      q.eq("clinicId", clinicId),
    )
    .collect();

  for (const snap of snaps) {
    const dirNS: [Id<"clinics">, Ventana] = [clinicId, snap.ventana];

    if (snap.adherencia != null) {
      await patientsByClinicAdherencia.delete(ctx, {
        namespace: dirNS,
        key: snap.adherencia,
        id: snap.pacienteId,
      });
    }

    await patientsByClinicRiskScore.delete(ctx, {
      namespace: dirNS,
      key: snap.riskScore,
      id: snap.pacienteId,
    });

    if (snap.dolorPromedio != null) {
      await patientsByClinicDolor.delete(ctx, {
        namespace: dirNS,
        key: snap.dolorPromedio,
        id: snap.pacienteId,
      });
    }

    await ctx.db.delete(snap._id);
  }

  return { deletedSnapshots: snaps.length };
}

export { _deleteAllPatientSnapshotsForClinic };

/**
 * F7-close — sincroniza el estado "tiene plan en curso" de un paciente en
 * una clínica con el aggregate `patientsWithActivePlanByClinic`, y purga
 * los aggregates por ventana (`patientsByClinic{Adherencia,RiskScore,Dolor}`)
 * cuando el paciente queda sin plan en curso.
 *
 * Comportamiento:
 *   - Si el paciente tiene al menos un plan en curso hoy (estado activo +
 *     fechas Madrid vigentes) → `insertIfDoesNotExist` en el aggregate
 *     Active y NO toca los 3 aggregates por ventana (sus entries se
 *     mantienen vivas mientras el paciente está activo).
 *   - Si NO tiene ningún plan en curso → `deleteIfExists` en el aggregate
 *     Active + purga las entries por ventana de los 3 aggregates legacy
 *     (idempotente). NO borra el documento `patientMetricsSnapshot` — el
 *     histórico sigue accesible vía `getPatientMetricsByPaciente`.
 *
 * Idempotente y seguro de llamar siempre tras cualquier patch de
 * `plans.estado` o `plans.fechaInicio/fechaFin`. Sustituye a
 * `_purgeAggregatesForInactivePatient` (que solo cubría el sentido
 * "inactivar"); el nuevo helper también cubre la inserción al reactivar
 * un paciente, eliminando la necesidad de recomputos sincrónicos del
 * snapshot de clínica desde mutations de planes.
 *
 * Se invoca desde `plans.{create,updateEstado,update,remove,version}` y
 * desde `expireOverduePlansImpl`. La cascada de `clinicMemberships.remove`
 * sigue usando `_deletePatientSnapshotsForClinic` (purga documento +
 * aggregates) porque el paciente sale de la clínica completamente.
 */
async function _syncPatientActiveStateInClinic(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  clinicId: Id<"clinics">,
): Promise<{ inserted: boolean; purgadas: number }> {
  const hoyMadrid = getCurrentMadridDate();
  const tieneEnCurso = await pacienteTienePlanEnCurso(
    ctx,
    pacienteId,
    hoyMadrid,
  );

  if (tieneEnCurso) {
    await patientsWithActivePlanByClinic.insertIfDoesNotExist(ctx, {
      namespace: clinicId,
      key: null,
      id: pacienteId,
    });
    return { inserted: true, purgadas: 0 };
  }

  await patientsWithActivePlanByClinic.deleteIfExists(ctx, {
    namespace: clinicId,
    key: null,
    id: pacienteId,
  });

  let purgadas = 0;
  for (const ventana of VENTANAS) {
    const snap = await ctx.db
      .query("patientMetricsSnapshot")
      .withIndex("by_pacienteId_ventana", (q) =>
        q.eq("pacienteId", pacienteId).eq("ventana", ventana),
      )
      .filter((q) => q.eq(q.field("clinicId"), clinicId))
      .first();
    if (!snap) continue;
    const dirNS: [Id<"clinics">, Ventana] = [clinicId, ventana];

    if (snap.adherencia != null) {
      await patientsByClinicAdherencia.deleteIfExists(ctx, {
        namespace: dirNS,
        key: snap.adherencia,
        id: pacienteId,
      });
      purgadas += 1;
    }
    await patientsByClinicRiskScore.deleteIfExists(ctx, {
      namespace: dirNS,
      key: snap.riskScore,
      id: pacienteId,
    });
    purgadas += 1;
    if (snap.dolorPromedio != null) {
      await patientsByClinicDolor.deleteIfExists(ctx, {
        namespace: dirNS,
        key: snap.dolorPromedio,
        id: pacienteId,
      });
      purgadas += 1;
    }
  }
  return { inserted: false, purgadas };
}

export { _syncPatientActiveStateInClinic };

/**
 * Wrapper invocable vía `npx convex run` para purgar manualmente los
 * snapshots huérfanos detectados en dev/prod. Reutiliza el mismo helper que
 * la cascada de `clinicMemberships.remove`.
 */
export const deletePatientSnapshotsForClinic = internalMutation({
  args: {
    pacienteId: v.id("users"),
    clinicId: v.id("clinics"),
  },
  handler: (ctx, { pacienteId, clinicId }) =>
    _deletePatientSnapshotsForClinic(ctx, pacienteId, clinicId),
});


