/**
 * Borra de `physioAlerts` todas las alertas de los tipos retirados
 * `adherencia_baja` y `tendencia_negativa` (simplificación del sistema de
 * notificaciones: se eliminaron las reglas diarias AS4/AS5 de
 * `alerts/internal.ts:runDailyAlertRules`).
 *
 * DEBE ejecutarse ANTES de estrechar el `v.union` de `physioAlerts.tipo` en
 * `convex/schema.ts`: Convex valida los documentos existentes contra el schema
 * al desplegar y rechazaría el push mientras queden filas con esos tipos.
 *
 * Cómo ejecutar (desde la raíz del proyecto):
 *   npx convex run migrations/deleteAdherenciaTendenciaAlerts:run
 */

import { internalMutation } from "../_generated/server";

// Cast a `string` deliberado: tras la Fase B estos literales ya no forman parte
// del union de `physioAlerts.tipo`, así que la comparación directa rompería el
// typecheck. Comparar contra `string[]` mantiene la migración válida en ambas
// fases (es un script de un solo uso, pero se conserva en el historial).
const TIPOS_RETIRADOS: readonly string[] = [
  "adherencia_baja",
  "tendencia_negativa",
];

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ borradas: number; total: number }> => {
    const todas = await ctx.db.query("physioAlerts").collect();
    const aBorrar = todas.filter((a) => TIPOS_RETIRADOS.includes(a.tipo));
    for (const a of aBorrar) {
      await ctx.db.delete(a._id);
    }
    console.log(
      `[deleteAdherenciaTendenciaAlerts] borradas=${aBorrar.length} de physioAlerts=${todas.length}`,
    );
    return { borradas: aBorrar.length, total: todas.length };
  },
});
