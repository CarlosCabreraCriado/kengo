import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getClinicIdForPatient } from "../_helpers/expectedExercises";
import { getMadridDateOffset, anioMes } from "../_helpers/datetime";

// Umbrales (AS3–AS5). Modificables sin redeploy mediante un patch del schema
// si producto valida otros valores.
const AS3_INACTIVIDAD_DIAS_WARN = 5;
const AS3_INACTIVIDAD_DIAS_ALTA = 10;
const AS4_ADHERENCIA_PCT_WARN = 50;
const AS4_ADHERENCIA_PCT_ALTA = 30;
const AS5_TENDENCIA_PP_WARN = -20;
const AS5_TENDENCIA_PP_ALTA = -40;

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

type AlertaTipoDiaria =
  | "inactividad"
  | "adherencia_baja"
  | "tendencia_negativa";

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

function severidadAdherencia(pct: number): "warn" | "alta" {
  return pct < AS4_ADHERENCIA_PCT_ALTA ? "alta" : "warn";
}

function severidadTendencia(deltaPp: number): "warn" | "alta" {
  return deltaPp <= AS5_TENDENCIA_PP_ALTA ? "alta" : "warn";
}

/**
 * Reglas diarias de alertas. Invocada por el cron `daily-maintenance` una
 * vez al día. Genera alertas:
 *  - `inactividad` (AS3): paciente con plan activo y `inactividadDias >= 5`.
 *  - `adherencia_baja` (AS4): paciente con plan activo y adherencia 7d < 50%.
 *  - `tendencia_negativa` (AS5): paciente con tendenciaAdherencia mensual <= -20pp.
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
      adherencia_baja: 0,
      tendencia_negativa: 0,
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

    const mesActual = anioMes(getMadridDateOffset(0));
    const fechaGeneracion = new Date().toISOString();

    let generadas = 0;
    for (const pacienteId of pacienteIds) {
      const clinicId = await getClinicIdForPatient(ctx, pacienteId);
      if (!clinicId) continue;

      // Snapshot 7d (para inactividad y adherencia).
      const snap7d = await ctx.db
        .query("patientMetricsSnapshot")
        .withIndex("by_pacienteId_ventana", (q) =>
          q.eq("pacienteId", pacienteId).eq("ventana", "7d"),
        )
        .unique();

      // === Regla 1: inactividad ===
      if (snap7d && snap7d.inactividadDias >= AS3_INACTIVIDAD_DIAS_WARN) {
        if (!(await hayPendiente(ctx, pacienteId, "inactividad"))) {
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

      // === Regla 2: adherencia_baja ===
      if (
        snap7d &&
        snap7d.adherencia !== undefined &&
        snap7d.adherencia < AS4_ADHERENCIA_PCT_WARN
      ) {
        if (!(await hayPendiente(ctx, pacienteId, "adherencia_baja"))) {
          const pacienteNombre = await getPacienteNombre(ctx, pacienteId);
          await ctx.db.insert("physioAlerts", {
            tipo: "adherencia_baja",
            severidad: severidadAdherencia(snap7d.adherencia),
            estado: "pendiente",
            pacienteId,
            clinicId,
            generadoPor: "regla_diaria",
            adherenciaPct: snap7d.adherencia,
            pacienteNombre,
            fechaGeneracion,
          });
          porTipo.adherencia_baja += 1;
          generadas += 1;
        }
      }

      // === Regla 3: tendencia_negativa ===
      // El monthly rollup está particionado por (paciente, clínica, mes).
      // La alerta es por clínica, así que leemos el rollup de la misma clínica.
      const monthly: Doc<"monthlyPatientRollup"> | null = await ctx.db
        .query("monthlyPatientRollup")
        .withIndex("by_pacienteId_clinicId_anioMes", (q) =>
          q
            .eq("pacienteId", pacienteId)
            .eq("clinicId", clinicId)
            .eq("anioMes", mesActual),
        )
        .unique();
      const tendencia = monthly?.tendenciaAdherencia;
      if (
        tendencia !== undefined &&
        tendencia !== null &&
        tendencia <= AS5_TENDENCIA_PP_WARN
      ) {
        if (!(await hayPendiente(ctx, pacienteId, "tendencia_negativa"))) {
          const pacienteNombre = await getPacienteNombre(ctx, pacienteId);
          await ctx.db.insert("physioAlerts", {
            tipo: "tendencia_negativa",
            severidad: severidadTendencia(tendencia),
            estado: "pendiente",
            pacienteId,
            clinicId,
            generadoPor: "regla_diaria",
            adherenciaPct: monthly?.adherencia,
            pacienteNombre,
            fechaGeneracion,
          });
          porTipo.tendencia_negativa += 1;
          generadas += 1;
        }
      }
    }

    console.log(
      `[alerts:daily] pacientes=${pacienteIds.length} generadas=${generadas} inactividad=${porTipo.inactividad} adherencia=${porTipo.adherencia_baja} tendencia=${porTipo.tendencia_negativa}`,
    );
    return { generadas, porTipo };
  },
});
