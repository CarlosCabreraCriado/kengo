/**
 * Allowlist de técnicos de soporte autorizados a impersonar usuarios.
 *
 * FUENTE ÚNICA: la env var `SUPPORT_USER_IDS` — lista separada por comas de
 * `externalId`s de Better-Auth (el `subject` del JWT / `users.externalId`).
 *
 * Es exactamente la MISMA fuente que consume el plugin admin (`adminUserIds`) en
 * `convex/auth.ts`. Mantenerla compartida evita que "quién puede impersonar"
 * (gate real en Better-Auth) y "quién ve la UI de soporte / puede escribir
 * auditoría" (gate en estas funciones) diverjan.
 *
 * Configurar con:
 *   npx convex env set SUPPORT_USER_IDS "<externalId1>,<externalId2>"
 */

export function getSupportTechnicianIds(): string[] {
  return (process.env["SUPPORT_USER_IDS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSupportTechnician(
  externalId: string | null | undefined,
): boolean {
  if (!externalId) return false;
  return getSupportTechnicianIds().includes(externalId);
}
