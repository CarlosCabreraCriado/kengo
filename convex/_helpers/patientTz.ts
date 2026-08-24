/**
 * Resolución de la zona horaria de un usuario desde BD.
 *
 * `datetime.ts` es puro (sin `ctx`); aquí viven los helpers que necesitan
 * leer `users.timezone`. Fallback `DEFAULT_TZ` (Europe/Madrid) para usuarios
 * que aún no han sincronizado su TZ (apps antiguas) — comportamiento idéntico
 * al histórico, sin regresión.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import {
  DEFAULT_TZ,
  getCurrentDateInTz,
  getDateOffsetInTz,
  isValidIanaTimezone,
} from "./datetime";

type Ctx = QueryCtx | MutationCtx;

/** TZ efectiva de un doc de usuario ya cargado (evita releer de BD). */
export function tzOf(user: Doc<"users"> | null | undefined): string {
  const tz = user?.timezone;
  return tz && isValidIanaTimezone(tz) ? tz : DEFAULT_TZ;
}

/** TZ efectiva de un usuario por id. */
export async function getPatientTz(
  ctx: Ctx,
  pacienteId: Id<"users">,
): Promise<string> {
  return tzOf(await ctx.db.get(pacienteId));
}

/** "Hoy" (YYYY-MM-DD) en la TZ del usuario. */
export async function getPatientToday(
  ctx: Ctx,
  pacienteId: Id<"users">,
): Promise<string> {
  return getCurrentDateInTz(await getPatientTz(ctx, pacienteId));
}

/** Fecha YYYY-MM-DD desplazada `offsetDays` desde hoy en la TZ del usuario. */
export async function getPatientDateOffset(
  ctx: Ctx,
  pacienteId: Id<"users">,
  offsetDays: number,
): Promise<string> {
  return getDateOffsetInTz(await getPatientTz(ctx, pacienteId), offsetDays);
}

/**
 * Cache de TZ por paciente para handlers que iteran muchos usuarios (crons).
 * Uso: `const tzCache = new TzCache(ctx); await tzCache.get(pacienteId)`.
 */
export class TzCache {
  private readonly cache = new Map<Id<"users">, string>();
  constructor(private readonly ctx: Ctx) {}

  async get(pacienteId: Id<"users">): Promise<string> {
    let tz = this.cache.get(pacienteId);
    if (tz === undefined) {
      tz = await getPatientTz(this.ctx, pacienteId);
      this.cache.set(pacienteId, tz);
    }
    return tz;
  }
}
