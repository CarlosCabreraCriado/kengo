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

export interface ConvexQueryResult<T> {
  readonly value: Signal<T | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<Error | null>;
}

@Injectable({ providedIn: 'root' })
export class ConvexService {
  private client: ConvexClient;
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  readonly isConnected = signal(false);

  // Espejo reactivo del estado de auth en el cliente Convex. setAuth lo pone a
  // true; clearAuth a false. watchQuery lo lee dentro de su effect para pausar
  // automáticamente cualquier suscripción autenticada cuando el usuario hace
  // logout, sin que cada servicio tenga que recordar añadir un guard manual.
  private _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  constructor() {
    this.client = new ConvexClient(environment.CONVEX_URL);
  }

  /**
   * Configura el token de autenticación (desde Clerk u otro provider).
   */
  setAuth(tokenFn: () => Promise<string | null>): void {
    this.client.setAuth(tokenFn);
    this._isAuthenticated.set(true);
  }

  /**
   * Limpia la autenticación pasando un token nulo.
   */
  clearAuth(): void {
    this.client.setAuth(async () => null);
    this._isAuthenticated.set(false);
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
   * Ejecuta una mutation de Convex.
   */
  async mutation<Mutation extends FunctionReference<'mutation'>>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
  ): Promise<FunctionReturnType<Mutation>> {
    return this.client.mutation(mutation, args);
  }

  /**
   * Ejecuta una action de Convex (side-effects como email, PDF).
   */
  async action<Action extends FunctionReference<'action'>>(
    action: Action,
    args: FunctionArgs<Action>,
  ): Promise<FunctionReturnType<Action>> {
    return this.client.action(action, args);
  }

  /**
   * Query one-shot (sin suscripción, para datos que no necesitan tiempo real).
   */
  async query<Query extends FunctionReference<'query'>>(
    query: Query,
    args: FunctionArgs<Query>,
  ): Promise<FunctionReturnType<Query>> {
    return this.client.query(query, args);
  }
}
