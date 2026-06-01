import {
  Injectable,
  signal,
  inject,
  effect,
  untracked,
  DestroyRef,
  NgZone,
  Injector,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { ConvexClient } from 'convex/browser';
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from 'convex/server';
import { environment } from '../../../environments/environment';
import type { ConvexTokenResult } from '../auth/services/better-auth.service';
import { SubscriptionGateService } from '../billing/subscription-gate.service';

export interface ConvexQueryResult<T> {
  readonly value: Signal<T | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<Error | null>;
}

export type ConvexTokenError = 'timeout' | 'network' | 'server-error';

/**
 * Error tipado lanzado por `query`/`mutation`/`action` cuando el cliente no
 * está autenticado y la llamada lo requería. Los callers pueden distinguirlo
 * de errores de servidor sin parsear strings.
 *
 *     try { await convex.query(...) }
 *     catch (err) {
 *       if (err instanceof NotAuthenticatedError) { ... }
 *     }
 */
export class NotAuthenticatedError extends Error {
  constructor(message = 'Cliente no autenticado para llamar a Convex') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

// Timeout por defecto al esperar a que el cliente reciba token. Coincide con
// el timeout de `getConvexToken` para que ambos caduquen juntos y el caller
// reciba un único error.
const WAIT_FOR_AUTH_DEFAULT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class ConvexService {
  private client: ConvexClient;
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  readonly isConnected = signal(false);

  // Espejo reactivo del estado de auth en el cliente Convex. setAuth lo pone a
  // true solo tras un token válido; clearAuth a false. watchQuery lo lee
  // dentro de su effect para pausar automáticamente cualquier suscripción
  // autenticada cuando el usuario hace logout o el token falla, sin que cada
  // servicio tenga que recordar añadir un guard manual.
  private _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  // Refleja el último error recuperable al obtener token (timeout/network/5xx).
  // null cuando la auth está OK o cuando el fallo es por sesión real inválida.
  private _tokenError = signal<ConvexTokenError | null>(null);
  readonly tokenError = this._tokenError.asReadonly();

  constructor() {
    this.client = new ConvexClient(environment.CONVEX_URL);
  }

  /**
   * Configura el proveedor de token para Convex. Dispara una primera
   * resolución para que `isAuthenticated`/`tokenError` reflejen el estado real
   * antes de que las queries empiecen a engancharse. Devuelve el primer
   * resultado para que el caller pueda reaccionar (ej. mostrar pantalla de
   * error si fue 504).
   */
  async setAuth(
    tokenFn: () => Promise<ConvexTokenResult>,
  ): Promise<ConvexTokenResult> {
    const firstResult = await tokenFn();
    this.applyAuthResult(firstResult);

    // El primer resultado se cachea para que el cliente Convex no haga otro
    // fetch redundante en cuanto se le pase el callback. En llamadas
    // posteriores (refresh del JWT cuando caduca), reintentamos con backoff
    // para tragar fallos cortos de red antes de propagar tokenError al UI.
    let firstConsumed = false;
    this.client.setAuth(async () => {
      if (!firstConsumed) {
        firstConsumed = true;
        return firstResult.ok ? firstResult.token : null;
      }
      const result = await this.refreshTokenWithRetry(tokenFn);
      this.ngZone.run(() => this.applyAuthResult(result));
      return result.ok ? result.token : null;
    });

    return firstResult;
  }

  /**
   * Limpia la autenticación pasando un token nulo.
   */
  clearAuth(): void {
    this.client.setAuth(async () => null);
    this._isAuthenticated.set(false);
    this._tokenError.set(null);
  }

  /**
   * Resetea el error de token. Lo usa el flujo de "Reintentar" antes de
   * disparar de nuevo `setAuth`, para que el overlay desaparezca aunque la
   * resolución se demore o falle de nuevo (el UI vuelve a poder reaccionar
   * limpio).
   */
  resetTokenError(): void {
    this._tokenError.set(null);
  }

  private async refreshTokenWithRetry(
    tokenFn: () => Promise<ConvexTokenResult>,
  ): Promise<ConvexTokenResult> {
    // Reintentos con backoff: 0 ms (primer intento), 500 ms, 1500 ms. Solo
    // se reintentan fallos recuperables (timeout/network/server-error). Si la
    // sesión es realmente inválida (unauthorized/no-session) salimos
    // inmediatamente para no enmascarar el problema real.
    const delays = [0, 500, 1500];
    let lastResult: ConvexTokenResult = { ok: false, reason: 'network' };
    for (const delay of delays) {
      if (delay > 0) {
        await new Promise<void>((res) => setTimeout(res, delay));
      }
      const result = await tokenFn();
      if (result.ok) return result;
      if (
        result.reason === 'unauthorized' ||
        result.reason === 'no-session'
      ) {
        return result;
      }
      lastResult = result;
    }
    return lastResult;
  }

  private applyAuthResult(result: ConvexTokenResult): void {
    if (result.ok) {
      this._isAuthenticated.set(true);
      this._tokenError.set(null);
      return;
    }
    this._isAuthenticated.set(false);
    if (
      result.reason === 'timeout' ||
      result.reason === 'network' ||
      result.reason === 'server-error'
    ) {
      this._tokenError.set(result.reason);
    } else {
      this._tokenError.set(null);
    }
  }

  /**
   * Crea una suscripción reactiva a un query de Convex.
   * Se re-suscribe automáticamente cuando cambian las señales en argsFn.
   * Pasar 'skip' como retorno de argsFn para pausar la suscripción.
   *
   * **Auth gate**: por defecto la suscripción se pausa automáticamente cuando
   * `isAuthenticated()` es false (logout o sesión sin restaurar). Esto evita
   * que cualquier query autenticada se dispare con token nulo y reciba un
   * error "No autenticado" en consola. Cuando el usuario vuelve a iniciar
   * sesión la suscripción se reactiva sin recarga. Pasar
   * `{ requireAuth: false }` en options para queries explícitamente públicas.
   *
   * Si se invoca fuera de un constructor o injection context,
   * pasar { injector } en options.
   */
  watchQuery<Query extends FunctionReference<'query'>>(
    query: Query,
    argsFn: () => FunctionArgs<Query> | 'skip',
    options?: { injector?: Injector; requireAuth?: boolean },
  ): ConvexQueryResult<FunctionReturnType<Query>> {
    const value: WritableSignal<FunctionReturnType<Query> | undefined> =
      signal(undefined);
    const isLoading = signal(true);
    const error = signal<Error | null>(null);

    const requireAuth = options?.requireAuth !== false;
    let currentUnsubscribe: (() => void) | null = null;

    const effectRef = effect(
      () => {
        // Lectura reactiva: cuando el estado de auth cambia el effect re-corre
        // y desuscribe (logout) o re-suscribe (login) automáticamente.
        const authed = requireAuth ? this._isAuthenticated() : true;
        const currentArgs = argsFn();

        untracked(() => {
          // Limpiar suscripción anterior
          currentUnsubscribe?.();
          currentUnsubscribe = null;

          if (!authed || currentArgs === 'skip') {
            isLoading.set(false);
            value.set(undefined);
            return;
          }

          isLoading.set(true);

          currentUnsubscribe = this.client.onUpdate(
            query,
            currentArgs,
            (result: FunctionReturnType<Query>) => {
              this.ngZone.run(() => {
                value.set(result);
                isLoading.set(false);
                error.set(null);
                this.isConnected.set(true);
              });
            },
          );
        });
      },
      { injector: options?.injector },
    );

    this.destroyRef.onDestroy(() => {
      currentUnsubscribe?.();
      effectRef.destroy();
    });

    return {
      value: value.asReadonly(),
      isLoading: isLoading.asReadonly(),
      error: error.asReadonly(),
    };
  }

  /**
   * Espera a que `isAuthenticated()` pase a true. Resuelve `true` cuando llegue,
   * o `false` si no llega antes de `timeoutMs`. Idempotente: si ya está
   * autenticado, resuelve inmediatamente.
   *
   * Se usa como gate antes de `query`/`mutation`/`action` para evitar que
   * llamadas autenticadas se disparen con token nulo durante un arranque en
   * curso o un refresh en flight. Implementado con `effect` reactivo + timer
   * para limpiarse correctamente en cualquier resolución.
   */
  async waitForAuth(timeoutMs: number = WAIT_FOR_AUTH_DEFAULT_MS): Promise<boolean> {
    if (this._isAuthenticated()) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      let effectRef: { destroy: () => void } | null = null;

      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        effectRef?.destroy();
        resolve(false);
      }, timeoutMs);

      effectRef = effect(
        () => {
          if (!this._isAuthenticated()) return;
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          // Destrucción diferida: si lo destruimos sincronamente dentro del
          // primer run del propio effect, Angular se queja del ciclo.
          queueMicrotask(() => effectRef?.destroy());
          resolve(true);
        },
        { injector: this.injector },
      );
    });
  }

  /**
   * Ejecuta una mutation de Convex.
   *
   * Por defecto requiere autenticación y espera hasta `timeoutMs` (8 s) a que
   * el cliente esté autenticado antes de disparar la llamada. Si tras el
   * timeout sigue sin auth, lanza `NotAuthenticatedError`. Para mutations
   * explícitamente públicas (registro, recuperación de password), pasar
   * `{ requireAuth: false }`.
   */
  async mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
    options?: { requireAuth?: boolean; timeoutMs?: number },
  ): Promise<FunctionReturnType<Mutation>> {
    await this.ensureAuthForCall(options);
    try {
      return await this.client.mutation(mutation, args);
    } catch (err) {
      this.maybeHandleSubscriptionGate(err);
      throw err;
    }
  }

  /**
   * Ejecuta una action de Convex (side-effects como email, PDF). Mismo gate
   * que `mutation`. Para actions públicas (`auth.actions.register`,
   * `auth.actions.requestPasswordReset`) pasar `{ requireAuth: false }`.
   */
  async action<Action extends FunctionReference<'action'>>(
    action: Action,
    args: FunctionArgs<Action>,
    options?: { requireAuth?: boolean; timeoutMs?: number },
  ): Promise<FunctionReturnType<Action>> {
    await this.ensureAuthForCall(options);
    try {
      return await this.client.action(action, args);
    } catch (err) {
      this.maybeHandleSubscriptionGate(err);
      throw err;
    }
  }

  /**
   * Query one-shot (sin suscripción, para datos que no necesitan tiempo real).
   * Mismo gate que `mutation`/`action`.
   */
  async query<Query extends FunctionReference<'query'>>(
    query: Query,
    args: FunctionArgs<Query>,
    options?: { requireAuth?: boolean; timeoutMs?: number },
  ): Promise<FunctionReturnType<Query>> {
    await this.ensureAuthForCall(options);
    return this.client.query(query, args);
  }

  private async ensureAuthForCall(options?: {
    requireAuth?: boolean;
    timeoutMs?: number;
  }): Promise<void> {
    const requireAuth = options?.requireAuth !== false;
    if (!requireAuth) return;
    const ok = await this.waitForAuth(options?.timeoutMs);
    if (!ok) throw new NotAuthenticatedError();
  }

  // Resolución lazy del gate para evitar referencias circulares en arranque y
  // permitir que el service sea opcional en tests/setups sin Router/Dialog.
  private maybeHandleSubscriptionGate(err: unknown): void {
    try {
      const gate = this.injector.get(SubscriptionGateService);
      gate.handle(err);
    } catch {
      // Si el inyector no resuelve el gate (entorno de tests, arranque),
      // ignoramos silenciosamente — el caller seguirá viendo el throw.
    }
  }
}
