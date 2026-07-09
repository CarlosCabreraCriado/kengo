/**
 * Helpers de dominio para el discriminador de métrica de un ejercicio prescrito.
 *
 * Invariante: un ejercicio prescrito lleva SOLO una métrica por serie según su
 * `tipo`. `series` y `descansoSeg` son ortogonales y no se tocan.
 *   - `tipo === "duracion"`   ⇒ `duracionSeg` definido, `repeticiones` undefined.
 *   - `tipo === "repeticiones"` (o `undefined`) ⇒ `repeticiones` definido,
 *      `duracionSeg` undefined.
 */

export type TipoEjercicio = "repeticiones" | "duracion";

export function normalizarMetricaEjercicio<
  T extends {
    tipo?: TipoEjercicio;
    repeticiones?: number;
    duracionSeg?: number;
  },
>(ej: T): T {
  if (ej.tipo === "duracion") {
    return { ...ej, repeticiones: undefined };
  }
  // "repeticiones" o undefined (legacy) → se trata como repeticiones.
  return { ...ej, duracionSeg: undefined };
}
