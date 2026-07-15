import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getClinicIdForPatient } from "../_helpers/expectedExercises";
import { getReferenciaInactividad } from "../_helpers/inactividad";
import { getCurrentMadridDate, diffDaysYMD } from "../_helpers/datetime";

// Umbrales (AS3). Modificables sin redeploy mediante un patch del schema
// si producto valida otros valores.
const AS3_INACTIVIDAD_DIAS_WARN = 5;
const AS3_INACTIVIDAD_DIAS_ALTA = 10;

async function getPacienteNombre(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
): Promise<string> {
  const u = await ctx.db.get(pacienteId);
  if (!u) return "Paciente";
  return `${u.firstName} ${u.lastName}`.trim() || "Paciente";
}

/**
 * Inserta una alerta tipo "comentario" cuando el paciente registra una nota
 * (por ejercicio o como observación general de fin de sesión).
 *
 * Idempotencia en dos modos:
 *  - Si llega con `exerciseExecutionId` → busca por esa ejecución concreta.
 *  - Si llega solo con `sessionId` (comentario general de sesión) → busca por
 *    `(pacienteId, sessionId, tipo=comentario, exerciseExecutionId=undefined)`.
 *    Si ya existe, actualiza `texto`, refresca `fechaGeneracion` y vuelve a
 *    marcar `pendiente` para que el fisio vea la versión más reciente.
 */
export const createCommentAlert = internalMutation({
  args: {
    pacienteId: v.id("users"),
    sessionId: v.optional(v.id("sessions")),
    exerciseExecutionId: v.optional(v.id("exerciseExecutions")),
    texto: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"physioAlerts"> | null> => {
    if (!args.texto.trim()) return null;

    const clinicId = await getClinicIdForPatient(ctx, args.pacienteId);
    if (!clinicId) return null;

    if (args.exerciseExecutionId) {
      const existing = await ctx.db
        .query("physioAlerts")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", args.pacienteId),
        )
        .filter((q) =>
          q.eq(q.field("exerciseExecutionId"), args.exerciseExecutionId),
        )
        .first();
      if (existing) return existing._id;
    } else if (args.sessionId) {
      const existing = await ctx.db
        .query("physioAlerts")
        .withIndex("by_pacienteId_estado", (q) =>
          q.eq("pacienteId", args.pacienteId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("sessionId"), args.sessionId),
            q.eq(q.field("tipo"), "comentario"),
            q.eq(q.field("exerciseExecutionId"), undefined),
          ),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          texto: args.texto,
          estado: "pendiente",
          fechaGeneracion: new Date().toISOString(),
        });
        return existing._id;
      }
    }

    const pacienteNombre = await getPacienteNombre(ctx, args.pacienteId);
    return await ctx.db.insert("physioAlerts", {
      tipo: "comentario",
      severidad: "info",
      estado: "pendiente",
      pacienteId: args.pacienteId,
      clinicId,
      generadoPor: "evento_sesion",
      sessionId: args.sessionId,
      exerciseExecutionId: args.exerciseExecutionId,
      texto: args.texto,
      pacienteNombre,
      fechaGeneracion: new Date().toISOString(),
    });
  },
});

/**
 * Inserta una alerta tipo "dolor_alto" al cerrar una sesión cuyo
 * `dolorMax >= AS2` (default 8). Idempotente por sessionId.
 */
export const createDolorAltoAlert = internalMutation({
  args: {
    pacienteId: v.id("users"),
    sessionId: v.id("sessions"),
    dolorEscala: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"physioAlerts"> | null> => {
    const clinicId = await getClinicIdForPatient(ctx, args.pacienteId);
    if (!clinicId) return null;

    // Idempotencia por sessionId + tipo.
    const existing = await ctx.db
      .query("physioAlerts")
      .withIndex("by_pacienteId_estado", (q) =>
        q.eq("pacienteId", args.pacienteId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("sessionId"), args.sessionId),
          q.eq(q.field("tipo"), "dolor_alto"),
        ),
      )
      .first();
    if (existing) return existing._id;

    const pacienteNombre = await getPacienteNombre(ctx, args.pacienteId);
    return await ctx.db.insert("physioAlerts", {
      tipo: "dolor_alto",
      severidad: "alta",
      estado: "pendiente",
      pacienteId: args.pacienteId,
      clinicId,
      generadoPor: "evento_sesion",
      sessionId: args.sessionId,
      dolorEscala: args.dolorEscala,
      pacienteNombre,
      fechaGeneracion: new Date().toISOString(),
    });
  },
});

type AlertaTipoDiaria = "inactividad";

/**
 * Comprueba si el paciente ya tiene una alerta `pendiente` del tipo dado.
 * Si la hay, NO se crea otra (evita ruido repetido). Si está `revisada` o
 * `descartada`, esta función devuelve `false` y la regla creará una nueva
 * (recreación diaria si la condición persiste).
 */
async function hayPendiente(
  ctx: MutationCtx,
  pacienteId: Id<"users">,
  tipo: AlertaTipoDiaria,
): Promise<boolean> {
  const existing = await ctx.db
    .query("physioAlerts")
    .withIndex("by_pacienteId_estado", (q) =>
      q.eq("pacienteId", pacienteId).eq("estado", "pendiente"),
    )
    .filter((q) => q.eq(q.field("tipo"), tipo))
    .first();
  return existing !== null;
}

function severidadInactividad(dias: number): "warn" | "alta" {
  return dias >= AS3_INACTIVIDAD_DIAS_ALTA ? "alta" : "warn";
}

/**
 * Reglas diarias de alertas. Invocada por el cron `daily-maintenance` una
 * vez al día. Genera alertas:
 *  - `inactividad` (AS3): paciente con plan activo y `inactividadDias >= 5`.
 *
 * Reglas comunes:
 *  - Solo se generan para pacientes con plan activo.
 *  - Idempotencia: no se crea si ya hay una `pendiente` del mismo tipo.
 *  - Si la anterior fue revisada/descartada y la condición persiste, se
 *    recrea (visibilidad continua para el fisio).
 */
export const runDailyAlertRules = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ generadas: number; porTipo: Record<AlertaTipoDiaria, number> }> => {
    const porTipo: Record<AlertaTipoDiaria, number> = {
      inactividad: 0,
    };

    // Iterar pacientes con plan activo (universo de la regla).
    const planesActivos = await ctx.db
      .query("plans")
      .withIndex("by_estado", (q) => q.eq("estado", "activo"))
      .collect();
    const pacienteIds = Array.from(
      new Set(planesActivos.map((p) => p.pacienteId)),
    );
    if (pacienteIds.length === 0) {
      console.log("[alerts:daily] sin pacientes con plan activo");
      return { generadas: 0, porTipo };
    }

    const fechaGeneracion = new Date().toISOString();
    const hoy = getCurrentMadridDate();

    let generadas = 0;
    for (const pacienteId of pacienteIds) {
      const clinicId = await getClinicIdForPatient(ctx, pacienteId);
      if (!clinicId) continue;

      // Snapshot 7d (para inactividad y adherencia). Filtrado por clinicId
      // porque la tabla está particionada por (pacienteId, clinicId, ventana)
      // tras 519721d — un paciente multi-clínica tiene varios snapshots con
      // el mismo (pacienteId, ventana) y `unique()` falla.
      const snap7d = await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_pacienteId_ventana", (q) =>
          q.eq("pacienteId", pacienteId).eq("ventana", "7d"),
        )
        .filter((q) => q.eq(q.field("clinicId"), clinicId))
        .first();

      // === Regla 1: inactividad ===
      // Guard de defensa en profundidad: aunque el snapshot ya no debería
      // sobreestimar la inactividad de pacientes recientes, exigimos que el
      // paciente lleve OBLIGADO a tener actividad (alta / inicio de plan) al
      // menos el umbral WARN antes de generar la alerta. Protege ante un
      // snapshot obsoleto.
      if (snap7d && snap7d.inactividadDias >= AS3_INACTIVIDAD_DIAS_WARN) {
        const refInicio = await getReferenciaInactividad(
          ctx,
          pacienteId,
          clinicId,
          hoy,
        );
        const suficienteAntiguedad =
          diffDaysYMD(refInicio, hoy) >= AS3_INACTIVIDAD_DIAS_WARN;
        if (
          suficienteAntiguedad &&
          !(await hayPendiente(ctx, pacienteId, "inactividad"))
        ) {
          const pacienteNombre = await getPacienteNombre(ctx, pacienteId);
          await ctx.db.insert("physioAlerts", {
            tipo: "inactividad",
            severidad: severidadInactividad(snap7d.inactividadDias),
            estado: "pendiente",
            pacienteId,
            clinicId,
            generadoPor: "regla_diaria",
            inactividadDias: snap7d.inactividadDias,
            pacienteNombre,
            fechaGeneracion,
          });
          porTipo.inactividad += 1;
          generadas += 1;
        }
      }
    }

    console.log(
      `[alerts:daily] pacientes=${pacienteIds.length} generadas=${generadas} inactividad=${porTipo.inactividad}`,
    );
    return { generadas, porTipo };
  },
});

/**
 * Limpieza puntual (one-off) de las alertas `inactividad` FALSAS ya emitidas
 * antes del fix: pacientes recién dados de alta o con plan recién asignado.
 * Borra las alertas `pendiente` cuyo paciente aún no lleva obligado a tener
 * actividad el umbral WARN (usa la antigüedad de referencia directamente, no
 * el snapshot, que puede no haberse recomputado todavía).
 *
 * Ejecutar una vez tras desplegar el fix:
 *   npx convex run alerts/internal:purgeStaleInactividadAlerts
 */
export const purgeStaleInactividadAlerts = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ revisadas: number; borradas: number }> => {
    const hoy = getCurrentMadridDate();

    // Dataset pequeño: filtramos en memoria las pendientes de tipo inactividad.
    const pendientes = await ctx.db
      .query("physioAlerts")
      .filter((q) =>
        q.and(
          q.eq(q.field("estado"), "pendiente"),
          q.eq(q.field("tipo"), "inactividad"),
        ),
      )
      .collect();

    let borradas = 0;
    for (const alerta of pendientes) {
      const refInicio = await getReferenciaInactividad(
        ctx,
        alerta.pacienteId,
        alerta.clinicId,
        hoy,
      );
      if (diffDaysYMD(refInicio, hoy) < AS3_INACTIVIDAD_DIAS_WARN) {
        await ctx.db.delete(alerta._id);
        borradas += 1;
      }
    }

    console.log(
      `[alerts:purge-inactividad] revisadas=${pendientes.length} borradas=${borradas}`,
    );
    return { revisadas: pendientes.length, borradas };
  },
});
