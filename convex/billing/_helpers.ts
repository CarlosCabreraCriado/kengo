/**
 * Helpers puros para la lógica de billing/suscripciones.
 * No dependen de ctx — solo cálculo sobre el número de fisios y la variante.
 *
 * Tabla de tarifas (ver docs/PLAN_STRIPE_SUSCRIPCIONES.md):
 *   Lonely (1 fisio)    →  89 € / mes · ilimitado 109 € · hasta 150 pacientes
 *   Smart  (2-4 fisios) → 249 € / mes · ilimitado 279 € · hasta 300 pacientes
 *   Medium (5-9 fisios) → 449 € / mes · ilimitado 489 € · hasta 500 pacientes
 *   +9                  → contactar ventas (enterprise)
 *
 * El límite de pacientes solo aplica a la variante "base"; la variante
 * "ilimitada" no tiene cap.
 */

export type PlanVariante = "base" | "ilimitada";

export interface PlanTier {
  nombre: string;
  precioBaseEur: number;
  precioIlimitadoEur: number;
  /** Pacientes vinculados máximos en variante base. */
  limitePacientes: number;
  rangoFisiosMin: number;
  rangoFisiosMax: number;
}

export const PLANES: readonly PlanTier[] = [
  {
    nombre: "Lonely",
    precioBaseEur: 89,
    precioIlimitadoEur: 109,
    limitePacientes: 150,
    rangoFisiosMin: 1,
    rangoFisiosMax: 1,
  },
  {
    nombre: "Smart",
    precioBaseEur: 249,
    precioIlimitadoEur: 279,
    limitePacientes: 300,
    rangoFisiosMin: 2,
    rangoFisiosMax: 4,
  },
  {
    nombre: "Medium",
    precioBaseEur: 449,
    precioIlimitadoEur: 489,
    limitePacientes: 500,
    rangoFisiosMin: 5,
    rangoFisiosMax: 9,
  },
] as const;

export const LIMITE_FISIOS_AUTOSERVICIO = 9;

export function planParaFisios(n: number): PlanTier | null {
  if (n < 1) return null;
  return PLANES.find((p) => n >= p.rangoFisiosMin && n <= p.rangoFisiosMax) ?? null;
}

export function precioParaFisios(n: number, variante: PlanVariante): number {
  const plan = planParaFisios(n);
  if (!plan) return 0;
  return variante === "ilimitada" ? plan.precioIlimitadoEur : plan.precioBaseEur;
}

/**
 * Límite de pacientes vinculados para una clínica.
 * `null` = sin cap (variante ilimitada o fuera de tramos → enterprise).
 */
export function limitePacientesParaFisios(
  n: number,
  variante: PlanVariante,
): number | null {
  if (variante === "ilimitada") return null;
  return planParaFisios(n)?.limitePacientes ?? null;
}

export function requiereContactoVentas(n: number): boolean {
  return n > LIMITE_FISIOS_AUTOSERVICIO;
}
