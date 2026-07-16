/**
 * Helpers puros para el procesamiento de webhooks de Stripe. No reciben `ctx`
 * ni tocan la base de datos, de modo que pueden testearse de forma aislada
 * (ver `_webhookHelpers.test.ts`).
 */

/**
 * Extrae el id de la suscripción de un objeto `invoice` de Stripe. Compatible
 * con el formato nuevo (API >= 2025-03-31 "basil"/"dahlia", donde el id vive
 * en `invoice.parent.subscription_details.subscription`) y con el formato
 * antiguo (`invoice.subscription` en el nivel superior). En los payloads de
 * webhook el valor es siempre un string (no viene expandido).
 */
export function resolveInvoiceSubscriptionId(
  invoice: unknown,
): string | undefined {
  if (!invoice || typeof invoice !== "object") return undefined;
  const inv = invoice as {
    subscription?: unknown;
    parent?: {
      subscription_details?: { subscription?: unknown } | null;
    } | null;
  };

  const nested = inv.parent?.subscription_details?.subscription;
  if (typeof nested === "string" && nested.length > 0) return nested;

  if (typeof inv.subscription === "string" && inv.subscription.length > 0) {
    return inv.subscription;
  }

  return undefined;
}

/**
 * Decide si un evento de webhook ya registrado debe saltarse. Solo saltamos
 * cuando existe un registro con `processedAt` sellado (es decir, un intento
 * anterior terminó con éxito). Un registro sin sellar significa que el intento
 * previo quedó a medias, por lo que el retry de Stripe debe reprocesarlo en
 * lugar de descartarlo.
 */
export function shouldSkipEvent(
  existing: { processedAt?: number } | null | undefined,
): boolean {
  return existing != null && existing.processedAt !== undefined;
}

/**
 * `true` si el evento pertenece a una subscription que NO es la vigente de la
 * clínica. Protege contra que los eventos de una S1 zombi (cancelada por
 * dunning) pisen el estado de la S2 activa tras una reactivación. Si la clínica
 * aún no tiene subId local, o el evento no trae subId, no se descarta.
 */
export function isForeignSubscriptionEvent(
  localSubId: string | undefined,
  eventSubId: string | undefined,
): boolean {
  return (
    eventSubId !== undefined &&
    localSubId !== undefined &&
    localSubId !== eventSubId
  );
}

/**
 * `true` si el evento es más antiguo que el último ya aplicado a la clínica
 * (Stripe no garantiza orden de entrega). Usamos comparación estricta: dos
 * eventos distintos con el mismo `event.created` (resolución 1 s) se aplican
 * ambos en orden de llegada; la reentrega exacta ya la filtra el dedup por
 * `event.id`.
 */
export function isOutOfOrderEvent(
  lastAppliedMs: number | undefined,
  eventCreatedMs: number | undefined,
): boolean {
  return (
    lastAppliedMs !== undefined &&
    eventCreatedMs !== undefined &&
    lastAppliedMs > eventCreatedMs
  );
}

/**
 * Decide si, al pasar a `past_due`, corresponde conceder un periodo de gracia
 * nuevo (y el email de aviso). Reglas:
 *
 * - Desde `unpaid` NO: la clínica ya agotó su gracia y el cron la bloqueó;
 *   cada Smart Retry fallido posterior emite otro `invoice.payment_failed` y
 *   no debe reabrirle 7 días de operación gratis (H-4). Solo un cobro exitoso
 *   (`invoice.paid`, ver B-7) o un `subscription.updated(active)` la reactivan.
 * - Ya `past_due` con gracia corriendo NO: los reintentos no resetean el
 *   contador ni reenvían el email (H-4).
 * - En cualquier otro caso SÍ — incluido `past_due` SIN gracia, el estado roto
 *   que queda cuando el `invoice.payment_failed` se descarta por llegar fuera
 *   de orden respecto al `subscription.updated` (carrera C-1×H-5).
 */
export function shouldGrantGraceOnPastDue(
  estadoLocalPrevio: string | undefined,
  graceUntilPrevio: number | undefined,
): boolean {
  if (estadoLocalPrevio === "unpaid") return false;
  if (estadoLocalPrevio === "past_due" && graceUntilPrevio !== undefined) {
    return false;
  }
  return true;
}
