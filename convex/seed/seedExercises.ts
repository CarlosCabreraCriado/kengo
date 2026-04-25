import { v } from "convex/values";
import { internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

import categoriesData from "./data/categories.json";
import exercisesData from "./data/exercises.json";
import exerciseCategoriesData from "./data/exercise_categories.json";

// Tipos para los datos importados
interface CategoryRaw {
  id_categoria: number;
  nombre_categoria: string;
}

interface ExerciseRaw {
  id_ejercicio: number;
  nombre_ejercicio: string;
  descripcion: string | null;
  portada: string | null;
  video: string | null;
  series_defecto: string | null;
  repeticiones_defecto: string | null;
}

interface ExerciseCategoryRaw {
  ejercicio_id: number;
  categoria_id: number;
}

// --- Mutation 1: Insertar categorías ---
export const insertCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const categories = categoriesData as CategoryRaw[];
    const mapping: Record<number, string> = {};

    for (const cat of categories) {
      const id = await ctx.db.insert("categories", {
        nombreCategoria: cat.nombre_categoria,
        legacyId: cat.id_categoria,
      });
      mapping[cat.id_categoria] = id;
    }

    return mapping;
  },
});

// --- Mutation 2: Insertar ejercicios en batches ---
export const insertExercisesBatch = internalMutation({
  args: {
    exercises: v.array(
      v.object({
        nombreEjercicio: v.string(),
        descripcion: v.optional(v.string()),
        portada: v.optional(v.string()),
        video: v.optional(v.string()),
        seriesDefecto: v.optional(v.string()),
        repeticionesDefecto: v.optional(v.string()),
        legacyId: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const mapping: Record<number, string> = {};

    for (const ex of args.exercises) {
      const id = await ctx.db.insert("exercises", {
        nombreEjercicio: ex.nombreEjercicio,
        descripcion: ex.descripcion,
        portada: ex.portada,
        video: ex.video,
        seriesDefecto: ex.seriesDefecto,
        repeticionesDefecto: ex.repeticionesDefecto,
        legacyId: ex.legacyId,
      });
      mapping[ex.legacyId] = id;
    }

    return mapping;
  },
});

// --- Mutation 3: Insertar relaciones M2M en batches ---
export const insertExerciseCategoriesBatch = internalMutation({
  args: {
    relations: v.array(
      v.object({
        exerciseConvexId: v.id("exercises"),
        categoryConvexId: v.id("categories"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const rel of args.relations) {
      await ctx.db.insert("exerciseCategories", {
        exerciseId: rel.exerciseConvexId,
        categoryId: rel.categoryConvexId,
      });
      count++;
    }
    return count;
  },
});

// --- Action orquestador: ejecuta las 3 mutations en secuencia ---
export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Insertar categorías
    console.log(`Insertando ${(categoriesData as CategoryRaw[]).length} categorías...`);
    const categoryMapping: Record<number, string> = await ctx.runMutation(
      internal.seed.seedExercises.insertCategories,
      {},
    );
    console.log("Categorías insertadas:", Object.keys(categoryMapping).length);

    // 2. Insertar ejercicios en batches de 100
    const exercises = exercisesData as ExerciseRaw[];
    const exerciseMapping: Record<number, string> = {};
    const BATCH_SIZE = 100;

    for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
      const batch = exercises.slice(i, i + BATCH_SIZE);
      console.log(
        `Insertando ejercicios ${i + 1}-${Math.min(i + BATCH_SIZE, exercises.length)}...`,
      );

      const batchData = batch.map((ex) => ({
        nombreEjercicio: ex.nombre_ejercicio.trim(),
        descripcion: ex.descripcion || undefined,
        portada: ex.portada || undefined,
        video: ex.video || undefined,
        seriesDefecto: ex.series_defecto || undefined,
        repeticionesDefecto: ex.repeticiones_defecto || undefined,
        legacyId: ex.id_ejercicio,
      }));

      const batchMapping = await ctx.runMutation(
        internal.seed.seedExercises.insertExercisesBatch,
        { exercises: batchData },
      );

      Object.assign(exerciseMapping, batchMapping);
    }
    console.log("Ejercicios insertados:", Object.keys(exerciseMapping).length);

    // 3. Insertar relaciones M2M en batches de 200
    const relations = exerciseCategoriesData as ExerciseCategoryRaw[];
    let totalRelations = 0;

    for (let i = 0; i < relations.length; i += 200) {
      const batch = relations.slice(i, i + 200);

      const validRelations = batch
        .filter((rel) => {
          const exId = exerciseMapping[rel.ejercicio_id];
          const catId = categoryMapping[rel.categoria_id];
          if (!exId || !catId) {
            console.warn(
              `Relación sin mapeo: ejercicio ${rel.ejercicio_id} → ${exId}, categoría ${rel.categoria_id} → ${catId}`,
            );
            return false;
          }
          return true;
        })
        .map((rel) => ({
          exerciseConvexId: exerciseMapping[rel.ejercicio_id] as any,
          categoryConvexId: categoryMapping[rel.categoria_id] as any,
        }));

      if (validRelations.length > 0) {
        const count = await ctx.runMutation(
          internal.seed.seedExercises.insertExerciseCategoriesBatch,
          { relations: validRelations },
        );
        totalRelations += count;
      }
    }

    console.log("Relaciones M2M insertadas:", totalRelations);
    console.log("Seed completado.");

    return {
      categories: Object.keys(categoryMapping).length,
      exercises: Object.keys(exerciseMapping).length,
      relations: totalRelations,
    };
  },
});
