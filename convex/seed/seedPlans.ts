import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

import planesData from "../../docs/backup_directus/Planes_202604241520.json";
import planesEjerciciosData from "../../docs/backup_directus/planes_ejercicios_202604241520.json";
import sesionesData from "../../docs/backup_directus/sesiones_202604241520.json";
import registrosData from "../../docs/backup_directus/planes_registros_202604241520.json";
import cumplimientoData from "../../docs/backup_directus/cumplimiento_diario_202604241520.json";

const BATCH_SIZE = 50;

function toIso(dt: string | null): string | undefined {
  if (!dt) return undefined;
  // "2025-11-29 22:53:38" → "2025-11-29T22:53:38.000Z"
  return dt.replace(" ", "T") + (dt.includes("T") ? "" : ".000Z");
}

function toDate(dt: string | null): string | undefined {
  if (!dt) return undefined;
  return dt.split(" ")[0]!.split("T")[0];
}

function parseDiasSemana(raw: any): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ─── MAIN SEED ACTION ───

export const seedPlans = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("=== SEED FASE 4: Planes, Ejercicios, Sesiones, Registros, Cumplimiento ===\n");

    // ── Paso 1: Plans ──
    console.log("--- Paso 1: Planes ---");
    const planes = (planesData as any).Planes.map((p: any) => ({
      legacyId: p.id_plan,
      titulo: p.titulo || "Sin título",
      descripcion: p.descripcion || undefined,
      estado: p.estado,
      fechaInicio: toDate(p.fecha_inicio),
      fechaFin: toDate(p.fecha_fin),
      pacienteDirectusId: p.paciente,
      fisioDirectusId: p.fisio,
      version: p.version ?? 1,
      planAnteriorLegacyId: p.plan_anterior ?? undefined,
    }));

    console.log(`Planes a importar: ${planes.length}`);
    const planIdMap: [number, string][] = [];

    for (let i = 0; i < planes.length; i += BATCH_SIZE) {
      const batch = planes.slice(i, i + BATCH_SIZE);
      const result: any = await ctx.runMutation(
        internal.seed.seedPlans.insertPlansBatch,
        { plans: batch },
      );
      planIdMap.push(...result.idMap);
    }
    console.log(`Planes importados: ${planIdMap.length}\n`);

    // ── Paso 2: Plan Exercises ──
    console.log("--- Paso 2: Ejercicios de Plan ---");
    const planExercises = (planesEjerciciosData as any).planes_ejercicios
      .filter((pe: any) => pe.plan != null && pe.ejercicio != null)
      .map((pe: any) => ({
      legacyId: pe.id,
      planLegacyId: pe.plan,
      exerciseLegacyId: pe.ejercicio,
      sort: pe.sort ?? 0,
      series: pe.series ?? undefined,
      repeticiones: pe.repeticiones ?? undefined,
      duracionSeg: pe.duracion_seg ?? undefined,
      descansoSeg: pe.descanso_seg ?? undefined,
      vecesDia: pe.veces_dia ?? undefined,
      diasSemana: parseDiasSemana(pe.dias_semana),
      instruccionesPaciente: pe.instrucciones_paciente ?? undefined,
      notasFisio: pe.notas_fisio ?? undefined,
    }));

    console.log(`Ejercicios de plan a importar: ${planExercises.length}`);
    const planExerciseIdMap: [number, string][] = [];

    for (let i = 0; i < planExercises.length; i += BATCH_SIZE) {
      const batch = planExercises.slice(i, i + BATCH_SIZE);
      const result: any = await ctx.runMutation(
        internal.seed.seedPlans.insertPlanExercisesBatch,
        { items: batch, planIdMap },
      );
      planExerciseIdMap.push(...result.idMap);
    }
    console.log(`Ejercicios de plan importados: ${planExerciseIdMap.length}\n`);

    // ── Paso 3: Sessions ──
    console.log("--- Paso 3: Sesiones ---");
    const sessions = (sesionesData as any).sesiones.map((s: any) => ({
      legacyId: s.id,
      pacienteDirectusId: s.paciente,
      fechaInicio: toIso(s.fecha_inicio) ?? new Date().toISOString(),
      fechaFin: toIso(s.fecha_fin),
      observacionesGenerales: s.observaciones_generales ?? undefined,
      completada: s.completada === 1 || s.completada === true,
    }));

    console.log(`Sesiones a importar: ${sessions.length}`);
    const sessionIdMap: [number, string][] = [];

    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      const result: any = await ctx.runMutation(
        internal.seed.seedPlans.insertSessionsBatch,
        { sessions: batch },
      );
      sessionIdMap.push(...result.idMap);
    }
    console.log(`Sesiones importadas: ${sessionIdMap.length}\n`);

    // ── Paso 4: Plan Records ──
    console.log("--- Paso 4: Registros de Plan ---");
    const records = (registrosData as any).planes_registros
      .filter((r: any) => r.plan_item != null && r.paciente != null)
      .map((r: any) => ({
      legacyId: r.id_registro,
      planItemLegacyId: r.plan_item,
      pacienteDirectusId: r.paciente,
      sessionLegacyId: r.sesion ?? undefined,
      fechaHora: toIso(r.fecha_hora) ?? new Date().toISOString(),
      completado: r.completado === 1 || r.completado === true,
      repeticionesRealizadas: r.repeticiones_realizadas ?? undefined,
      duracionRealSeg: r.duracion_real_seg ?? undefined,
      dolorEscala: r.dolor_escala ?? undefined,
      esfuerzoEscala: r.esfuerzo_escala ?? undefined,
      notaPaciente: r.nota_paciente ?? undefined,
    }));

    console.log(`Registros a importar: ${records.length}`);
    let recordsInserted = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const result: any = await ctx.runMutation(
        internal.seed.seedPlans.insertRecordsBatch,
        { records: batch, planExerciseIdMap, sessionIdMap },
      );
      recordsInserted += result.inserted;
    }
    console.log(`Registros importados: ${recordsInserted}\n`);

    // ── Paso 5: Daily Compliance ──
    console.log("--- Paso 5: Cumplimiento Diario ---");
    const compliance = (cumplimientoData as any).cumplimiento_diario
      .filter((c: any) => c.paciente != null && c.plan != null)
      .map((c: any) => ({
      fecha: c.fecha,
      pacienteDirectusId: c.paciente,
      planLegacyId: c.plan,
      ejerciciosEsperados: c.ejercicios_esperados ?? 0,
      ejerciciosCompletados: c.ejercicios_completados ?? 0,
      esDiaDescanso: c.es_dia_descanso === 1 || c.es_dia_descanso === true,
      dolorPromedio: c.dolor_promedio ?? undefined,
    }));

    console.log(`Cumplimiento a importar: ${compliance.length}`);
    let complianceInserted = 0;

    for (let i = 0; i < compliance.length; i += BATCH_SIZE) {
      const batch = compliance.slice(i, i + BATCH_SIZE);
      const result: any = await ctx.runMutation(
        internal.seed.seedPlans.insertComplianceBatch,
        { items: batch, planIdMap },
      );
      complianceInserted += result.inserted;
    }
    console.log(`Cumplimiento importado: ${complianceInserted}\n`);

    console.log("=== SEED FASE 4 COMPLETADO ===");
    console.log(`Planes: ${planIdMap.length}, Ejercicios: ${planExerciseIdMap.length}, Sesiones: ${sessionIdMap.length}, Registros: ${recordsInserted}, Cumplimiento: ${complianceInserted}`);
  },
});

// ─── BATCH MUTATIONS ───

export const insertPlansBatch = internalMutation({
  args: {
    plans: v.array(v.object({
      legacyId: v.number(),
      titulo: v.string(),
      descripcion: v.optional(v.string()),
      estado: v.string(),
      fechaInicio: v.optional(v.string()),
      fechaFin: v.optional(v.string()),
      pacienteDirectusId: v.string(),
      fisioDirectusId: v.string(),
      version: v.number(),
      planAnteriorLegacyId: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const idMap: [number, string][] = [];

    for (const p of args.plans) {
      // Check if already seeded
      const existing = await ctx.db.query("plans")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", p.legacyId))
        .unique();
      if (existing) {
        idMap.push([p.legacyId, existing._id]);
        continue;
      }

      // Resolve user IDs
      const paciente = await ctx.db.query("users")
        .withIndex("by_legacyDirectusId", (q) => q.eq("legacyDirectusId", p.pacienteDirectusId))
        .unique();
      const fisio = await ctx.db.query("users")
        .withIndex("by_legacyDirectusId", (q) => q.eq("legacyDirectusId", p.fisioDirectusId))
        .unique();

      if (!paciente || !fisio) {
        console.warn(`[Seed] Plan ${p.legacyId}: paciente o fisio no encontrado`);
        continue;
      }

      const id = await ctx.db.insert("plans", {
        legacyId: p.legacyId,
        titulo: p.titulo,
        descripcion: p.descripcion,
        estado: p.estado as any,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin,
        pacienteId: paciente._id,
        fisioId: fisio._id,
        version: p.version,
        pacienteNombre: `${paciente.firstName} ${paciente.lastName}`,
        fisioNombre: `${fisio.firstName} ${fisio.lastName}`,
      });

      idMap.push([p.legacyId, id]);
    }

    return { idMap };
  },
});

export const insertPlanExercisesBatch = internalMutation({
  args: {
    items: v.array(v.object({
      legacyId: v.number(),
      planLegacyId: v.number(),
      exerciseLegacyId: v.number(),
      sort: v.number(),
      series: v.optional(v.number()),
      repeticiones: v.optional(v.number()),
      duracionSeg: v.optional(v.number()),
      descansoSeg: v.optional(v.number()),
      vecesDia: v.optional(v.number()),
      diasSemana: v.optional(v.array(v.string())),
      instruccionesPaciente: v.optional(v.string()),
      notasFisio: v.optional(v.string()),
    })),
    planIdMap: v.array(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const planMap = new Map<number, string>(args.planIdMap.map(([k, v]: any) => [k, v]));
    const idMap: [number, string][] = [];

    for (const item of args.items) {
      const planId = planMap.get(item.planLegacyId);
      if (!planId) {
        console.warn(`[Seed] PlanExercise ${item.legacyId}: plan ${item.planLegacyId} no encontrado`);
        continue;
      }

      const exercise = await ctx.db.query("exercises")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", item.exerciseLegacyId))
        .unique();

      if (!exercise) {
        console.warn(`[Seed] PlanExercise ${item.legacyId}: ejercicio ${item.exerciseLegacyId} no encontrado`);
        continue;
      }

      const id = await ctx.db.insert("planExercises", {
        legacyId: item.legacyId,
        planId: planId as any,
        exerciseId: exercise._id,
        sort: item.sort,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracionSeg,
        descansoSeg: item.descansoSeg,
        vecesDia: item.vecesDia,
        diasSemana: item.diasSemana as any,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
        ejercicioNombre: exercise.nombreEjercicio,
      });

      idMap.push([item.legacyId, id]);
    }

    return { idMap };
  },
});

export const insertSessionsBatch = internalMutation({
  args: {
    sessions: v.array(v.object({
      legacyId: v.number(),
      pacienteDirectusId: v.string(),
      fechaInicio: v.string(),
      fechaFin: v.optional(v.string()),
      observacionesGenerales: v.optional(v.string()),
      completada: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const idMap: [number, string][] = [];

    for (const s of args.sessions) {
      // Check if already seeded
      const existing = await ctx.db.query("sessions")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", s.legacyId))
        .unique();
      if (existing) {
        idMap.push([s.legacyId, existing._id]);
        continue;
      }

      const paciente = await ctx.db.query("users")
        .withIndex("by_legacyDirectusId", (q) => q.eq("legacyDirectusId", s.pacienteDirectusId))
        .unique();

      if (!paciente) {
        console.warn(`[Seed] Session ${s.legacyId}: paciente no encontrado`);
        continue;
      }

      const id = await ctx.db.insert("sessions", {
        legacyId: s.legacyId,
        pacienteId: paciente._id,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        observacionesGenerales: s.observacionesGenerales,
        completada: s.completada,
      });

      idMap.push([s.legacyId, id]);
    }

    return { idMap };
  },
});

export const insertRecordsBatch = internalMutation({
  args: {
    records: v.array(v.object({
      legacyId: v.number(),
      planItemLegacyId: v.number(),
      pacienteDirectusId: v.string(),
      sessionLegacyId: v.optional(v.number()),
      fechaHora: v.string(),
      completado: v.boolean(),
      repeticionesRealizadas: v.optional(v.number()),
      duracionRealSeg: v.optional(v.number()),
      dolorEscala: v.optional(v.number()),
      esfuerzoEscala: v.optional(v.number()),
      notaPaciente: v.optional(v.string()),
    })),
    planExerciseIdMap: v.array(v.array(v.any())),
    sessionIdMap: v.array(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const peMap = new Map<number, string>(args.planExerciseIdMap.map(([k, v]: any) => [k, v]));
    const sMap = new Map<number, string>(args.sessionIdMap.map(([k, v]: any) => [k, v]));
    let inserted = 0;

    for (const r of args.records) {
      const planExerciseId = peMap.get(r.planItemLegacyId);
      if (!planExerciseId) {
        console.warn(`[Seed] Record ${r.legacyId}: planExercise ${r.planItemLegacyId} no encontrado`);
        continue;
      }

      const paciente = await ctx.db.query("users")
        .withIndex("by_legacyDirectusId", (q) => q.eq("legacyDirectusId", r.pacienteDirectusId))
        .unique();
      if (!paciente) continue;

      const sessionId = r.sessionLegacyId ? sMap.get(r.sessionLegacyId) : undefined;

      await ctx.db.insert("planRecords", {
        planExerciseId: planExerciseId as any,
        pacienteId: paciente._id,
        sessionId: sessionId as any,
        fechaHora: r.fechaHora,
        fecha: r.fechaHora.split("T")[0]!,
        completado: r.completado,
        repeticionesRealizadas: r.repeticionesRealizadas,
        duracionRealSeg: r.duracionRealSeg,
        dolorEscala: r.dolorEscala,
        esfuerzoEscala: r.esfuerzoEscala,
        notaPaciente: r.notaPaciente,
      });
      inserted++;
    }

    return { inserted };
  },
});

export const insertComplianceBatch = internalMutation({
  args: {
    items: v.array(v.object({
      fecha: v.string(),
      pacienteDirectusId: v.string(),
      planLegacyId: v.number(),
      ejerciciosEsperados: v.number(),
      ejerciciosCompletados: v.number(),
      esDiaDescanso: v.boolean(),
      dolorPromedio: v.optional(v.number()),
    })),
    planIdMap: v.array(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const planMap = new Map<number, string>(args.planIdMap.map(([k, v]: any) => [k, v]));
    let inserted = 0;

    for (const c of args.items) {
      const planId = planMap.get(c.planLegacyId);
      if (!planId) continue;

      const paciente = await ctx.db.query("users")
        .withIndex("by_legacyDirectusId", (q) => q.eq("legacyDirectusId", c.pacienteDirectusId))
        .unique();
      if (!paciente) continue;

      // Check if already exists (upsert)
      const existing = await ctx.db.query("dailyCompliance")
        .withIndex("by_pacienteId_planId_fecha", (q) =>
          q.eq("pacienteId", paciente._id).eq("planId", planId as any).eq("fecha", c.fecha),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ejerciciosEsperados: c.ejerciciosEsperados,
          ejerciciosCompletados: c.ejerciciosCompletados,
          esDiaDescanso: c.esDiaDescanso,
          dolorPromedio: c.dolorPromedio,
        });
      } else {
        await ctx.db.insert("dailyCompliance", {
          fecha: c.fecha,
          pacienteId: paciente._id,
          planId: planId as any,
          ejerciciosEsperados: c.ejerciciosEsperados,
          ejerciciosCompletados: c.ejerciciosCompletados,
          esDiaDescanso: c.esDiaDescanso,
          dolorPromedio: c.dolorPromedio,
        });
      }
      inserted++;
    }

    return { inserted };
  },
});
