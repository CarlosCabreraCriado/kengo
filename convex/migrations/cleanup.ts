/**
 * Limpieza pre-drop del schema legacy (Fase 5b).
 *
 * Cómo se ejecuta (en orden, desde un terminal autenticado vs Convex):
 *   npx convex run migrations/cleanup:cleanupOrphanLegacySessions '{"dryRun": true}'
 *   npx convex run migrations/cleanup:cleanupOrphanLegacySessions
 *   npx convex run migrations/cleanup:cleanupLegacySessionFields '{"dryRun": true}'
 *   npx convex run migrations/cleanup:cleanupLegacySessionFields
 *
 * Después se puede deployar el schema reducido sin tablas legacy.
 *
 * Idempotente: ejecutar varias veces produce el mismo resultado.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

/**
 * Borra las sesiones legacy huérfanas (sin `fecha` definida, indicador de
 * que NO fueron migradas in-place durante el backfill). Tras el drop de
 * `planRecords`, ninguna ejecución del modelo nuevo apunta a estas sesiones
 * (las del modelo nuevo siempre tienen `fecha`), así que es seguro borrarlas.
 */
export const cleanupOrphanLegacySessions = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ candidatas: number; eliminadas: number }> => {
    const dryRun = args.dryRun ?? false;
    const all = await ctx.db.query("sessions").collect();

    let candidatas = 0;
    let eliminadas = 0;

    for (const s of all) {
      if (s.fecha !== undefined) continue;
      candidatas += 1;

      if (!dryRun) {
        await ctx.db.delete(s._id);
      }
      eliminadas += 1;
    }

    console.log(
      `[cleanup:orphan-sessions] candidatas=${candidatas} eliminadas=${eliminadas} dryRun=${dryRun}`,
    );
    return { candidatas, eliminadas };
  },
});

/**
 * Limpia los campos legacy de las sessions migradas. Tras esta limpieza,
 * los docs solo contienen los campos del modelo nuevo, lo que permite
 * eliminar los campos legacy del schema sin que la validación de Convex
 * falle.
 *
 * Campos eliminados (`db.patch` con `undefined`):
 *  - `completada`: redundante con `estado`.
 *  - `observacionesGenerales`: reemplazado por `observacionesPaciente`.
 *  - `legacyId`: residuo de la migración Directus.
 *
 * NOTA: El schema debe declarar estos campos como `v.optional` para que
 * `db.patch` con `undefined` funcione. El schema actual ya los tiene
 * opcionales (excepto `completada`, que pasaremos a opcional ANTES de
 * ejecutar esta mutation).
 */
export const cleanupLegacySessionFields = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ procesadas: number; limpiadas: number; hayMas: boolean; cursor: string | null }> => {
    const dryRun = args.dryRun ?? false;
    const batchSize = args.batchSize ?? 200;

    const result = await ctx.db.query("sessions").paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    let limpiadas = 0;
    for (const s of result.page) {
      // Si la sesión solo tiene campos legacy (sin `fecha`), la dejamos en
      // paz: el barrido de huérfanas la elimina.
      if (s.fecha === undefined) continue;

      const tieneCamposLegacy =
        (s as Partial<Doc<"sessions">> & { completada?: boolean })
          .completada !== undefined ||
        s.observacionesGenerales !== undefined ||
        s.legacyId !== undefined;
      if (!tieneCamposLegacy) continue;

      if (!dryRun) {
        await ctx.db.patch(s._id, {
          completada: undefined,
          observacionesGenerales: undefined,
          legacyId: undefined,
        });
      }
      limpiadas += 1;
    }

    const hayMas = !result.isDone;
    if (hayMas && !dryRun) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.cleanup.cleanupLegacySessionFields,
        { cursor: result.continueCursor, batchSize, dryRun: false },
      );
    }

    console.log(
      `[cleanup:session-fields] batch=${result.page.length} limpiadas=${limpiadas} hayMas=${hayMas} dryRun=${dryRun}`,
    );

    return {
      procesadas: result.page.length,
      limpiadas,
      hayMas,
      cursor: result.continueCursor,
    };
  },
});

