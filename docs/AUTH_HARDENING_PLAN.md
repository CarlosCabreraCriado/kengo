# Plan de robustecimiento del flujo de autenticación

> Documento de seguimiento para corregir y endurecer el flujo de auth Convex + Better-Auth en Kengo. Incluye el análisis de causa raíz, el estado actual y un plan ejecutable en fases independientes (cada una pensada para realizarse en una sesión aparte y cerrarse en un PR propio).

---

## 0. Contexto

Un usuario reportó un dashboard en blanco con error `504 Gateway Timeout` en `https://backend.kengoapp.com/api/auth/convex/token`. Al investigar, encontramos que el servidor estaba sano cuando ocurrió el incidente y que **el síntoma real era una combinación de dos problemas**:

1. **Incidente aislado de latencia** en `/api/auth/convex/token` (cold start del componente Better-Auth + posible rotación de JWKS) que produjo un 504 puntual.
2. **Problema sistémico**: cuando el cliente no obtiene token (por timeout, 504, sesión zombie, JWT caducado, race condition en arranque), las queries de Convex se disparan sin auth y reventan en `getAuthenticatedUser` (`convex/_helpers/permissions.ts:21`) → spam masivo de `Uncaught Error: No autenticado` en los logs.

Los logs muestran este error en queries de: `me`, `dashboard`, `plans`, `conversations`, `billing`, `alerts`, `clinics`, `snapshots`. Todas llaman al mismo `getAuthenticatedUser` que lanza el error cuando `ctx.auth.getUserIdentity()` devuelve `null`.

---

## 1. Resumen del análisis

### Causas raíz identificadas

| # | Causa | Gravedad | Estado |
|---|---|---|---|
| 1 | Race condition de auth en arranque (`setAuth` marcaba `_isAuthenticated=true` antes de tener token) | Alta | ✅ Resuelto en commit `0991d90` |
| 2 | Cookies zombie en localStorage tras logout fallido o invalidación server-side | Alta | ✅ Resuelto en **Fase 1** |
| 3 | `convex.query/mutation/action` no tienen gate de auth (solo `watchQuery`) | Alta | ✅ Resuelto en **Fase 2** |
| 4 | Refresh del JWT falla silenciosamente durante runtime — no se muestra overlay | Media | ❌ Pendiente — **Fase 3** |
| 5 | `cargarMiUsuario` y `checkSession` invocan `convex.query` sin verificar gate | Media | ✅ Resuelto en **Fase 2** (gate automático en `convex.query`) |
| 6 | `sessionExpiresIn` de 7 días sin coordinación con invalidaciones server-side | Media | ❌ Pendiente — **Fase 4** |
| 7 | `applicationID` no configurado en el plugin convex de Better-Auth | Baja | ❌ Pendiente — **Fase 6** |
| 8 | Endpoint `/api/auth/convex/token` no es observable (no aparece en logs estándar de Convex) | Baja operativa | ❌ Pendiente — **Fase 5** |

### Lo que ya se entregó en `0991d90`

- `getConvexToken()` con `AbortController` (timeout 8 s) y retorno tipado `ConvexTokenResult`.
- `ConvexService.setAuth` async, idempotente; refleja el estado real en `isAuthenticated` y expone `tokenError`.
- `SessionService.errorConexion` signal con métodos `marcarErrorConexion` / `limpiarErrorConexion`.
- `AuthService.iniciarApp` idempotente; marca `errorConexion` cuando hay 504/timeout/network; `reintentarConexion` para el botón.
- `AuthGuard` espera a `iniciarApp` y permite navegación cuando hay error de red.
- Nuevo componente `<app-connection-error>` (overlay con botones Reintentar y Cerrar sesión).
- `login.component` adaptado al nuevo tipo de retorno de `checkSession`.

---

## 2. Fases de desarrollo

Cada fase es **autónoma**: se puede ejecutar en una sesión independiente, no rompe la app, y termina con un commit. El orden recomendado es 1 → 2 → 3 → 4 → 6 → 5 (la 5 puede ir antes si surge una urgencia operativa).

---

### Fase 1 — Limpieza de cookies zombie y manejo de sesión inválida ✅

> **Estado:** completada el 2026-05-13. Pendiente de validación manual en producción.

**Objetivo:** garantizar que tras un logout (exitoso o no) y tras detectar una sesión invalidada server-side (`unauthorized`), no quede rastro en `localStorage` ni en `@capacitor/preferences`, y que el usuario sea redirigido a `/login` en vez de quedar en limbo.

**Justificación:** hoy `auth.service.ts:limpiarEstadoLocal` solo borra `kengo:theme:v1` y `kengo:modo`. Las cookies `better-auth_cookie` y `better-auth_session_data` se quedan si `signOut()` falla. Y `iniciarApp` cae en una rama silenciosa cuando `tokenResult.reason === 'unauthorized'`: no limpia ni redirige.

**Resumen de cambios entregados:**

- `BetterAuthService.purgeStoredSession()` (nuevo) — borra `better-auth_cookie` y `better-auth_session_data` de `localStorage` y `ba_cookie`/`ba_session_data` de `@capacitor/preferences`. Idempotente y silencioso.
- `BetterAuthService.signOut()` ahora llama a `purgeStoredSession()` en lugar de solo `clearNativeBackup()`, garantizando limpieza también en `localStorage` cuando el `init` del plugin no se ejecute.
- `AuthService.logout()` invoca explícitamente `purgeStoredSession()` tras el `signOut` (éxito o fallo) — defensa en profundidad.
- `AuthService.ejecutarIniciarApp()` ahora maneja `unauthorized` / `no-session` con sesión guardada: purga `localStorage` + `clearAuth` + `sessionService.limpiar` + `isLoggedIn=false` + log de warning. El `AuthGuard` redirige a `/login` en el flujo normal.

#### Archivos a tocar
- `apps/app/src/app/core/auth/services/better-auth.service.ts`
- `apps/app/src/app/core/auth/services/auth.service.ts`

#### TODOs

- [x] **1.1** Añadir método `purgeStoredSession()` en `BetterAuthService`:
  - [x] Borrar `localStorage.removeItem('better-auth_cookie')`
  - [x] Borrar `localStorage.removeItem('better-auth_session_data')`
  - [x] Si `platform.isNative()`: `Preferences.remove({ key: 'ba_cookie' })` y `Preferences.remove({ key: 'ba_session_data' })` (reutilizando `clearNativeBackup()` interno).
  - [x] Capturar errores con `try/catch` silencioso (idempotente).
- [x] **1.2** Modificar `BetterAuthService.signOut()` para que **siempre** llame a `purgeStoredSession()` al final, exitoso o no. Sustituye al antiguo `clearNativeBackup` directo: ahora se limpia también `localStorage`.
- [x] **1.3** En `AuthService.logout()`:
  - [x] Tras el `try/catch` del `signOut`, llamar a `this.betterAuth.purgeStoredSession()` explícitamente.
  - [x] Garantizar que `this.convex.clearAuth()` se ejecuta incluso si todo lo anterior falla (verificado: se llama después del purge).
- [x] **1.4** En `AuthService.ejecutarIniciarApp()`, cuando `tokenResult.reason === 'unauthorized'` o `'no-session'`:
  - [x] Llamar a `this.betterAuth.purgeStoredSession()`.
  - [x] Llamar a `this.convex.clearAuth()`.
  - [x] `this.sessionService.limpiar()` para borrar el cache local del usuario.
  - [x] Marcar `this.isLoggedIn.set(false)`.
  - [x] **No redirigir** desde el servicio: el `AuthGuard` lo hace. Log de warning añadido: `[AuthService] Sesión inválida en servidor — purgando estado local`.
- [x] **1.5** Verificado: `AuthGuard.canActivate()` cae en la rama final `router.navigate(['/login'])` cuando `iniciarApp` deja `isLoggedIn=false` y `hasStoredSession=false` (resultado `'no-session'`). Sin bucles.
- [ ] **1.6** Tests manuales pendientes de ejecutar en navegador real:
  - [ ] **Caso A**: invalidar la sesión server-side (borrar fila de `betterAuth_sessions` en Convex dashboard) → recargar app → debe ir a `/login` y no quedar bucle.
  - [ ] **Caso B**: bloquear `**/sign-out` en DevTools → hacer logout → cookies deben desaparecer igualmente y debe ir a `/login`.
  - [ ] **Caso C**: logout normal (red OK) → cookies desaparecen.

#### Snippet de referencia

```ts
// better-auth.service.ts
async purgeStoredSession(): Promise<void> {
  try {
    localStorage.removeItem(LS_COOKIE_KEY);
    localStorage.removeItem(LS_SESSION_KEY);
  } catch { /* ignore */ }
  if (this.platform.isNative()) {
    try {
      await Preferences.remove({ key: PREFS_COOKIE_KEY });
      await Preferences.remove({ key: PREFS_SESSION_KEY });
    } catch { /* ignore */ }
  }
}

async signOut(): Promise<void> {
  try {
    await this.authClient.signOut();
  } catch {
    // ignorar
  }
  await this.purgeStoredSession();
}
```

#### Definición de hecho
- [x] Tras logout (success o fail) no queda `better-auth_*` en localStorage. *(implementado, validar en navegador)*
- [x] Sesión invalidada server-side → cookies se purgan y redirige a `/login` en el siguiente arranque. *(implementado, validar en navegador)*
- [x] `npx nx build app` limpio tras los cambios (verificado). `npx nx lint app` sin errores nuevos en archivos tocados.

---

### Fase 2 — Gate de auth en `convex.query/mutation/action` ✅

> **Estado:** completada el 2026-05-13. Pendiente de validación manual del flujo de login/registro sin sesión previa.

**Objetivo:** que ninguna llamada autenticada a Convex se ejecute con token nulo. Cuando el cliente no tenga token, las llamadas deben esperar (con timeout) o rechazarse limpiamente con un error tipado en lugar de llegar al servidor y reventar.

**Justificación:** hoy `watchQuery` ya tiene gate (`requireAuth`), pero `query/mutation/action` no. Esto es lo que genera la mayoría del spam de "No autenticado" en logs: cualquier servicio que llame `convex.query(...)` sin importar el estado de auth manda la request.

**Resumen de cambios entregados:**

- `NotAuthenticatedError` exportada desde `convex.service.ts` para que los callers la distingan de errores de servidor sin parsear strings.
- `ConvexService.waitForAuth(timeoutMs = 8000)` — espera reactiva con `effect` + timer; resuelve `true` cuando `isAuthenticated()` pasa a `true`, `false` si no llega antes del timeout. Idempotente y se limpia correctamente en cualquier resolución.
- `ConvexService.query/mutation/action` aceptan `options?: { requireAuth?: boolean; timeoutMs?: number }`. Por defecto `requireAuth: true`. Si el gate falla → `throw NotAuthenticatedError`.
- Helper interno `ensureAuthForCall(options)` centraliza la lógica para que los 3 métodos compartan el mismo gate.
- Llamadas explícitamente públicas marcadas con `requireAuth: false`:
  - `AuthService.register` → `api.auth.actions.register`
  - `AuthService.solicitarRecuperacion` → `api.auth.actions.requestPasswordReset`
- `SessionService.cargarMiUsuario` captura `NotAuthenticatedError` con un `console.warn` (en vez de `console.error`) para no spamear la consola con errores esperados cuando el cliente no tiene token aún.

#### Archivos a tocar
- `apps/app/src/app/core/convex/convex.service.ts` (principal)
- Posibles callers que necesiten manejar el nuevo error tipado:
  - `apps/app/src/app/core/auth/services/auth.service.ts`
  - `apps/app/src/app/core/auth/services/session.service.ts`
  - Servicios de features que usen `convex.query/mutation/action`

#### TODOs

- [x] **2.1** `NotAuthenticatedError` exportada desde `convex.service.ts`.
- [x] **2.2** `waitForAuth(timeoutMs = 8000)` implementado con `effect` + `setTimeout`, `Injector` capturado en constructor del servicio. Se destruye con `queueMicrotask` para evitar el ciclo de "destrucción dentro del primer run del effect".
- [x] **2.3** `query/mutation/action` aceptan `options.requireAuth` y `options.timeoutMs`. Default `requireAuth: true`. Si gate falla → `NotAuthenticatedError` via helper privado `ensureAuthForCall`.
- [x] **2.4** Llamadas públicas marcadas con `requireAuth: false`:
  - [x] `AuthService.register` → `api.auth.actions.register`.
  - [x] `AuthService.solicitarRecuperacion` → `api.auth.actions.requestPasswordReset`.
  - [x] Auditado el resto de callers del service-tree: `login` y `consumirTokenAcceso` no usan `convex.action/query/mutation` (van por fetch directo a Better-Auth), por lo que no requieren cambio. `establecerPassword`, `resetPassword` y `verifyMagicLink` también van por fetch directo.
- [x] **2.5** Callers ajustados:
  - [x] `SessionService.cargarMiUsuario`: captura `NotAuthenticatedError` y degrada a `console.warn` en vez de `console.error`. Mantiene la limpieza del usuario y deja al `AuthGuard` decidir el redirect.
  - [x] `AuthService.checkSession`: ya estaba protegido — el catch genérico actual mapea correctamente a `'network-error'` o `'unauthorized'` según `tokenError()`. No requiere cambio explícito.
  - [ ] Servicios de feature (planes, pacientes, etc.): no se han ajustado individualmente; el comportamiento por defecto del componente al recibir `NotAuthenticatedError` será mostrar el toast genérico de error. Aceptable mientras la Fase 3 no añada UI de runtime. Auditar tras Fase 3 si genera UX confusa.
- [x] **2.6** Verificado por inspección que `register` y `requestPasswordReset` no requieren auth previa (formulario de registro/recovery sin sesión). El cliente de login sigue usando `BetterAuthService.signIn` (fetch directo), por lo que no toca `convex.action`.
- [ ] **2.7** Tests manuales pendientes de ejecutar en navegador real:
  - [ ] Con sesión válida → todas las queries pasan, sin spam de "No autenticado" en logs de Convex.
  - [ ] Sin sesión + intento de query autenticada → `NotAuthenticatedError` en cliente, sin request al servidor.
  - [ ] Login form sin sesión previa → registro y recuperación funcionan.

#### Snippet de referencia

```ts
// convex.service.ts
private injector = inject(Injector);

async waitForAuth(timeoutMs = 8000): Promise<boolean> {
  if (this._isAuthenticated()) return true;

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      ref.destroy();
      resolve(false);
    }, timeoutMs);

    const ref = effect(() => {
      if (this._isAuthenticated()) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        ref.destroy();
        resolve(true);
      }
    }, { injector: this.injector });
  });
}

async query<Q extends FunctionReference<'query'>>(
  query: Q,
  args: FunctionArgs<Q>,
  options?: { requireAuth?: boolean },
): Promise<FunctionReturnType<Q>> {
  const requireAuth = options?.requireAuth !== false;
  if (requireAuth && !(await this.waitForAuth())) {
    throw new NotAuthenticatedError();
  }
  return this.client.query(query, args);
}
```

#### Definición de hecho
- [ ] Logs de Convex no muestran "No autenticado" durante un flujo normal de uso. *(implementado, validar en producción tras deploy)*
- [x] Login sin sesión previa funciona sin tocar `convex.query` autenticada. *(verificado por inspección de callers)*
- [ ] Tests E2E (si existen) o smoke test manual pasa. *(pendiente — ver Fase 7)*
- [x] `npx nx build app` limpio. `npx nx lint app` no introduce errores nuevos en archivos tocados.

---

### Fase 3 — UI fallback para fallos de refresh durante runtime

**Objetivo:** cuando el JWT caduca a mitad de sesión y el refresh falla (red, 504, etc.), mostrar el overlay `<app-connection-error>` (o un toast con reintento) en lugar de que el usuario vea la app congelada sin feedback.

**Justificación:** hoy el overlay solo se dispara con `sessionService.errorConexion()`, y eso solo se setea desde `iniciarApp`. Si el refresh falla a las 2 h de uso, `_tokenError` se rellena pero el usuario no ve nada — las watchQuery se pausan silenciosamente.

#### Archivos a tocar
- `apps/app/src/app/app.component.ts` o `app.component.html`
- Opcional: `apps/app/src/app/core/components/connection-error/connection-error.component.ts`

#### TODOs

- [ ] **3.1** Decidir UX: ¿overlay full-screen (consistente con el cold start) o toast persistente con botón? Recomendación: **overlay** cuando el error persista >5 s, **toast** durante los primeros 5 s del fallo (margen para reintento automático).
- [ ] **3.2** Implementar en `AppComponent`:
  - [ ] Añadir computed `mostrarErrorConexion = computed(() => this.sessionService.errorConexion() || !!this.convex.tokenError())`.
  - [ ] Cambiar la condición del overlay en `app.component.html` a este computed.
  - [ ] Verificar que `ConnectionErrorComponent` puede leer tanto `tokenError` (runtime) como `errorConexion` (arranque) para mostrar mensaje contextual — ya lo hace.
- [ ] **3.3** Reintento automático "suave" antes del overlay:
  - [ ] En `ConvexService.setAuth` wrapper de refresh, si la primera renovación falla, reintentar 1-2 veces con backoff (500 ms, 1.5 s) antes de propagar al UI.
  - [ ] Solo mostrar `tokenError` si tras los reintentos sigue fallando.
- [ ] **3.4** El botón "Reintentar" del overlay ya llama a `reintentarConexion → iniciarApp`. Verificar que también funciona cuando el error es de runtime (no de arranque): probablemente requiera un nuevo método `convex.retryAuth()` que reset `tokenError` y vuelva a llamar al callback.
- [ ] **3.5** Tests manuales:
  - [ ] **Caso A**: usuario con app abierta → bloquear `/api/auth/convex/token` desde DevTools → forzar refresh esperando 15 min o llamando manualmente `convex.client.setAuth` con token caducado → debe aparecer overlay.
  - [ ] **Caso B**: pulsar "Reintentar" tras desbloquear → desaparece overlay y queries vuelven a funcionar sin recarga.

#### Definición de hecho
- [ ] El overlay aparece tras un fallo de refresh prolongado.
- [ ] El botón "Reintentar" rehidrata las queries sin recargar la página.
- [ ] No aparece overlay falso durante reintentos cortos (<5 s).

---

### Fase 4 — Coordinación de TTL: reducir `sessionExpiresIn` y refresh proactivo

**Objetivo:** reducir la ventana de cookies-zombie sincronizando el TTL de la cookie con el ritmo real de uso.

**Justificación:** Better-Auth usa 7 días por defecto. Una sesión invalidada server-side mantiene la cookie cliente "no expirada" hasta esos 7 días, generando 401 sucesivos. Reducir a 24 h con `updateAge: 1h` (refresh sliding) recorta la ventana y mantiene la experiencia de "stay logged in".

#### Archivos a tocar
- `convex/auth.ts:115-159` (función `createAuth`)

#### TODOs

- [ ] **4.1** En `convex/auth.ts:createAuth`, añadir bloque `session`:
  ```ts
  session: {
    expiresIn: 60 * 60 * 24,   // 24 h
    updateAge: 60 * 60,        // refresca la cookie cada hora si el usuario está activo
  },
  ```
- [ ] **4.2** Revisar implicaciones en uso nativo:
  - [ ] En iOS/Android Capacitor, si la app está cerrada >24 h, el usuario tendrá que volver a hacer login. Confirmar si es aceptable o si conviene un valor mayor (p. ej. 7 días con `updateAge: 1d`).
  - [ ] Documentar la decisión en el commit message.
- [ ] **4.3** Comunicar el cambio:
  - [ ] Tras el deploy, los usuarios actuales verán su cookie reemplazada en la siguiente acción. Si la cookie actual ya está expirada (7 d desde último refresh), tendrán que hacer login.
  - [ ] No requiere migración de datos.
- [ ] **4.4** Verificación:
  - [ ] Inspect localStorage tras login: `better-auth_cookie` debe contener `max-age=86400`.
  - [ ] Tras 1 h de uso, comprobar que se ha refrescado.

#### Definición de hecho
- [ ] Cookie cliente tiene `max-age` acorde al nuevo `expiresIn`.
- [ ] No hay regresiones en flujo de login/logout.
- [ ] Documentado en CLAUDE.md o en `docs/PLAN_PERSISTENCIA_SESION.md` el nuevo régimen.

---

### Fase 5 — Observabilidad del endpoint `/api/auth/convex/token`

**Objetivo:** poder detectar 504s, latencias anómalas y patrones de fallo antes de que un usuario lo reporte.

**Justificación:** el endpoint es un `httpAction` del componente `@convex-dev/better-auth`, no una función pública de Convex, así que no aparece en la pestaña de funciones del dashboard. Hoy el único señal son los reports de usuarios.

#### Archivos a tocar
- `apps/app/src/app/core/auth/services/better-auth.service.ts`
- Opcional: integración con servicio de telemetría existente (revisar si hay Sentry, PostHog, etc.)

#### TODOs

- [ ] **5.1** Auditar qué telemetría existe en el proyecto:
  - [ ] `grep -r "Sentry\|posthog\|datadog\|@sentry" apps/app/src` para detectar SDKs ya integrados.
  - [ ] Si no hay nada, considerar añadir uno ligero (Sentry o un logger custom a backend).
- [ ] **5.2** Instrumentar `getConvexToken()`:
  - [ ] Medir tiempo desde fetch start hasta resolución.
  - [ ] Registrar `{ latencyMs, status, reason }` en cada llamada.
  - [ ] Si `latencyMs > 3000` o `reason !== 'ok'`, enviar a telemetría con nivel `warn`.
- [ ] **5.3** Wrapping no intrusivo:
  - [ ] No cambiar la firma de `getConvexToken`. Añadir el logging dentro.
- [ ] **5.4** Dashboard / alertas:
  - [ ] Crear alerta en la plataforma elegida: ≥3 fallos de `getConvexToken` en 1 min → notificación.
  - [ ] Métricas exportables: p95 latencia, tasa de error.
- [ ] **5.5** Documentar en `docs/AUTH_HARDENING_PLAN.md` (este archivo) los dashboards y dónde se ven.

#### Definición de hecho
- [ ] Cada llamada a `/api/auth/convex/token` queda registrada con su latencia y status.
- [ ] Alerta operativa configurada.
- [ ] El siguiente 504 nos llega antes que el usuario.

---

### Fase 6 — Configurar `applicationID` y endurecer la firma del JWT

**Objetivo:** evitar mismatches latentes entre el JWT emitido por el plugin y el `auth.config.ts` que Convex usa para validar.

**Justificación:** el plugin convex de Better-Auth puede coexistir en multi-tenant o tras un cambio de configuración futuro. Sin `applicationID` explícito, hay ambigüedad. Definirlo ahora es trivial y previene incidentes.

#### Archivos a tocar
- `convex/auth.ts:147-149`

#### TODOs

- [ ] **6.1** Determinar el `applicationID` adecuado. Sugerencia: `'kengo'`.
- [ ] **6.2** Configurar en el plugin:
  ```ts
  convex({ authConfig, applicationID: 'kengo' }),
  ```
- [ ] **6.3** Verificar que `convex/auth.config.ts` y el `getAuthConfigProvider()` recogen este `applicationID` automáticamente (revisar API del helper en `@convex-dev/better-auth/auth-config`).
- [ ] **6.4** **CRÍTICO**: tras el cambio, los JWT emitidos con `applicationID` distinto al anterior **dejarán de validar**. Esto puede invalidar tokens cacheados en clientes (max 15 min de duración) — el siguiente refresh emitirá uno nuevo. **No** invalida cookies de sesión.
- [ ] **6.5** Coordinar deploy:
  - [ ] Deploy de Convex primero (servidor acepta nuevos JWT).
  - [ ] No requiere coordinar con frontend.
- [ ] **6.6** Validar tras deploy:
  - [ ] Hacer login → JWT debe contener el claim correcto (decodificar en jwt.io).
  - [ ] `getAuthenticatedUser` debe funcionar normalmente.

#### Definición de hecho
- [ ] `applicationID` definido y verificado.
- [ ] Login post-deploy funciona.
- [ ] Documentado en `convex/auth.ts` con un comentario explicando la elección.

---

### Fase 7 (opcional) — Tests E2E del flujo de auth

**Objetivo:** automatizar la validación de los escenarios cubiertos en las fases 1-6 para prevenir regresiones.

**Justificación:** el flujo de auth es crítico y ha tenido varios bugs sutiles. Tests E2E con Playwright nos protegen de regresiones futuras.

#### TODOs

- [ ] **7.1** Localizar tests Playwright existentes (`e2e/` en root).
- [ ] **7.2** Tests a añadir:
  - [ ] Login normal funciona.
  - [ ] Logout limpia cookies (`better-auth_cookie` ausente tras logout).
  - [ ] Bloquear `/api/auth/convex/token` durante el arranque → overlay aparece en ≤9 s.
  - [ ] Reintentar tras desbloquear → dashboard carga.
  - [ ] Sesión invalidada server-side → redirige a `/login` en el siguiente arranque.
  - [ ] Cold start sin sesión → flow normal a `/login`.
- [ ] **7.3** Integrar en CI si no estaban.

---

## 3. Apéndice — Archivos clave de referencia

| Archivo | Rol |
|---|---|
| `convex/_helpers/permissions.ts:18-34` | `getAuthenticatedUser` — fuente de los errores "No autenticado". |
| `convex/auth.ts:114-159` | `createAuth` — configuración del plugin Better-Auth. |
| `convex/auth.config.ts` | Provider de auth para Convex. |
| `apps/app/src/app/core/auth/services/better-auth.service.ts` | Cliente Better-Auth (cookie, token, sign-in/out). |
| `apps/app/src/app/core/auth/services/auth.service.ts` | Orquestación de auth (iniciarApp, login, logout, checkSession). |
| `apps/app/src/app/core/auth/services/session.service.ts` | Estado del usuario + `errorConexion`. |
| `apps/app/src/app/core/convex/convex.service.ts` | Wrapper de `ConvexClient` + `watchQuery` con gate. |
| `apps/app/src/app/core/guards/auth.guard.ts` | Guard de rutas autenticadas. |
| `apps/app/src/app/core/components/connection-error/` | Overlay de error de conexión. |
| `node_modules/@convex-dev/better-auth/dist/plugins/cross-domain/client.js` | Plugin que gestiona cookie en localStorage (sólo lectura, referencia). |
| `node_modules/@convex-dev/better-auth/src/plugins/convex/index.ts` | Plugin que registra `/api/auth/convex/token` y firma JWT. |

---

## 4. Convenciones de trabajo

- **Una fase = un PR**. No mezclar cambios de fases distintas en un mismo commit.
- **Mensaje de commit**: `fix(auth): <descripción corta>` o `feat(auth): <descripción>` siguiendo conventional commits en español, sin referencias a herramientas de IA.
- **Antes de cerrar una fase**: ejecutar `npx nx build app --configuration development` y, en lo posible, `npx nx lint app` filtrando solo los archivos tocados.
- **Al terminar una fase**: marcar el checkbox correspondiente en el bloque "Estado" de la sección 1 y aquí.
- **Tests manuales obligatorios** en cada fase: simular el escenario afectado bloqueando endpoints desde DevTools (Network → Block request URL) o forzando estados.

---

## 5. Bitácora de progreso

| Fecha | Fase | Commit | Notas |
|---|---|---|---|
| 2026-05-13 | Fase 0 (mitigación urgente) | `0991d90` | Resuelto race condition de arranque, timeout en getConvexToken, overlay de error. |
| 2026-05-13 | Fase 1 | `24103d2` | purgeStoredSession + manejo de sesión zombie en logout e iniciarApp. Validación manual en navegador pendiente. |
| 2026-05-13 | Fase 2 | `5e0d690` | Gate de auth en query/mutation/action vía waitForAuth + NotAuthenticatedError. register y requestPasswordReset marcados requireAuth:false. Validación de spam de logs en producción tras deploy. |
| | Fase 3 | | |
| | Fase 4 | | |
| | Fase 5 | | |
| | Fase 6 | | |
| | Fase 7 | | |

---

## 6. Notas finales

- El 504 puntual reportado **no era reproducible** porque dependía de un cold start del componente Better-Auth + posible rotación de JWKS. Las fases 4 (TTL más corto) y 5 (observabilidad) son las que más reducen la probabilidad de que se repita; el resto endurece el comportamiento del cliente frente al fallo.
- Si tras la Fase 2 los logs siguen mostrando "No autenticado" aislados, sospechar de:
  - Refresh de JWT que devuelve null sin actualizar `_isAuthenticated`.
  - Algún componente que use `ConvexClient` directamente (no a través de `ConvexService`).
  - Suscripciones que sobreviven a un `clearAuth` por orden de operaciones incorrecto.
- Las fases 3, 4 y 6 pueden ejecutarse en paralelo si hay varias personas. Las fases 1 y 2 deben hacerse en orden (la 2 asume la 1 hecha).
