import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const PUESTO_FISIOTERAPEUTA = 1;
export const PUESTO_PACIENTE = 2;
export const PUESTO_ADMINISTRADOR = 4;

export const PUESTOS_GESTION = [
  PUESTO_FISIOTERAPEUTA,
  PUESTO_ADMINISTRADOR,
] as const;

export type PuestoLiteral = "fisio" | "paciente" | "admin";
export type PuestoValue = number | PuestoLiteral;

/**
 * Normaliza un puesto (número legacy o literal) a su representación literal.
 * Usado para comparación uniforme; no mutamos el dato persistido aquí.
 */
export function normalizarPuesto(puesto: PuestoValue): PuestoLiteral | null {
  if (typeof puesto === "string") return puesto;
  if (puesto === PUESTO_FISIOTERAPEUTA) return "fisio";
  if (puesto === PUESTO_PACIENTE) return "paciente";
  if (puesto === PUESTO_ADMINISTRADOR) return "admin";
  return null;
}

export function literalToNumber(literal: PuestoLiteral): number {
  switch (literal) {
    case "fisio":
      return PUESTO_FISIOTERAPEUTA;
    case "paciente":
      return PUESTO_PACIENTE;
    case "admin":
      return PUESTO_ADMINISTRADOR;
  }
}

/**
 * Convierte el puesto a número, sea literal o ya número. Útil para mantener
 * compat con clientes que esperan id_puesto numérico.
 */
export function puestoToNumber(puesto: PuestoValue): number {
  return typeof puesto === "number" ? puesto : literalToNumber(puesto);
}

const PUESTO_NOMBRES_COMPAT: Record<string, string> = {
  fisio: "fisioterapeuta",
  paciente: "paciente",
  admin: "administrador",
  [String(PUESTO_FISIOTERAPEUTA)]: "fisioterapeuta",
  [String(PUESTO_PACIENTE)]: "paciente",
  [String(PUESTO_ADMINISTRADOR)]: "administrador",
};

export function puestoToNombre(puesto: PuestoValue): string | null {
  return PUESTO_NOMBRES_COMPAT[String(puesto)] ?? null;
}

export const esFisio = (puesto: PuestoValue) =>
  normalizarPuesto(puesto) === "fisio";
export const esPaciente = (puesto: PuestoValue) =>
  normalizarPuesto(puesto) === "paciente";
export const esAdmin = (puesto: PuestoValue) =>
  normalizarPuesto(puesto) === "admin";
export const tieneGestion = (puesto: PuestoValue) =>
  esFisio(puesto) || esAdmin(puesto);

/**
 * Obtiene el usuario autenticado o lanza un error.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("No autenticado");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  return user;
}

/**
 * Verifica que el usuario tiene un puesto específico en una clínica.
 */
export async function checkClinicPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  clinicId: Id<"clinics">,
  puestosPermitidos: number[],
) {
  const membership = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId_clinicId", (q) =>
      q.eq("userId", userId).eq("clinicId", clinicId),
    )
    .unique();

  const puestoNum = membership ? puestoToNumber(membership.puesto) : null;
  if (puestoNum === null || !puestosPermitidos.includes(puestoNum)) {
    throw new Error("No tienes permisos para esta acción en esta clínica");
  }

  return membership;
}
