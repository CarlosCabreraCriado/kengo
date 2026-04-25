import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

import routinesData from "./data/routines.json";
import routineExercisesData from "./data/routine_exercises.json";

interface RoutineRaw {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  autor: string;
  visibilidad: string;
  date_created: string;
}

interface RoutineExerciseRaw {
  id: number;
  rutina: number;
  ejercicio: number;
  sort: number;
  series: number | null;
  repeticiones: number | null;
  duracion_seg: number | null;
  descanso_seg: number | null;
  veces_dia: number | null;
  dias_semana: string[] | null;
  instrucciones_paciente: string | null;
  notas_fisio: string | null;
}

// Autores de rutinas (datos mínimos para crear users en Convex)
const AUTHORS = [
  {
    legacyDirectusId: "e415caec-0960-4ca5-b535-9da58d307291",
    email: "guillegp17@gmail.com",
    firstName: "Guillermo",
    lastName: "Gallardo Perez",
  },
];

// --- Mutation 1: Insertar usuarios autores (idempotente) ---
export const insertAuthors = internalMutation({
  args: {},
  handler: async (ctx) => {
    const mapping: Record<string, string> = {};

    for (const author of AUTHORS) {
      // Verificar si ya existe
      const existing = await ctx.db
        .query("users")
        .withIndex("by_legacyDirectusId", (q) =>
          q.eq("legacyDirectusId", author.legacyDirectusId),
        )
        .unique();

      if (existing) {
        mapping[author.legacyDirectusId] = existing._id;
        console.log(`Usuario ya existe: ${author.email} → ${existing._id}`);
        continue;
      }

      const id = await ctx.db.insert("users", {
        externalId: author.legacyDirectusId,
        email: author.email,
        emailVerified: true,
        firstName: author.firstName,
        lastName: author.lastName,
        legacyDirectusId: author.legacyDirectusId,
      });
      mapping[author.legacyDirectusId] = id;
      console.log(`Usuario creado: ${author.email} → ${id}`);
    }

    return mapping;
  },
});

// --- Mutation 2: Insertar rutinas ---
export const insertRoutines = internalMutation({
  args: {
    routines: v.array(
      v.object({
        nombre: v.string(),
        descripcion: v.optional(v.string()),
        autorId: v.id("users"),
        visibilidad: v.union(v.literal("privado"), v.literal("clinica")),
        legacyId: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const mapping: Record<number, string> = {};

    for (const routine of args.routines) {
      const id = await ctx.db.insert("routines", {
        nombre: routine.nombre,
        descripcion: routine.descripcion,
        autorId: routine.autorId,
        visibilidad: routine.visibilidad,
        legacyId: routine.legacyId,
      });
      mapping[routine.legacyId] = id;
    }

    return mapping;
  },
});

// --- Mutation 3: Insertar ejercicios de rutinas ---
export const insertRoutineExercises = internalMutation({
  args: {
    exercises: v.array(
      v.object({
        routineId: v.id("routines"),
        exerciseId: v.id("exercises"),
        sort: v.number(),
        series: v.optional(v.number()),
        repeticiones: v.optional(v.number()),
        duracionSeg: v.optional(v.number()),
        descansoSeg: v.optional(v.number()),
        vecesDia: v.optional(v.number()),
        diasSemana: v.optional(
          v.array(
            v.union(
              v.literal("L"),
              v.literal("M"),
              v.literal("X"),
              v.literal("J"),
              v.literal("V"),
              v.literal("S"),
              v.literal("D"),
            ),
          ),
        ),
        instruccionesPaciente: v.optional(v.string()),
        notasFisio: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const ex of args.exercises) {
      await ctx.db.insert("routineExercises", {
        routineId: ex.routineId,
        exerciseId: ex.exerciseId,
        sort: ex.sort,
        series: ex.series,
        repeticiones: ex.repeticiones,
        duracionSeg: ex.duracionSeg,
        descansoSeg: ex.descansoSeg,
        vecesDia: ex.vecesDia,
        diasSemana: ex.diasSemana,
        instruccionesPaciente: ex.instruccionesPaciente,
        notasFisio: ex.notasFisio,
      });
      count++;
    }
    return count;
  },
});

// --- Action orquestador ---
export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Insertar autores
    console.log("Insertando autores de rutinas...");
    const authorMapping = await ctx.runMutation(
      internal.seed.seedRoutines.insertAuthors,
      {},
    );
    console.log("Autores procesados:", Object.keys(authorMapping).length);

    // 2. Insertar rutinas
    const routines = routinesData as RoutineRaw[];
    const routineData = routines.map((r) => ({
      nombre: r.nombre.trim(),
      descripcion: r.descripcion || undefined,
      autorId: authorMapping[r.autor] as Id<"users">,
      visibilidad: "clinica" as const,
      legacyId: r.id_rutina,
    }));

    console.log(`Insertando ${routineData.length} rutinas...`);
    const routineMapping = await ctx.runMutation(
      internal.seed.seedRoutines.insertRoutines,
      { routines: routineData },
    );
    console.log("Rutinas insertadas:", Object.keys(routineMapping).length);

    // 3. Resolver ejercicios por legacyId y insertar relaciones
    const routineExercises = routineExercisesData as RoutineExerciseRaw[];

    // Obtener mapping de ejercicios legacy → Convex
    const exerciseLegacyIds = [
      ...new Set(routineExercises.map((re) => re.ejercicio)),
    ];

    const exerciseMapping: Record<number, string> = {};
    for (const legacyId of exerciseLegacyIds) {
      const exercise = await ctx.runQuery(
        internal.seed.seedRoutines.getExerciseByLegacyId,
        { legacyId },
      );
      if (exercise) {
        exerciseMapping[legacyId] = exercise._id;
      } else {
        console.warn(`Ejercicio con legacyId ${legacyId} no encontrado`);
      }
    }

    const exerciseData = routineExercises
      .filter((re) => routineMapping[re.rutina] && exerciseMapping[re.ejercicio])
      .map((re) => ({
        routineId: routineMapping[re.rutina] as Id<"routines">,
        exerciseId: exerciseMapping[re.ejercicio] as Id<"exercises">,
        sort: re.sort,
        series: re.series ?? undefined,
        repeticiones: re.repeticiones ?? undefined,
        duracionSeg: re.duracion_seg ?? undefined,
        descansoSeg: re.descanso_seg ?? undefined,
        vecesDia: re.veces_dia ?? undefined,
        diasSemana: (re.dias_semana as
          | ("L" | "M" | "X" | "J" | "V" | "S" | "D")[]
          | null) ?? undefined,
        instruccionesPaciente: re.instrucciones_paciente ?? undefined,
        notasFisio: re.notas_fisio ?? undefined,
      }));

    console.log(
      `Insertando ${exerciseData.length} ejercicios de rutinas...`,
    );
    const count = await ctx.runMutation(
      internal.seed.seedRoutines.insertRoutineExercises,
      { exercises: exerciseData },
    );
    console.log("Ejercicios de rutinas insertados:", count);

    console.log("Seed de rutinas completado.");
  },
});

// --- Query interna para resolver ejercicios por legacyId ---
export const getExerciseByLegacyId = internalQuery({
  args: { legacyId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exercises")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();
  },
});
