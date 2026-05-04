# TODO — Desarrollos pendientes de Capacitor

Lista accionable de lo que queda por hacer para completar la implementación de la app nativa iOS/Android. Pensada para retomar en planes de desarrollo posteriores.

> **Contexto**: el commit `614cdac feat(native): añadir soporte iOS/Android con Capacitor 8` cubre el MVP funcional (Fases 0–4 del plan original + retorno Stripe). Este documento recoge todo lo que **no** está incluido en ese commit.
>
> **Para detalles técnicos** de lo ya implementado, ver `CAPACITOR_NATIVE_APP.md`.

---

## A. Desarrollo dentro del plan MVP (Fase 5 — pulido visual nativo)

Trabajo de código pendiente para que la app se sienta nativa, no como web embebida. Bajo riesgo (solo CSS/UI), alto impacto visual.

- [ ] **A1. Aplicar utilidades `safe-area` en componentes fijos**
  Las clases `.pt-safe`, `.pb-safe`, `.px-safe`, etc. existen en `apps/app/src/styles.css` pero ningún componente las consume. En device físico con notch/Dynamic Island (iPhone 14+) o navigation bar gestual (Android), el contenido queda tapado.
  **Áreas a tocar**:
  - `apps/app/src/app/shared/ui-v2/Ui2PatientHeaderComponent`
  - `apps/app/src/app/shared/ui-v2/Ui2PatientTabBarComponent`
  - `apps/app/src/app/shared/ui-v2/Ui2WebTopbarComponent`
  - CTA bars (`Ui2CtaBarComponent` y consumos)
  - FABs y botones flotantes
  - Pantalla `mi-plan` (sesión activa fullscreen)

- [ ] **A2. Status bar dinámica según ruta y tema**
  Hoy se fija una sola vez con `Style.Default` en `AppComponent.configurarPlataformaNativa()`. Falta:
  - Login/registro/magic: `Style.Light` (fondo claro, texto oscuro).
  - App principal coral: `Style.Default`.
  - Pantalla `realizar-plan` (fondo oscuro): `Style.Dark` (texto claro).
  Sincronizar también con `ThemeService` (white-labeling por clínica).

- [ ] **A3. Theme color en Android al cambiar de clínica**
  `StatusBar.setBackgroundColor({ color })` debe llamarse cuando `ThemeService` cambie el primario para que la barra de sistema acompañe al color de la clínica activa.
  **Áreas a tocar**: `apps/app/src/app/core/theme/theme.service.ts` debe exponer un `effect` que en native invoque `StatusBar.setBackgroundColor(this.primaryColor())`.

- [ ] **A4. Banner offline con `@capacitor/network`**
  El plugin está instalado pero no hay listener ni componente. Diseñar un `Ui2OfflineBannerComponent` que escuche `Network.addListener('networkStatusChange', ...)` y muestre un banner persistente cuando `connected=false`.

- [ ] **A5. Pull-to-refresh en `mensajes` y `actividad-personal`**
  Patrón nativo esperado en mobile. Opciones:
  - Componente custom (más control, sin dependencias nuevas).
  - `@ionic/angular` (asume coste de instalar todo Ionic solo para esto — descartar).
  - Buscar comunidad pequeña tipo `@capacitor-community/pull-to-refresh` (verificar mantenimiento).

- [ ] **A6. Verificar conflicto de edge swipe back iOS con `onSwipe` del `ejercicio-activo`**
  iOS tiene gesto nativo de "swipe-back desde el borde" en WKWebView. El componente `ejercicio-activo.component.ts` define un `onSwipe` con `SwipeGesturesDirective`. Probar en device físico iOS y, si hay conflicto, deshabilitar el gesto nativo en esa ruta concreta vía `webView.allowsBackForwardNavigationGestures = false` (requiere bridge nativo o configuración Info.plist).

- [ ] **A7. Iconos y splash propios con `@capacitor/assets`**
  Los assets actuales son los placeholders de Capacitor. Pasos:
  ```bash
  npm install --save-dev @capacitor/assets
  # Colocar fuentes vectoriales/PNG:
  #   apps/app/assets/icon-only.png   (1024×1024)
  #   apps/app/assets/splash.png      (2732×2732, fondo coral con logo centrado)
  cd apps/app && npx capacitor-assets generate
  ```
  Coordinar con diseño para tener los PNGs definitivos.

---

## B. Verificación funcional pendiente

Nada de lo implementado ha pisado un simulador/emulador real todavía. El código compila pero hasta no probarlo en runtime hay riesgos sin confirmar.

- [ ] **B1. Login + persistencia de sesión en simulador iOS**
  Flujo crítico (riesgo #1 del plan original). Pasos:
  1. `npm run cap:run:ios`
  2. Login con email/password
  3. Cerrar la app, reabrir → la sesión debe persistir
  4. Inspeccionar WebView desde Safari → Develop → Simulator → buscar errores CORS en consola
  **Si falla**: ejecutar plan B = mover llamadas `/api/auth/*` a `CapacitorHttp` (bridge nativo).

- [ ] **B2. Login + persistencia en emulador Android**
  Equivalente a B1 con `npm run cap:run:android` e inspección desde `chrome://inspect#devices`.

- [ ] **B3. Stripe end-to-end con tarjeta de prueba**
  1. Login como admin de clínica con suscripción no activa
  2. Ir a `/mi-clinica/suscripcion` → tocar "Iniciar suscripción"
  3. Tarjeta `4242 4242 4242 4242`
  4. Verificar que vuelve a la app vía deep link `kengo://billing/return?status=success`
  5. Verificar que el toast aparece y la suscripción se refresca (1-3 s después)
  6. Repetir con cancel: tocar atrás en checkout → toast info "Has cancelado el pago".

- [ ] **B4. Convex realtime (WebSocket) en WebView**
  Probar la pantalla `/mensajes`: enviar un mensaje desde otra sesión y verificar que aparece en tiempo real en la app nativa. Riesgo: WKWebView puede aplicar algún throttling a WS en background.

- [ ] **B5. Magic link — custom scheme**
  ```bash
  # iOS Simulator
  xcrun simctl openurl booted "kengo://magic?t=token-real-test"
  # Android Emulator
  adb shell am start -W -a android.intent.action.VIEW -d "kengo://magic?t=token-real-test"
  ```
  Verificar que la app abre en `/magic?t=...` y consume el token correctamente.

- [ ] **B6. Vibración real en device físico**
  Los simuladores iOS NO emiten haptic feedback. Probar `HapticsService.timerEnd()` y `restEnd()` en device físico (ejercicio activo, fin de descanso).

- [ ] **B7. Cámara y galería en image-upload**
  Probar subida de avatar desde galería y cámara en iOS y Android. Confirmar que los permisos se piden correctamente la primera vez.

---

## C. Operacional (no requiere código, pero sin esto no funciona en producción)

- [ ] **C1. `KENGO_APP_URL` en Convex sin slash final**
  Confirmar `KENGO_APP_URL=https://kengoapp.com` (no `https://kengoapp.com/`). Si no, `${appUrl}/billing-return.html` queda malformado.

- [ ] **C2. Deploy de Convex** (`npm run convex:deploy`)
  Necesario para que el backend de producción conozca el nuevo arg `returnTo` en `createCheckoutSession` y `createCustomerPortalSession`.

- [ ] **C3. Deploy del frontend (Railway)**
  Necesario para que `https://kengoapp.com/billing-return.html` esté servido y el flujo Stripe en native funcione.

- [ ] **C4. `apple-app-site-association` en `https://kengoapp.com/.well-known/`**
  Habilita Universal Links iOS. Requiere coordinación con quien hospeda el dominio (Railway frontend o redirect en Convex). Reemplazar `TEAMID` por el Apple Team ID real:
  ```json
  {
    "applinks": {
      "details": [
        { "appID": "TEAMID.com.kengoapp.app", "paths": ["*"] }
      ]
    }
  }
  ```
  Tras servirlo, añadir entitlement en Xcode → Signing & Capabilities → Associated Domains: `applinks:kengoapp.com`.

- [ ] **C5. `assetlinks.json` en `https://kengoapp.com/.well-known/`**
  Habilita Android App Links (`autoVerify=true`). Requiere SHA-256 del keystore release:
  ```bash
  keytool -list -v -keystore release.keystore -alias kengo
  ```
  ```json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kengoapp.app",
      "sha256_cert_fingerprints": ["FINGERPRINT_DEL_KEYSTORE"]
    }
  }]
  ```

- [ ] **C6. Apple Developer Account + certificate de distribución**
  Necesario para subir a TestFlight y luego App Store. Recomendable Fastlane + `match` para gestión.

- [ ] **C7. Keystore Android release (no `debug.keystore`)**
  Crear, custodiar, y registrar el SHA-256 en C5. Una vez generado, **no perderlo** — sin él no se pueden firmar updates.

---

## D. Mejoras futuras (fuera del MVP, evaluar caso a caso)

- [ ] **D1. Push notifications (FCM + APNs)**
  Plugin `@capacitor/push-notifications`. Requiere:
  - Apple Push Notifications certificate (APNs) o key.
  - Firebase Cloud Messaging service account.
  - Server actions en Convex para enviar push.
  - Lógica en cliente para registrar token y manejar tap.

- [ ] **D2. Local notifications (recordatorios de plan)**
  Plugin `@capacitor/local-notifications`. Permite recordar al paciente que hoy le toca sesión sin depender del servidor.

- [ ] **D3. Live updates OTA**
  Capgo (open source) o Ionic AppFlow. Permite parchear bundle JS/CSS sin pasar revisión App Store. Útil para hotfixes de bugs no nativos.

- [ ] **D4. Modo offline real**
  - Cache de Convex queries críticas (mi-plan, ejercicios) en `@capacitor/preferences` o `@capacitor/filesystem`.
  - Cola de mutations cuando no hay red, sync al reconectar.
  - Banner offline (relacionado con A4).

- [ ] **D5. CI/CD completo**
  - GitHub Actions con macos-latest runner para iOS (build + Fastlane → TestFlight).
  - GitHub Actions linux runner para Android (build firmado → Play Console internal track).
  - Versionado automático sincronizando `package.json`, `Info.plist` `CFBundleVersion`, y `build.gradle` `versionCode`.

- [ ] **D6. IAP wrapper (solo si Apple rechaza Stripe externo)**
  Plan B documentado en `CAPACITOR_NATIVE_APP.md` §7.2. Opciones:
  - `@capacitor-community/stripe` con Apple Pay / Google Pay.
  - RevenueCat (`@revenuecat/purchases-capacitor`) — más completo, gestión de subscripciones.
  Implica reescribir `SubscriptionService` y duplicar webhooks (Stripe web + IAP).

- [ ] **D7. Optimización de bundle initial**
  El initial chunk supera el budget de 700 KB (837 kB en native, 849 kB en web prod). Aceptable, pero conviene revisar TTI en device físico cuando se publique. Ya hay `OPTIMIZACION_BUNDLE.md` con análisis previo — revisitarlo desde la perspectiva mobile.

- [ ] **D8. App Tracking Transparency (iOS) si se añaden analytics**
  Plugin `@capacitor-community/app-tracking-transparency`. Solo necesario si se integra Firebase Analytics, Mixpanel, o similar. Apple exige el prompt antes de cualquier tracking.

---

## E. Planes B documentados (activar solo si surge el problema)

Estos no son TODOs activos, pero conviene tenerlos a mano si las verificaciones B detectan el problema correspondiente.

- [ ] **E1. Better-Auth → `CapacitorHttp`** — si la sesión no fluye en WebView (B1/B2 fallan), mover las llamadas `/api/auth/*` desde `fetch` browser al bridge nativo `CapacitorHttp`. Invasivo pero garantiza cookies/headers consistentes.

- [ ] **E2. Polling explícito de `SubscriptionService.refresh()`** — si tras volver de Stripe el delay del watchQuery (1-3 s) resulta disruptivo en B3, implementar refresh con timeout/reintentos en `subscription.service.ts`.

- [ ] **E3. Lanzar primero solo en US** — si Apple rechaza el flujo Stripe externo en otras regiones, restringir release inicial al store estadounidense (donde la política post Epic v. Apple lo permite explícitamente). Plan B largo: D6 (IAP wrapper).

---

## Resumen de prioridad sugerida

1. **Antes de cualquier otra cosa**: B1, B2, B3 (verificar que lo implementado funciona). Sin esto, A y D están construyendo sobre código no validado.
2. **Si B funciona**: A1 (safe-area) + A7 (iconos/splash) — visual mínimo para QA y screenshots.
3. **Pre-publicación**: C completo + A2/A3 (status bar pulida).
4. **Post-MVP**: D según prioridad de negocio.
