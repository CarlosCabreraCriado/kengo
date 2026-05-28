/**
 * Envuelve una promesa en un timeout. Si la promesa no resuelve antes de `ms`,
 * la promesa devuelta rechaza con un Error. Útil para proteger fetches o
 * llamadas a clientes externos (Convex, Better-Auth) que pueden colgarse sin
 * AbortController propio.
 *
 * Nota: la promesa original NO se cancela — solo se ignora su resolución.
 * Para cancelación real hay que combinar con AbortController en el caller.
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout ${ms}ms]`)), ms),
    ),
  ]);
}
