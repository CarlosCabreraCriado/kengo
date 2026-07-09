/**
 * Migración: backfill del discriminador `tipo` para ejercicios.
 *
 * Contexto: se introdujo `tipo: "repeticiones" | "duracion"` en el catálogo
 * (`exercises`) y denormalizado en las prescripciones (`planExercises`,
 * `routineExercises`). El campo es opcional en schema durante la migración;
 * los consumidores tratan `undefined` como `"repeticiones"`. Esta migración
 * deja los datos limpios con un `tipo` explícito.
 *
 * Reglas (idempotente — solo toca filas con `tipo === undefined`):
 *   - `exercises`: si `tipo` está sin definir → `"repeticiones"`. El sync
 *     Directus→Convex lo sobrescribirá con el valor real cuando el ejercicio
 *     cambie en Directus.
 *   - `planExercises` / `routineExercises`: deriva el tipo del valor prescrito:
 *     si `duracionSeg > 0` → `"duracion"`, en caso contrario `"repeticiones"`.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillTipoEjercicio:run
 *   npx convex run migrations/backfillTipoEjercicio:run --prod
 */

import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let exercises = 0;
    let planExercises = 0;
    let routineExercises = 0;

    for (const e of await ctx.db.query("exercises").collect()) {
      if (e.tipo === undefined) {
        await ctx.db.patch(e._id, { tipo: "repeticiones" });
        exercises++;
      }
    }

    for (const pe of await ctx.db.query("planExercises").collect()) {
      if (pe.tipo === undefined) {
        const tipo =
          pe.duracionSeg !== undefined && pe.duracionSeg > 0
            ? "duracion"
            : "repeticiones";
        await ctx.db.patch(pe._id, { tipo });
        planExercises++;
      }
    }

    for (const re of await ctx.db.query("routineExercises").collect()) {
      if (re.tipo === undefined) {
        const tipo =
          re.duracionSeg !== undefined && re.duracionSeg > 0
            ? "duracion"
            : "repeticiones";
        await ctx.db.patch(re._id, { tipo });
        routineExercises++;
      }
    }

    console.log(
      `[backfillTipoEjercicio] exercises=${exercises} planExercises=${planExercises} routineExercises=${routineExercises}`,
    );

    return { exercises, planExercises, routineExercises };
  },
});
