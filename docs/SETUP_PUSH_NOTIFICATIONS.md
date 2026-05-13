# Setup manual de Push Notifications

Guía paso a paso para habilitar las notificaciones push iOS + Android en Kengo. El código (schema Convex, action FCM, plugin Capacitor, AppDelegate, Manifest, drawable, service Angular) ya está implementado — esta guía cubre **solo los pasos manuales** que requieren credenciales o consolas externas.

> **Stack**: `@capacitor-firebase/messaging` (cliente, FCM token unificado iOS/Android) + `google-auth-library` en una Convex action (server, FCM HTTP v1 con OAuth2 service account).

---

## Resumen de lo que necesitas

| # | Tarea | Tiempo | Coste |
|---|-------|--------|-------|
| 1 | Crear proyecto Firebase | 5 min | Gratis |
| 2 | Registrar app Android en Firebase | 3 min | Gratis |
| 3 | Registrar app iOS en Firebase | 3 min | Gratis |
| 4 | Apple Developer Account | — | **99 €/año** |
| 5 | Generar APNs Auth Key (.p8) | 5 min | Incluido |
| 6 | Subir APNs key a Firebase | 2 min | — |
| 7 | Descargar service account JSON | 2 min | — |
| 8 | Configurar `FCM_SERVICE_ACCOUNT` en Convex | 2 min | — |
| 9 | Colocar `google-services.json` (Android) | 1 min | — |
| 10 | Colocar `GoogleService-Info.plist` (iOS) | 2 min | — |
| 11 | Activar capabilities Push + Background en Xcode | 2 min | — |
| 12 | Sync nativo + build | 5 min | — |
| 13 | Smoke test en device físico | 10 min | — |

Total: ~40 min de trabajo manual + 99 € (Apple Developer).

---

## 1. Crear proyecto Firebase

1. Ir a https://console.firebase.google.com.
2. **Add project** → nombre: `kengo` (o `Kengo Prod`).
3. **Google Analytics**: opcional, puedes desactivarlo. No es necesario para FCM.
4. Espera a que se cree (~30 s).

> Si ya existe un proyecto Firebase para Kengo, sáltate este paso.

---

## 2. Registrar app Android en Firebase

1. En el proyecto Firebase → icono Android **🤖** en "Get started by adding Firebase to your app".
2. Campos:
   - **Android package name**: `com.kengoapp.app` (debe coincidir EXACTO con `applicationId` de `apps/app/android/app/build.gradle`).
   - **App nickname** (opcional): `Kengo Android` — solo cosmético.
   - **Debug signing certificate SHA-1** (opcional): **déjalo en blanco**. Solo lo necesitarías si activaras Google Sign-In.
3. **Register app** → te ofrece descargar `google-services.json`. **Descárgalo** y guárdalo en local; lo colocas en el paso 9.
4. Los siguientes pasos del wizard ("Add Firebase SDK", "Run your app to verify installation") **sáltalos** — el plugin Capawesome ya añade Firebase como dependencia transitiva.

---

## 3. Registrar app iOS en Firebase

1. En el proyecto Firebase → "Add app" → icono iOS **🍎**.
2. Campos:
   - **Apple bundle ID**: `com.kengoapp.app` (mismo que Android; coincide con `appId` de `capacitor.config.ts`).
   - **App nickname** (opcional): `Kengo iOS`.
   - **App Store ID** (opcional): **déjalo en blanco** hasta que publiques en App Store.
3. **Register app** → descarga `GoogleService-Info.plist`. Guárdalo en local; lo colocas en el paso 10.
4. Saltar los siguientes pasos del wizard.

---

## 4. Apple Developer Account

Si todavía no tienes cuenta:

1. https://developer.apple.com/programs/ → **Enroll** → 99 €/año.
2. Verificación por Apple: puede tardar 24–48 h en activarse si pagas con tarjeta nueva.
3. Anota tu **Team ID** (10 caracteres alfanuméricos): https://developer.apple.com/account → arriba a la derecha, junto a tu nombre.

> **Sin Apple Developer activo no puedes generar APNs key ni firmar builds en device real.** Es bloqueante para iOS pero NO para Android.

---

## 5. Generar APNs Auth Key (.p8)

1. https://developer.apple.com/account/resources/authkeys/list.
2. Botón **+** → "Register a New Key".
3. Campos:
   - **Key Name**: `Kengo APNs`.
   - **Key Services**: marcar **Apple Push Notifications service (APNs)**. Dejar los demás desactivados.
4. **Continue → Register → Download**. Te bajas un fichero `AuthKey_XXXXXXXXXX.p8`.
   - **IMPORTANTE: solo puedes descargarlo UNA vez.** Guárdalo en lugar seguro (1Password, equivalente).
5. Anota el **Key ID** (10 caracteres, lo ves en la lista de keys o en el nombre del fichero).

> Una sola .p8 key sirve para todas las apps del team. Si en el futuro lanzas más apps Kengo (admin, etc.), reutiliza la misma.

---

## 6. Subir APNs key a Firebase

1. Firebase Console → ⚙️ **Project settings** → pestaña **Cloud Messaging**.
2. Sección "Apple app configuration" → tu app iOS → **Upload** en "APNs Authentication Key".
3. Campos:
   - **APNs auth key**: el fichero `.p8` que descargaste.
   - **Key ID**: el que anotaste en el paso 5.
   - **Team ID**: el que anotaste en el paso 4.
4. **Upload**.

> A partir de aquí Firebase puede enviar a APNs en tu nombre cuando llamamos FCM HTTP v1 con un `token` iOS.

---

## 7. Descargar service account JSON

Este es el JSON que firma los JWT que Convex enviará a FCM.

1. Firebase Console → ⚙️ **Project settings** → pestaña **Service accounts**.
2. Botón **Generate new private key** → confirmar.
3. Descarga un JSON tipo `kengo-firebase-adminsdk-XXXXX.json`.
4. Ábrelo y comprueba que tiene los campos `client_email`, `private_key`, `project_id`.

> **NO uses el flujo de "OAuth Consent Screen" de Google Cloud Console.** Para FCM server-to-server con service account NO necesitas verificación de Google, ni rellenar "Información adicional", ni nada. Si Firebase te ha redirigido a esa pantalla, cierra la pestaña y vuelve a Project Settings → Service Accounts.

---

## 8. Configurar `FCM_SERVICE_ACCOUNT` en Convex

**No uses `npx convex env set`** — está roto con valores multilínea ([issue #128](https://github.com/get-convex/convex-backend/issues/128)). Hazlo desde el Dashboard:

1. https://dashboard.convex.dev → tu proyecto Kengo.
2. **Settings** → **Environment Variables**.
3. **Add variable**:
   - Name: `FCM_SERVICE_ACCOUNT`
   - Value: **el JSON entero, minificado en una sola línea**. Truco rápido:
     ```bash
     cat kengo-firebase-adminsdk-XXXXX.json | jq -c .
     ```
     o desde Node:
     ```bash
     node -e "console.log(JSON.stringify(require('./kengo-firebase-adminsdk-XXXXX.json')))"
     ```
4. Save.

**Verificar que se ha guardado bien:**

En el Dashboard → Functions → busca `push:actions:sendPushToUser`, lánzala con argumentos `{ "userId": "<un userId real>", "title": "test", "body": "hola" }`. Si los logs muestran `[Push] FCM_SERVICE_ACCOUNT no configurada` significa que no llegó; si muestran `[Push] No se pudo obtener access token` el JSON está mal formado.

---

## 9. Colocar `google-services.json` (Android)

```bash
cp ~/Descargas/google-services.json /Users/carloscabrera/Documents/Proyectos/kengo/apps/app/android/app/google-services.json
```

`apps/app/android/app/build.gradle` ya tiene el apply condicional (`if (servicesJSON.text) { apply plugin: 'com.google.gms.google-services' }`), así que basta con dejar el fichero ahí.

> **No lo commitees a git si el repo es público.** Para Kengo (privado) está bien, pero recuerda añadirlo a `.gitignore` si decides hacer el repo público.

---

## 10. Colocar `GoogleService-Info.plist` (iOS)

No basta con copiarlo a la carpeta — tiene que estar **añadido al target** en Xcode:

1. Abre Xcode: `npm run cap:open:ios`.
2. En el navigator izquierdo → arrastra `GoogleService-Info.plist` dentro del grupo **App** (mismo nivel que `Info.plist`).
3. En el diálogo que aparece:
   - **Copy items if needed**: ✅ marcado.
   - **Added to targets**: ✅ **App** marcado.
4. Confirma. Verás el fichero en el navigator y, si seleccionas el target App → Build Phases → Copy Bundle Resources, debe aparecer ahí.

---

## 11. Activar capabilities en Xcode

Sin estas dos capabilities el plugin no registra y no llega ninguna notificación.

1. Xcode → target **App** → pestaña **Signing & Capabilities**.
2. Botón **+ Capability** (arriba a la izquierda):
   - Buscar y añadir **Push Notifications**.
   - Buscar y añadir **Background Modes** → dentro del bloque que aparece, marca el checkbox **Remote notifications**.
3. **Signing**: asegúrate de que el team está seleccionado (el de tu Apple Developer Account del paso 4) y que el "Bundle Identifier" sigue siendo `com.kengoapp.app`. Xcode debe poder firmar para device.

Resultado: la pestaña debe mostrar dos secciones — "Push Notifications" (sin opciones) y "Background Modes" con "Remote notifications" marcado.

---

## 12. Sync nativo + build

Cada vez que cambies `capacitor.config.ts`, `AppDelegate.swift`, gradle files o plugins:

```bash
npm run cap:sync
```

Luego, para probar:

```bash
npm run cap:open:ios       # → Xcode → Run en device físico (simulador iOS NO recibe APNs)
npm run cap:open:android   # → Android Studio → Run en device físico o emulador con Google Play
```

> El simulador de iOS no soporta APNs en absoluto. Para probar iOS necesitas device físico conectado por USB.

---

## 13. Smoke test end-to-end

### A. Verificar registro de token

1. Loguéate como un paciente real en la app instalada en device físico.
2. iOS te pedirá permiso para notificaciones — acepta.
3. Convex Dashboard → tabla `pushTokens` → debes ver una fila nueva con tu `userId`, `platform`, `token` y `deviceId`.

Si no aparece: revisa los logs de la app (Xcode console o `adb logcat`) buscando `[Push]` o errores de `FirebaseMessaging`.

### B. Verificar envío manual

1. Convex Dashboard → Functions → `push:actions:sendPushToUser`.
2. Run con args:
   ```json
   {
     "userId": "<el _id del paciente que registró el token>",
     "title": "Test",
     "body": "Si ves esto, FCM funciona 🎉"
   }
   ```
3. La notificación debe llegar al device en <5 s.

### C. Verificar el caso del chat

1. Device A: logueado como fisio.
2. Device B: logueado como el paciente del fisio, app en **background** (botón home, no killed).
3. Fisio envía un mensaje desde A.
4. Paciente en B recibe banner con el nombre del fisio como título.
5. Tap sobre el banner → la app se abre en `/mensajes/<conversationId>`.

### D. Verificar el recordatorio diario

1. Para no esperar a las 17:00 UTC, en Dashboard → Functions → ejecutar manualmente `push:crons:sendDailyPatientReminders` con `{}`.
2. Logs deben mostrar `[Push] Recordatorios diarios para N pacientes (YYYY-MM-DD)`.
3. Pacientes con plan activo cuyo `dailyPatientRollup` del día NO esté `completado`/`descanso` reciben la notificación.

### E. Verificar cleanup de tokens stale

1. Desinstala la app del device.
2. Vuelve a ejecutar `sendPushToUser` con el mismo `userId`.
3. Logs Convex muestran `[Push] FCM 404 ... (stale, borrando)` y la fila desaparece de `pushTokens`.

---

## Gotchas conocidos

- **APNs .p8 y el "Send test message" de Firebase Console**: desde 2024 Firebase ha desactivado el botón "Send test message" cuando subes una .p8 (en lugar de un certificado). Para tests usa el flujo del paso 13.B desde el Dashboard de Convex; el botón del Firebase Console no es indicativo.
- **iOS 18+ y permiso de notificaciones**: el prompt sigue siendo estándar. Si el usuario lo deniega, la única forma de revertirlo es Ajustes del sistema → Kengo → Notificaciones.
- **Android 13+ (API 33+)**: ya requiere permiso runtime `POST_NOTIFICATIONS` (ya añadido en `AndroidManifest.xml`). El plugin Capawesome lo pide cuando llamas `requestPermissions()`.
- **Token rota tras 270 días sin abrir app** (FCM): el listener `tokenReceived` lo re-registra automáticamente cuando el usuario vuelve a abrir.
- **Foreground iOS**: `presentationOptions: ['alert', 'badge', 'sound']` ya está en `capacitor.config.ts` para que se muestre banner también con app abierta.
- **Foreground Android**: por defecto NO muestra banner si la app está en foreground. Para el chat eso es deseable (la UI ya está actualizándose). Si en el futuro quieres mostrar un toast in-app, engancha en el listener `notificationReceived` del `PushNotificationService`.
- **Service account multi-entorno**: si tienes `dev` y `prod` en Convex, repite el paso 8 en ambos deployments con el mismo JSON (o uno distinto si quieres aislar dev y prod en proyectos Firebase separados — recomendado).
- **Cambiar el `applicationId` después**: si en el futuro cambias el bundle ID en `capacitor.config.ts`, tienes que repetir los pasos 2 y 3 (re-registrar app en Firebase) y bajar `google-services.json` / `GoogleService-Info.plist` nuevos.

---

## Ficheros relevantes en el repo (referencia)

**Backend Convex:**
- `convex/schema.ts` — tabla `pushTokens`
- `convex/push/queries.ts` — `getTokensForUser`, `getReminderCandidates`
- `convex/push/mutations.ts` — `registerPushToken`, `unregisterPushToken`, `deletePushTokenById`
- `convex/push/actions.ts` — `sendPushToUser` (FCM HTTP v1)
- `convex/push/crons.ts` — `sendDailyPatientReminders`
- `convex/crons.ts` — entrada `daily-patient-reminder` a las 17:00 UTC
- `convex/conversations/mutations.ts:166-177` — disparo de push en `sendMessage`

**Frontend Angular + nativo:**
- `apps/app/capacitor.config.ts` — bloque `FirebaseMessaging.presentationOptions`
- `apps/app/ios/App/App/AppDelegate.swift` — métodos `didRegister*` / `didReceiveRemoteNotification`
- `apps/app/android/app/src/main/AndroidManifest.xml` — meta-data icono + permiso `POST_NOTIFICATIONS`
- `apps/app/android/app/src/main/res/drawable/ic_notification.xml` — icono blanco monocromo
- `apps/app/src/app/core/services/push-notification.service.ts` — servicio Angular
- `apps/app/src/app/app.component.ts` — effect que llama `init()`
- `apps/app/src/app/core/auth/services/auth.service.ts` — `teardown()` en logout

**Env vars Convex:**
- `FCM_SERVICE_ACCOUNT` — JSON del service account, minificado en una línea
