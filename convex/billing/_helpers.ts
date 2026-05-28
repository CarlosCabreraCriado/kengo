/**
 * Helpers puros para la lógica de billing/suscripciones.
 * No dependen de ctx — solo cálculo sobre el número de fisios.
 *
 * Tabla de tarifas (ver docs/PLAN_STRIPE_SUSCRIPCIONES.md):
 *   1 fisio   → 65 € / mes
 *   2-4       → 170 € / mes
 *   5-10      → 280 € / mes
 *   +10       → contactar ventas
 */

export interface PlanTier {
  nombre: string;
  precioMensualEur: number;
  rangoFisiosMin: number;
  rangoFisiosMax: number;
}

export const PLANES: readonly PlanTier[] = [
  { nombre: "1 Fisio", precioMensualEur: 65, rangoFisiosMin: 1, rangoFisiosMax: 1 },
  { nombre: "2-4 Fisios", precioMensualEur: 170, rangoFisiosMin: 2, rangoFisiosMax: 4 },
  { nombre: "5-10 Fisios", precioMensualEur: 280, rangoFisiosMin: 5, rangoFisiosMax: 10 },
] as const;

export const LIMITE_FISIOS_AUTOSERVICIO = 10;

export function planParaFisios(n: number): PlanTier | null {
  if (n < 1) return null;
  return PLANES.find((p) => n >= p.rangoFisiosMin && n <= p.rangoFisiosMax) ?? null;
}

export function calcularPrecioPorFisios(n: number): number {
  return planParaFisios(n)?.precioMensualEur ?? 0;
}

export function requiereContactoVentas(n: number): boolean {
  return n > LIMITE_FISIOS_AUTOSERVICIO;
}
