# App Nativa iOS/Android con Capacitor 8

Documento de referencia de la integración con **Capacitor 8.3.x** que convierte la SPA Angular en una app nativa distribuible en App Store y Google Play sin reescribir lógica de negocio.

> Estado: **MVP funcional** (Fases 0–4 del plan original) + retorno de Stripe vía deep link.
> Pendiente: tareas operativas (deploy, `.well-known`, certificados) y mejoras opcionales (push, live updates, IAP).

---

## 1. Por qué Capacitor (y no Ionic / React Native / Flutter)

- **Cero reescritura del codebase Angular existente** (standalone, signals, OnPush, Tailwind v4, Convex).
- **Plugins oficiales** para las APIs nativas que necesitamos (cámara, clipboard, haptics, browser, share, deep links).
- **Web y nativo siguen siendo el mismo bundle Angular** — solo cambia el envoltorio.
- **Capacitor 8** es la versión estable a la fecha de implementación (Node 22+, iOS 15+, Android API 36, Xcode 26+, Android Studio Otter 2025.2.1+) — todos los requisitos cubiertos por el entorno actual.

---

## 2. Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Ubicación física de los proyectos nativos | `apps/app/ios/` y `apps/app/android/` | Capacitor lee `capacitor.config.ts` desde el cwd; colocalizar evita rutas relativas raras y rompe menos en Nx. |
| `webDir` | `../../dist/apps/app/browser` | Es donde el builder `@angular/build:application` emite el bundle (ver `apps/app/project.json`). |
| Bundle ID (`appId`) | `com.kengoapp.app` | Convención reverse-DNS sobre el dominio. **Crítico**: cambiar este valor después de publicar en stores implica registrar una app nueva. |
| Origin del WebView | `https://app.kengoapp.local` (vía `server.hostname`) | Da un origin estable y consistente entre iOS y Android. Necesario para que (a) el header `Origin` sea predecible en CORS y (b) Better-Auth genere requests cross-origin contra `backend.kengoapp.com` con headers consistentes. |
| `<base href>` | Sin cambios (`/`) | Capacitor sirve desde `https://localhost` (Android) o `capacitor://localhost` / `https://app.kengoapp.local` (iOS) — la base relativa funciona idéntica que en web. |
| Detección de plataforma | `PlatformService` (signals) que envuelve `Capacitor.getPlatform()` / `isNativePlatform()` | Centraliza, evita imports dispersos a `@capacitor/core`, mockeable en tests. |
| Service Worker (`@angular/service-worker`) | **Deshabilitado en native** vía `!isCapacitorNativePlatform()` en `provideServiceWorker(...)` | El SW interfiere con WKWebView y con el bridge nativo. El cache en native lo gestiona el packager (los assets ya están bundleados en la app). En web sigue activo en producción. |
| Auth en WebView | **Sin cambios al flujo Better-Auth.** Backup adicional de la sesión en `@capacitor/preferences` y CORS Convex ampliado. | `crossDomainClient` ya guarda la sesión en `localStorage` y la envía como header `Better-Auth-Cookie` — esto **evita** el problema crítico de WKWebView con third-party cookies. La razón principal por la que la migración fue viable sin reescribir auth. |
| Stripe en native | **In-app browser** (`@capacitor/browser` con `presentationStyle: 'popover'`) reusando el flujo web. Sin SDK nativo Stripe ni IAP wrapper en fase 1. | Más rápido de implementar, 0% comisión Apple. Aceptado el riesgo de revisión Apple post Epic v. Apple (mayo 2025). |
| Retorno desde Stripe | Interstitial HTTPS (`/billing-return.html`) que dispara `kengo://billing/return?status=...` | Stripe rechaza esquemas custom en `success_url` / `cancel_url` — solo acepta HTTPS. El interstitial actúa como puente HTTPS→deep link. |
| Deep links | Custom scheme `kengo://` + Android App Links + (futuros) Universal Links iOS | Custom scheme funciona sin coordinación con DNS. Los App/Universal Links requieren `assetlinks.json` y `apple-app-site-association` servidos desde `kengoapp.com`. Pendiente operacional. |
| Variables de entorno | `environment.native.ts` activado por configuration `native` en `project.json` (`fileReplacements`) | Permite distinguir builds web vs native en build-time sin detección runtime para cosas conocidas (p. ej. `IS_NATIVE_BUILD: true`). |
| Casos de Stripe en backend | Argumento explícito `returnTo: 'native' \| 'web'` en las Convex actions | Las Convex actions no acceden a los headers de la petición original; pasarlo desde el cliente es más fiable que detectar `User-Agent`. |

---

## 3. Lo implementado, archivo por archivo

### 3.1 Bootstrap de Capacitor

| Archivo | Cambio | Por qué |
|---|---|---|
| `apps/app/capacitor.config.ts` | **Nuevo**. Config con `appId`, `webDir`, `server.hostname`, plugins SplashScreen y Keyboard. | Punto de entrada de Capacitor. `launchAutoHide: false` deja que `AppComponent` controle el hide del splash (evita flash blanco). |
| `apps/app/project.json` | Nueva `configuration: native` con `fileReplacements` apuntando a `environment.native.ts`. **Sin** `serviceWorker:` para que ngsw no se genere en native. | Diferencia el build native del web sin tocar runtime. |
| `apps/app/src/environments/environment.native.ts` | **Nuevo**. Mismo shape que `environment.prod.ts` + `IS_NATIVE_BUILD: true`. | Permite feature flags conocidos en build (`IS_NATIVE_BUILD: false` también añadido a `environment.ts` y `environment.prod.ts` por consistencia). |
| `package.json` (raíz) | Scripts: `build:native`, `cap:sync`, `cap:sync:ios`, `cap:sync:android`, `cap:open:ios`, `cap:open:android`, `cap:run:ios`, `cap:run:android`. | Flujo de desarrollo y CI desde raíz, encapsulando el `cd apps/app` necesario para que `npx cap` lea el config correcto. |
| `.gitignore` | Excluye `apps/app/{ios,android}/.../public/` y `capacitor.config.json` generados | Son artefactos de `cap sync`, no fuente. |

### 3.2 Plataformas nativas

- **`apps/app/ios/`** generado por `npx cap add ios` — usa **Swift Package Manager** (default Capacitor 8, no CocoaPods).
- **`apps/app/android/`** generado por `npx cap add android` — Gradle 8.13.0 + Kotlin 2.2.20, minSdk 24, target/compile SDK 36.
- **iconos y splash de stock** generados por Capacitor — sustituirlos antes de publicar (ver §6 acciones manuales).

### 3.3 Adapters de plataforma (web ↔ Capacitor)

Centralizan en `apps/app/src/app/core/services/`:

| Servicio | Reemplaza a | Web fallback | Native |
|---|---|---|---|
| `PlatformService` | — | `'web'` | `Capacitor.getPlatform()` |
| `HapticsService` | `navigator.vibrate(...)` | `navigator.vibrate` con patrones | `@capacitor/haptics` (Taptic Engine iOS, vibrator Android) |
| `ClipboardService` | `navigator.clipboard.writeText` | `navigator.clipboard` | `@capacitor/clipboard` |
| `ExternalBrowserService` | `window.location.href = ...`, `window.open(...)` | `window.location.href` / `window.open` | `@capacitor/browser` con `presentationStyle: 'popover'` |
| `ShareService` | `navigator.share(...)` | Web Share API | `@capacitor/share` |

**Por qué centralizamos**: cada call site del codebase (10+ ubicaciones identificadas) usaba una API DOM diferente; el branching web vs native estaba destinado a duplicarse en cada componente. Inyectar un service uniforme con métodos semánticos (`heavy()`, `timerEnd()`, `restEnd()` en Haptics) evita esa duplicación.

**Call sites refactorizados:**
- `ejercicio-activo.component.ts:103` y `descanso.component.ts:63` → `HapticsService.timerEnd()` / `restEnd()`
- 6 sitios con `navigator.clipboard.writeText` → `ClipboardService.write()`
- `subscription.service.ts:89,103` (Stripe redirects) → `ExternalBrowserService.redirect()`
- `dialogo-pdf.component.ts:90` (`window.open(blobUrl)` para PDF mobile) → `ExternalBrowserService.open()`
- `quick-actions.component.ts` y `actividad-estadisticas.component.ts` (que combinaban `navigator.share` con fallback a clipboard) → `ShareService` + `ClipboardService`

### 3.4 Reemplazo de `window.confirm` por `DialogService.confirm()`

`window.confirm()` no funciona de forma fiable en WKWebView (puede no renderizarse o bloquear el thread principal).

**Cambios**:
- `apps/app/src/app/shared/services/dialog/dialog.service.ts` — nuevo método `confirm(data: ConfirmDialogData): Promise<boolean>` que envuelve el componente `ConfirmDialogComponent` (ya existente en el catálogo legacy).
- `apps/app/src/app/features/planes/guards/unsaved-changes.guard.ts` y `apps/app/src/app/features/rutinas/guards/rutina-unsaved-changes.guard.ts` — usan ahora `DialogService.confirm({ confirmVariant: 'danger' })` en lugar de `window.confirm(...)`.

### 3.5 Image upload nativo (cámara + galería)

`apps/app/src/app/shared/ui/image-upload/image-upload.component.ts` — el método `openFilePicker()` ahora ramifica:
- **Web**: dispara el `<input type="file">` existente (sin cambios).
- **Native**: invoca `Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.DataUrl })`. El usuario elige entre galería y cámara desde un prompt nativo. El data URL devuelto se convierte en `File` con un helper local (`dataUrlToFile`) y entra al cropper como cualquier otra imagen.

**Permisos iOS** (en `apps/app/ios/App/App/Info.plist`):
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`

(Android no requiere texto explícito; el plugin usa `READ_MEDIA_IMAGES` en API 33+.)

### 3.6 Auth en WebView

**Problema clave**: WKWebView (iOS) trata las cookies de dominios externos como "third party" y las puede bloquear o purgar. Además, iOS WebView purga periódicamente `localStorage`.

**Por qué seguimos viables sin reescribir auth**: `@convex-dev/better-auth` usa el plugin `crossDomainClient`, que ya guarda la sesión en `localStorage` (claves `better-auth_cookie` y `better-auth_session_data`) y la envía como header `Better-Auth-Cookie`. **No depende de cookies HTTP del navegador.** Esto neutraliza el problema de third-party cookies.

**Mitigación de purga de localStorage en iOS** — `apps/app/src/app/core/auth/services/better-auth.service.ts`:
- `backupToNative()`: tras `signIn`, `signUpAndSignIn` y `verifyMagicLink` exitoso, copia los dos valores de localStorage a `@capacitor/preferences` (claves `ba_cookie` y `ba_session_data`).
- `restoreFromNative()`: en el bootstrap (llamado desde `AuthService.iniciarApp()`), si estamos en native y `localStorage` está vacío, restaura los valores desde `@capacitor/preferences` antes de cualquier llamada a Convex/Better-Auth.
- `clearNativeBackup()`: en `signOut`, limpia las entradas en `@capacitor/preferences`.

Las claves de `@capacitor/preferences` (`ba_cookie`, `ba_session_data`) se eligieron para no chocar con las que usa internamente el plugin de Better-Auth (`better-auth_*`).

**CORS en `convex/http.ts`** — añadidos a `ALLOWED_ORIGINS`:
- `https://app.kengoapp.local` (origin del WebView definido en `capacitor.config.ts`)
- `capacitor://localhost` y `https://localhost` (esquemas por defecto cuando no se sobreescribe `hostname`)

### 3.7 Deep links

**Esquemas configurados** en `apps/app/src/app/app.component.ts` mediante `CapacitorApp.addListener('appUrlOpen', ...)` envuelto en `NgZone.run()` (importante: los listeners de Capacitor corren fuera de Angular zone y sin `NgZone.run` la navegación no dispara CD).

**Tipos de deep link soportados**:
- `kengo://magic?t=...` (futuro consumo de access tokens si se distribuyen QR)
- `kengo://billing/return?status=success|cancel|portal` (retorno desde Stripe — ver §3.9)
- `https://kengoapp.com/...` (Universal Links iOS / Android App Links — pendiente `.well-known`)

**Custom scheme `kengo://`**:
- iOS: `CFBundleURLTypes` en `apps/app/ios/App/App/Info.plist` con `CFBundleURLSchemes: [kengo]`.
- Android: `<intent-filter>` con `<data android:scheme="kengo" />` en `apps/app/android/app/src/main/AndroidManifest.xml`.

**Android App Links** (verificación automática del dominio):
- Otro `<intent-filter android:autoVerify="true">` para `https://kengoapp.com` y `https://www.kengoapp.com`.
- **Requiere** que `https://kengoapp.com/.well-known/assetlinks.json` exista (ver §6).

**iOS Universal Links** — pendiente. Requiere `apple-app-site-association` y la entitlement `com.apple.developer.associated-domains`.

### 3.8 Splash screen y status bar

En `AppComponent`:
- **Splash**: `SplashScreen.hide({ fadeOutDuration: 200 })` se llama dentro de un `effect()` que reacciona a `sessionService.sesionInicializada()`. Esto evita el flash blanco mientras Better-Auth restaura la sesión y Convex carga el usuario.
- **Status bar**: `StatusBar.setStyle({ style: Style.Default })` al arrancar.
- En `capacitor.config.ts`: `SplashScreen.launchAutoHide: false` para que el control quede en código TS, y `Keyboard.resize: 'body'` para que el teclado virtual no tape los inputs.

### 3.9 Stripe Checkout/Portal con retorno deep link

**Problema**: Stripe rechaza esquemas custom (`kengo://...`) en `success_url` y `cancel_url` — solo acepta HTTPS. En native abrimos la URL en `SFSafariViewController` / Custom Tab vía `@capacitor/browser`; tras pagar, Stripe redirige al `success_url` que carga la SPA web *dentro del in-app browser*, pero el usuario sigue **fuera** de la app Capacitor.

**Solución**: interstitial HTTPS que dispara el deep link.

**Backend** — `convex/billing/actions.ts`:
- `createCheckoutSession` y `createCustomerPortalSession` aceptan arg opcional `returnTo: 'native' | 'web'`.
- En native las URLs apuntan a `${KENGO_APP_URL}/billing-return.html?status=success|cancel|portal`.
- En web mantienen `${KENGO_APP_URL}/mi-clinica/suscripcion?ok=1|cancel=1` (sin cambios en UX existente).

**Frontend** — `apps/app/src/app/core/billing/subscription.service.ts`:
- Inyecta `PlatformService` y un getter `returnTo` que resuelve a `'native'` o `'web'`.
- `iniciarCheckout` y `abrirPortal` pasan el flag al action.

**Interstitial estático** — `apps/app/public/billing-return.html`:
- HTML mínimo (cream + spinner coral, sin Angular) que copia `apps/app/project.json` al output.
- JS lee `?status=...` y hace `location.replace('kengo://billing/return?status=...')`.
- iOS/Android, al ver el scheme registrado, ofrecen "¿Abrir en Kengo?" — al aceptar, cierran el SFSafariViewController/Custom Tab y entregan la URL al listener `appUrlOpen`.

**Procesamiento del retorno** — `AppComponent.appUrlOpen`:
- Si la ruta empieza por `/billing/return`: cierra el `@capacitor/browser`, lee `status` del query string, dispara `toast.success('¡Suscripción activada!')` o `toast.info('Has cancelado el pago.')`, y navega a `/mi-clinica/suscripcion`.
- **No navega** a la URL real `/billing/return` (no es una ruta Angular, solo un canal de señal).
- El `watchQuery` de `SubscriptionService` recoge el cambio cuando el webhook de Stripe lo propague (delay típico 1-3 s) — sin polling adicional.

### 3.10 Viewport y safe-area

- `apps/app/src/index.html`: viewport pasa a `viewport-fit=cover, user-scalable=no`; `apple-mobile-web-app-status-bar-style` cambia a `black-translucent`.
- `apps/app/src/styles.css`:
  - Variables `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` con `env(safe-area-inset-*, 0px)`.
  - Utilidades `.pt-safe`, `.pb-safe`, `.pl-safe`, `.pr-safe`, `.px-safe`, `.py-safe`, `.mt-safe`, `.mb-safe`, `.h-safe-top`, `.h-safe-bottom`.
- En web son 0 (sin efecto). En Capacitor con notch/Dynamic Island toman valor real.
- **Aplicar manualmente** en headers fijos / tab bars / botones flotantes según el rediseño visual avance (no se hizo en esta sesión).

---

## 4. Plugins instalados

| Plugin | Versión | Propósito |
|---|---|---|
| `@capacitor/core` | ^8.3.1 | Runtime |
| `@capacitor/cli` (dev) | ^8.3.1 | CLI |
| `@capacitor/ios` | ^8.3.1 | Plataforma iOS (SPM) |
| `@capacitor/android` | ^8.3.1 | Plataforma Android |
| `@capacitor/app` | ^8.1.0 | `appUrlOpen`, lifecycle |
| `@capacitor/preferences` | ^8.0.1 | Backup de sesión Better-Auth |
| `@capacitor/haptics` | ^8.0.2 | Taptic Engine / vibrator |
| `@capacitor/clipboard` | ^8.0.1 | Portapapeles |
| `@capacitor/browser` | ^8.0.3 | Stripe in-app browser, PDFs, links |
| `@capacitor/status-bar` | ^8.0.2 | Status bar style |
| `@capacitor/splash-screen` | ^8.0.1 | Splash gestionado manual |
| `@capacitor/keyboard` | ^8.0.3 | Resize on input focus |
| `@capacitor/share` | ^8.0.1 | UX de compartir nativo |
| `@capacitor/network` | ^8.0.1 | Detectar offline (banner futuro) |
| `@capacitor/camera` | ^8.2.0 | Galería + cámara para image-upload |
| `@capacitor/filesystem` | ^8.1.2 | Cache offline futuro |

**Total: 12 plugins** (+ runtime/CLI/plataformas).

---

## 5. Cómo probar la integración

### 5.1 Compilación

```bash
# Build native (sin SW, con environment.native.ts)
npm run build:native

# Build web producción (con SW, sin cambios)
nx build app --configuration production
```

### 5.2 Ejecutar en simulador / emulador

```bash
# iOS — requiere Xcode 26+ instalado y un simulador disponible
npm run cap:run:ios

# Android — requiere Android Studio Otter 2025.2.1+ y un emulador arrancado
npm run cap:run:android

# Solo abrir el proyecto en Xcode / Android Studio
npm run cap:open:ios
npm run cap:open:android
```

### 5.3 Sync tras cambios en Angular

```bash
# Rebuild + copia los assets web a las plataformas nativas
npm run cap:sync           # ambas plataformas
npm run cap:sync:ios       # solo iOS
npm run cap:sync:android   # solo Android
```

### 5.4 Inspección del WebView

- **iOS**: Safari → menú Develop → Simulator → `localhost`.
- **Android**: Chrome → `chrome://inspect#devices`.

### 5.5 Test de deep links (sin pasar por Stripe)

```bash
# iOS Simulator
xcrun simctl openurl booted "kengo://magic?t=test123"
xcrun simctl openurl booted "kengo://billing/return?status=success"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "kengo://magic?t=test123"
adb shell am start -W -a android.intent.action.VIEW -d "kengo://billing/return?status=success"
```

### 5.6 Matriz de verificación end-to-end

| Caso | Web | iOS Sim | Android Emu |
|---|---|---|---|
| Login email/password + persistencia tras kill app | ok existente | crítico | crítico |
| Mensajes Convex realtime (WebSocket) | ok | ok | ok |
| Vibrar al terminar serie | `navigator.vibrate` | Taptic Engine (device) | vibrator |
| Copiar código clínica | clipboard web | nativo | nativo |
| Subir avatar (galería + cámara) | input file | `@capacitor/camera` | `@capacitor/camera` |
| Stripe checkout y vuelta a app | redirect web | Browser plugin + deep link return | idem |
| Service Worker registrado | sí (prod) | **no** (esperado) | **no** (esperado) |
| Safe-area visible (notch/Dynamic Island) | n/a | padding correcto si se aplica `.pt-safe` | navigation bar respeta |

---

## 6. Acciones manuales requeridas

Estas tareas **no son parte del código** y deben hacerse antes de publicar.

### 6.1 Variables de entorno (Convex)

Confirmar que `KENGO_APP_URL` está **sin slash final**:

```
KENGO_APP_URL=https://kengoapp.com
```

Si no, `${appUrl}/billing-return.html` queda malformado.

### 6.2 Despliegue del frontend web

El interstitial `billing-return.html` se sirve desde `https://kengoapp.com/billing-return.html` (estático servido por el Express delante de la SPA). **Necesita un deploy del frontend** (`apps/app`) a Railway antes de que el flujo Stripe en native funcione end-to-end.

```bash
npm run railway:build:frontend
# Railway hace deploy automático con railway.toml
```

### 6.3 Despliegue de Convex

Las nuevas args `returnTo` en `createCheckoutSession` y `createCustomerPortalSession` **necesitan deploy del backend Convex**:

```bash
npm run convex:deploy
```

Sin esto, el frontend en producción enviará `returnTo: 'native'` a una action que no lo conoce y Convex devolverá error de validación.

### 6.4 Universal Links iOS — `apple-app-site-association`

Servir desde `https://kengoapp.com/.well-known/apple-app-site-association` (Content-Type `application/json`, sin extensión `.json`):

```json
{
  "applinks": {
    "details": [
      {
        "appID": "TEAMID.com.kengoapp.app",
        "paths": ["*"]
      }
    ]
  }
}
```

Reemplazar `TEAMID` por el Apple Team ID.

**Estado del repo**: `App.entitlements` ya declara `com.apple.developer.associated-domains` con `applinks:kengoapp.com`, `applinks:www.kengoapp.com` y `webcredentials:kengoapp.com`. Falta la parte externa: (1) activar la capability *Associated Domains* en el App ID del portal de Apple Developer, y (2) publicar el AASA de arriba. Sin ambas, iOS ignora el entitlement en silencio.

`webcredentials:kengoapp.com` permite que iCloud Keychain ofrezca las credenciales del dominio web en la app. **Limitación conocida**: el WebView nativo sirve la app desde `https://app.kengoapp.local` (ver `capacitor.config.ts`), y el autofill de contraseñas dentro del WebView se asocia a ese dominio, no a `kengoapp.com`. Las credenciales guardadas en la web y en la app no se comparten entre sí. **No cambiar `server.hostname`** para "arreglarlo": cambiaría el origin de `localStorage` y todos los usuarios instalados perderían la sesión persistida, el user-cache y el theme-cache.

Hasta que el AASA exista, los deep links HTTPS (`https://kengoapp.com/magic?t=...`) **no abrirán la app** en iOS — degradan a navegación web normal. El custom scheme `kengo://` sigue funcionando.

### 6.5 Android App Links — `assetlinks.json`

Servir desde `https://kengoapp.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kengoapp.app",
      "sha256_cert_fingerprints": ["FINGERPRINT_DEL_KEYSTORE_DE_RELEASE"]
    }
  }
]
```

El SHA-256 se obtiene tras crear el keystore de release con `keytool`:

```bash
keytool -list -v -keystore release.keystore -alias kengo
```

El `<intent-filter android:autoVerify="true">` ya está en el manifest; sin el fichero servido, `autoVerify` falla silenciosamente y el OS trata el dominio como link normal.

### 6.6 Iconos y splash de marca

Los assets actuales son los placeholders de Capacitor. Para sustituirlos:

```bash
npm install --save-dev @capacitor/assets
# Colocar fuentes:
#   apps/app/assets/icon-only.png   (1024×1024)
#   apps/app/assets/splash.png      (2732×2732)
cd apps/app && npx capacitor-assets generate
```

Esto regenera todos los tamaños en `apps/app/ios/App/App/Assets.xcassets/` y `apps/app/android/app/src/main/res/`.

### 6.7 Firma y publicación

- **iOS**: necesita Apple Developer Account, certificate de distribución, provisioning profile, y subir a TestFlight. Recomendable Fastlane + `match`.
- **Android**: keystore propio (no el `debug.keystore`) y publicación en Play Console (track interno primero).

Estas tareas no se abordaron en esta sesión; viven en una fase posterior.

**Checklist pre-release** (verificar en cada publicación):

- [ ] `aps-environment`: el `App.entitlements` del repo dice `development` (correcto para debug). Al archivar para distribución, Xcode debe firmarlo con `production`. Verificar en el IPA: `codesign -d --entitlements - App.app`.
- [ ] **R8/minify Android**: `release.minifyEnabled = true` + `shrinkResources = true` ya están en `build.gradle`. Probar un build release **firmado** en dispositivo (push, deep links `kengo://`, cámara, share) antes de subir a Play — las consumer-proguard-rules de los plugins deberían cubrir todo, pero es la única forma de confirmarlo.
- [ ] **Source maps**: las configs `production` y `native` de `apps/app/project.json` llevan `"sourceMap": false` explícito. Comprobar que `dist/apps/app/browser` no contiene `*.js.map` tras el build de release (`find dist/apps/app/browser -name '*.js.map'` vacío). Si aparecen, el build se hizo con configuración `development`.
- [ ] **assetlinks.json** publicado y verificado: `adb shell pm get-app-links com.kengoapp.app`.
- [ ] **apple-app-site-association** publicado + capability *Associated Domains* activa en el App ID.

### 6.8 Prueba en simulador iOS — primera ejecución

La primera vez que se invoca un deep link `kengo://...` desde Safari/Chrome dentro del simulador, iOS muestra un confirm "¿Abrir en Kengo?". Es UX estándar; conviene mencionarlo en la documentación de QA.

---

## 7. Riesgos conocidos

1. **Cookies Better-Auth en WKWebView**: mitigado por `crossDomainClient` (header en lugar de cookie). Si el plan plugin cambia internamente sus claves de localStorage (`better-auth_cookie`, `better-auth_session_data`), el backup en Preferences se desincroniza. **Plan B**: mover las llamadas `/api/auth/*` a `CapacitorHttp` (bridge nativo) — invasivo, no abordar a menos que sea necesario.

2. **Rechazo de Apple por Stripe externo**: la política post Epic v. Apple (mayo 2025) permite enlaces externos en US. Riesgo de rechazo en otras regiones. **Plan B**: lanzar primero en US; si rechazo global, integrar IAP wrapper (`@capacitor-community/stripe` o RevenueCat).

3. **`appId` mal elegido**: fijado a `com.kengoapp.app`. Cambiarlo después implica re-publicar como app nueva. **Decisión final.**

4. **Universal Links sin `.well-known`**: los magic links HTTPS no abrirán la app hasta que se publiquen `apple-app-site-association` y `assetlinks.json`. Mitigado por el custom scheme `kengo://` como fallback en emails y QR.

5. **Service Worker conflict**: mitigado deshabilitando vía `Capacitor.isNativePlatform()` antes de registrar. Si en el futuro se añade un `provideServiceWorker` adicional, repetir la guarda.

6. **Bundle size**: el initial chunk supera el budget de 700 KB (warning de 137 kB). Aceptable en mobile primer arranque, pero vale la pena revisar TTI en device físico (no simulador) cuando se publique.

7. **Delay de 1-3 s tras volver de Stripe**: el `watchQuery` de Convex se actualiza cuando el webhook propaga la mutación. Si la UX es disruptiva, escalar a polling explícito en `SubscriptionService.refresh()`.

---

## 8. Pendientes futuros (fuera del MVP)

- **Push notifications** (FCM + APNs) — requiere certificados, server actions en Convex y `@capacitor/push-notifications`.
- **Local notifications** (recordatorios de plan al paciente) — `@capacitor/local-notifications`.
- **Live updates OTA** (Capgo open source o Ionic AppFlow) — permite parches de bundle JS/CSS sin pasar revisión App Store.
- **Modo offline real** — cache de Convex queries + cola de mutations cuando no hay red.
- **Pull to refresh** en pantallas list (`mensajes`, `actividad-personal`).
- **Theme color dinámico en Android** — sincronizar `StatusBar.setBackgroundColor()` con el `ThemeService` (white-labeling por clínica).
- **CI/CD completo** — Fastlane + GitHub Actions para builds firmadas en TestFlight y Play Store internal track.
- **Stripe IAP wrapper** — solo si Apple rechaza la app; sustituye o complementa el flujo actual.

---

## 9. Estructura de archivos resultante

```
apps/app/
├── capacitor.config.ts                      # Config Capacitor
├── ios/                                     # Proyecto Xcode (SPM)
│   └── App/App/
│       ├── Info.plist                       # Permisos cámara/galería + CFBundleURLTypes
│       ├── AppDelegate.swift
│       └── public/                          # (gitignored) assets web sincronizados
├── android/                                 # Proyecto Gradle
│   └── app/
│       ├── build.gradle
│       └── src/main/
│           ├── AndroidManifest.xml          # intent-filters: kengo:// + App Links
│           └── assets/public/               # (gitignored) assets web sincronizados
├── public/
│   └── billing-return.html                  # Interstitial Stripe → kengo://
├── project.json                             # Configuration `native`
├── src/
│   ├── environments/
│   │   ├── environment.ts                   # IS_NATIVE_BUILD: false
│   │   ├── environment.prod.ts              # IS_NATIVE_BUILD: false
│   │   └── environment.native.ts            # IS_NATIVE_BUILD: true (nuevo)
│   ├── index.html                           # viewport-fit=cover, status bar translucent
│   ├── styles.css                           # vars --safe-* + utilidades .pt-safe etc.
│   └── app/
│       ├── app.component.ts                 # Listener appUrlOpen, splash, status bar
│       ├── app.config.ts                    # SW condicional
│       └── core/
│           ├── auth/services/
│           │   ├── auth.service.ts          # iniciarApp() → restoreFromNative()
│           │   └── better-auth.service.ts   # backup/restore en Preferences
│           ├── billing/
│           │   └── subscription.service.ts  # returnTo en checkout/portal
│           └── services/                    # Adapters (nuevos)
│               ├── platform.service.ts
│               ├── haptics.service.ts
│               ├── clipboard.service.ts
│               ├── external-browser.service.ts
│               └── share.service.ts
convex/
├── billing/actions.ts                       # arg returnTo
└── http.ts                                  # CORS añade orígenes WebView
```

---

## 10. Referencias

- [Capacitor Docs — Getting Started](https://capacitorjs.com/docs/getting-started)
- [Capacitor 8 Migration Guide](https://capacitorjs.com/docs/updating/8-0)
- [Capacitor Deep Links Guide](https://capacitorjs.com/docs/guides/deep-links)
- [Stripe — In-app Purchases on iOS and Android](https://docs.stripe.com/mobile/digital-goods)
- [`@convex-dev/better-auth` crossDomainClient source](https://github.com/get-convex/better-auth/blob/main/src/plugins/cross-domain/client.ts)
- Commit que implementa todo lo descrito: `614cdac feat(native): añadir soporte iOS/Android con Capacitor 8`
