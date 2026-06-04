# Setup TestFlight — Kengo iOS

Guía operativa para llevar la app de Capacitor a TestFlight. El proyecto Xcode ya está generado, firmado en modo automático y configurado para Capacitor 8 con SPM; lo que queda es trabajo de cuenta Apple, App Store Connect y un par de retoques en `Info.plist` / entitlements.

> Pre-requisito imprescindible: **cuenta de pago en Apple Developer Program** ($99/año) activa en el equipo `LTZK7CBKWL` (el `DEVELOPMENT_TEAM` ya configurado en el proyecto). Sin esto, todo lo demás es inviable.

---

## 0. Estado actual de la app (auditoría rápida)

| Elemento | Valor actual | Estado para TestFlight |
|---|---|---|
| Bundle ID | `com.kengoapp.app` | ✅ listo |
| Apple Developer Team | `LTZK7CBKWL` | ✅ listo |
| Code Sign Style | `Automatic` | ✅ listo (Xcode gestiona certs y profiles) |
| iOS Deployment Target | `15.0` | ✅ válido (Apple exige iOS 12+; recomendado 13+) |
| `MARKETING_VERSION` | `1.0.0` | ✅ válido para primera build |
| `CURRENT_PROJECT_VERSION` | `1` | ⚠️ hay que incrementarlo en cada subida |
| `aps-environment` (entitlements) | `development` | ⚠️ debe ser `production` para archive/TestFlight |
| Push Notifications | AppDelegate cablea APNs ↔ Firebase | ✅ código listo. Falta APNs Auth Key + capability "Push Notifications" en Apple Developer |
| `ITSAppUsesNonExemptEncryption` | no declarado en `Info.plist` | ⚠️ Apple lo pregunta en cada build; declarar `NO` evita preguntas manuales |
| App Icon | un único asset 1024×1024 (`AppIcon-512@2x.png`) | ✅ válido con Xcode 14+ (single-size icon) |
| Launch Screen | `LaunchScreen.storyboard` | ✅ listo |
| Permisos en `Info.plist` | cámara + fotos (lectura/escritura) | ✅ con descripciones en español |
| URL scheme | `kengo://` (retorno Stripe) | ✅ listo |
| `GoogleService-Info.plist` | presente, bundle ID coincide | ✅ listo |
| Servicio Web (Convex / Firebase / R2) en producción | activo según `environment.native.ts` | ✅ listo |

**Lo único que toca el código** está en §3 (4 cambios pequeños). El resto es configuración fuera del repo: Apple Developer, App Store Connect, Firebase y Xcode Organizer.

---

## 1. Apple Developer Portal (developer.apple.com)

Hazlo logueado con la cuenta dueña del team `LTZK7CBKWL`.

### 1.1 Registrar el App ID

1. **Certificates, Identifiers & Profiles → Identifiers → +**.
2. Tipo: **App IDs → App**.
3. Description: `Kengo`. Bundle ID: **Explicit** = `com.kengoapp.app`.
4. **Capabilities** — marca al menos:
   - **Push Notifications** (obligatorio: el código ya las pide).
   - **Associated Domains** (opcional: solo si vais a configurar Universal Links en el futuro — hoy se usa el scheme `kengo://`, así que es opcional).
   - **Sign in with Apple** — solo si lo añades en el futuro.
5. Guarda.

### 1.2 Generar APNs Auth Key (.p8)

> Si ya la subiste a Firebase en `SETUP_PUSH_NOTIFICATIONS.md`, salta este punto. Verifica en Firebase Console → Project Settings → Cloud Messaging que aparezca la APNs key bajo la app iOS.

1. **Keys → + (Create a key)**.
2. Name: `Kengo APNs`. Marca solo **Apple Push Notifications service (APNs)**.
3. **Continue → Register → Download** el `.p8`. Solo se descarga una vez.
4. Anota el **Key ID** y el **Team ID** (`LTZK7CBKWL`).
5. Sube el `.p8` a **Firebase Console → Project Settings → Cloud Messaging → Apple app configuration → APNs Authentication Key → Upload**, indicando Key ID + Team ID.

### 1.3 Certificados y provisioning

Con **Automatic Signing** en Xcode no hay que tocar nada aquí — Xcode crea el certificado de distribución (`Apple Distribution`) y el provisioning profile App Store al primer Archive. Si fallase ("No profiles for 'com.kengoapp.app' were found"), abre **Xcode → Settings → Accounts → tu Apple ID → Manage Certificates** y deja que Xcode regenere el cert.

> Solo necesitas hacer Manual Signing si vas a usar Fastlane `match` o si trabajas en CI. Para una primera subida manual desde el Mac, deja `Automatic`.

---

## 2. App Store Connect (appstoreconnect.apple.com)

### 2.1 Crear el registro de la app

1. **My Apps → + → New App**.
2. Datos:
   - Platforms: **iOS**.
   - Name: `Kengo` (este es el display name público en App Store, max 30 chars).
   - Primary Language: **Spanish (Spain)**.
   - Bundle ID: selecciona `com.kengoapp.app` (debe aparecer porque ya lo registraste en §1.1).
   - SKU: cualquier ID interno único, p.ej. `kengo-ios-2026`.
   - User Access: **Full Access**.
3. **Create**.

> Si solo quieres TestFlight (sin App Store público todavía), esto es suficiente. Para el envío posterior a App Store, en la pestaña App Store de la ficha hay que rellenar: descripción, screenshots 6.7" + 6.5" + 5.5", privacy policy URL, categoría, age rating, etc. Eso se hace cuando vayas a publicar, no para TestFlight interno.

### 2.2 Privacy nutrition label

App Store Connect te obliga a rellenar **App Privacy** antes del primer envío a TestFlight externo (interno no lo exige).

- Tipos de datos recopilados por Kengo: email, nombre, identificadores de usuario, datos de salud (ejercicios/dolores), métricas de uso.
- Vinculados con la cuenta: sí.
- Tracking: **no**.

Rellenar en **My Apps → Kengo → App Privacy → Get Started**.

### 2.3 Acuerdos y impuestos

**Business → Agreements, Tax, and Banking**: el "Paid Apps Agreement" no se necesita para TestFlight (la app es gratuita en TestFlight por definición). El "Free Apps Agreement" es automático. Si en el futuro vendes en App Store directamente (sin Stripe), necesitarás Paid Apps + cuenta bancaria + datos fiscales.

---

## 3. Cambios necesarios en el repo (4 pequeños)

### 3.1 Cambiar `aps-environment` a `production`

Xcode con automatic signing **a veces** lo sobrescribe en archive, pero declarar `production` explícitamente evita ambigüedad.

**Archivo**: `apps/app/ios/App/App/App.entitlements`

```xml
<key>aps-environment</key>
<string>production</string>
```

> Si necesitas seguir probando push en device local con builds Debug, mantén dos `.entitlements` (Debug=development, Release=production) y referencia cada uno en `CODE_SIGN_ENTITLEMENTS` por configuración. Para empezar, basta con `production` único.

### 3.2 Declarar exención criptográfica

Para evitar que Apple te pregunte en cada build "¿usas cifrado no exento?", añade en `Info.plist`:

**Archivo**: `apps/app/ios/App/App/Info.plist` (dentro del `<dict>` raíz)

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

> Kengo solo usa HTTPS estándar para conectar con Convex/Firebase — exento de Export Compliance. Si en el futuro añadís cifrado propio (no HTTPS de OS), revisar.

### 3.3 Incrementar build number

Cada subida a TestFlight necesita un `CFBundleVersion` (`CURRENT_PROJECT_VERSION`) único y monótonamente creciente para una misma `MARKETING_VERSION`. Hoy está en `1`.

Opciones:
- **Manual**: en Xcode, target `App`, pestaña General, campo `Build` → poner `1` ahora, subir a `2`, `3`, ... en cada upload.
- **Automatizado** (recomendado a futuro): añadir un Run Script Phase con `agvtool next-version -all` o leerlo del git short-sha.

Para la primera subida deja `1`. Apunta siempre el último número usado.

### 3.4 (Opcional pero recomendado) Compartir el scheme `App`

`apps/app/ios/App/App.xcodeproj/xcshareddata/xcschemes/` está vacío — el scheme `App` existe pero solo en el `xcuserdata` de tu Mac. Si nunca vas a hacer CI con `xcodebuild` puedes ignorarlo, pero es 2 clicks:

1. Xcode → **Product → Scheme → Manage Schemes**.
2. Marca la columna **Shared** junto a `App`.
3. Commit del nuevo fichero `xcshareddata/xcschemes/App.xcscheme` que aparece.

Necesario para CI/Fastlane más adelante.

---

## 4. Build & Upload — flujo manual primera vez

### 4.1 Build web nativo y sync

Desde la raíz del repo:

```bash
npm run cap:sync:ios
```

Esto hace:
1. `nx build app --configuration native` (usa `environment.native.ts`, sin Service Worker).
2. `npx cap sync ios` (copia el bundle a `apps/app/ios/App/App/public/` y actualiza el SPM Package.resolved).

Verifica que el output esté en `dist/apps/app/browser/` y que `apps/app/ios/App/App/public/index.html` se actualice (mtime reciente).

### 4.2 Abrir Xcode

```bash
npm run cap:open:ios
```

En Xcode:
1. Panel izquierdo → selecciona el proyecto `App` → target `App`.
2. Pestaña **Signing & Capabilities**:
   - Team: `Carlos Cabrera Criado (LTZK7CBKWL)` o como esté nombrado.
   - Bundle Identifier: `com.kengoapp.app`.
   - Confirma que las capabilities **Push Notifications** y **Background Modes → Remote notifications** estén presentes. Si no, click **+ Capability** para añadirlas (la segunda ya está vía `UIBackgroundModes` en `Info.plist`, pero la UI de Xcode debe reflejarla).
3. En la barra superior, selecciona destino **Any iOS Device (arm64)** — **NO** un simulador (no se puede archivar para simulador).

### 4.3 Archive

1. Menú **Product → Archive**.
2. Espera (~5-10 min la primera vez).
3. Al acabar, se abre **Organizer** con el archive recién creado.

> **Si falla** por firma ("No matching provisioning profile found"): en Signing & Capabilities, desmarca y vuelve a marcar "Automatically manage signing". Xcode pedirá tu password de Apple ID y generará el profile en developer.apple.com.

### 4.4 Distribute → App Store Connect

1. En Organizer, con el archive seleccionado → **Distribute App**.
2. Method: **App Store Connect**.
3. Destination: **Upload**.
4. Opciones por defecto (todo marcado: symbols, manage version, etc.). En "Re-sign" deja **Automatically manage signing**.
5. **Upload**. Tarda 3-10 min.

### 4.5 Procesamiento en App Store Connect

Tras el upload:
1. En App Store Connect → **Kengo → TestFlight → iOS Builds**, el build aparece en estado **Processing** (~15-30 min, a veces hasta 1h).
2. Cuando termine, Apple te enviará un email. El estado pasa a **Ready to Test** (interno) o **Missing Compliance** si no incluiste `ITSAppUsesNonExemptEncryption` — en ese caso responde manualmente "No" a la pregunta de cifrado en la fila del build.

---

## 5. Configurar TestFlight

### 5.1 Internal Testing (rápido — solo tu equipo)

- Hasta **100 testers** internos. Acceso inmediato, sin revisión Apple.
- Solo personas con rol App Manager / Developer / Marketer en el team.

Pasos:
1. **TestFlight → Internal Testing → + (crear grupo)**.
2. Nombre: `Equipo Kengo`.
3. Añade testers (deben aceptar la invitación en su Apple ID).
4. Asocia el build procesado al grupo.

Los testers reciben email + notificación en TestFlight app y pueden instalar al instante.

### 5.2 External Testing (beta pública controlada)

- Hasta **10.000 testers externos** por grupo. **Requiere Beta App Review** (~24-48h la primera build de una versión; subsecuentes builds suelen pasar sin re-revisión salvo cambios mayores).
- Necesita rellenar:
  - **Beta App Information**: descripción, feedback email, marketing URL, privacy policy URL.
  - **Test Information**: qué probar, credenciales de prueba si la app requiere login.
  - **Export Compliance** ya cubierto por §3.2.

Pasos:
1. **TestFlight → External Testing → + (crear grupo)**.
2. Nombre del grupo: `Beta cerrada`, `Fisios piloto`, etc.
3. Añade testers por email **o** activa "Public link" para invitación masiva.
4. Asocia el build → **Submit for Review**.
5. Apple revisa. Cuando apruebe, el grupo pasa a poder instalar.

### 5.3 Test info útil para el equipo de revisión

En **Test Information** rellena:
- **What to Test**: describe los flujos críticos (registro fisio → crear plan → asignar a paciente → modo paciente → realizar sesión).
- **App Description**: copy corto.
- **Feedback Email**: tu email de soporte.
- **Demo Account**: imprescindible. Crea un usuario fisio y un paciente en producción de Kengo solo para Apple ("apple-review@kengoapp.com" o similar) y pon credenciales aquí. Sin esto Apple rechaza la review.

---

## 6. Checklist final antes del primer upload

- [ ] Apple Developer Program activo (cuenta `LTZK7CBKWL`).
- [ ] App ID `com.kengoapp.app` creado con capability **Push Notifications**.
- [ ] APNs Auth Key generada y subida a Firebase Console (si push es part del MVP TestFlight).
- [ ] App registrada en App Store Connect (nombre: Kengo, bundle ID coincide).
- [ ] App Privacy completado en App Store Connect.
- [ ] Cambio §3.1 aplicado: `aps-environment = production`.
- [ ] Cambio §3.2 aplicado: `ITSAppUsesNonExemptEncryption = NO`.
- [ ] (Opcional) §3.4 scheme compartido.
- [ ] `npm run cap:sync:ios` ejecutado sin errores.
- [ ] Xcode → Archive con destino "Any iOS Device" sin warnings de firma.
- [ ] Upload completado y build "Ready to Test" en TestFlight.
- [ ] Grupo Internal con al menos tu Apple ID añadido.
- [ ] Instalación verificada en un device físico vía la app TestFlight.

---

## 7. Subidas siguientes (workflow corto)

Para cada nueva build:

```bash
# 1. Bump del build number (manual en Xcode o agvtool)
cd apps/app/ios/App
agvtool next-version -all  # opcional, alternativa al cambio manual en Xcode

# 2. Build + sync desde la raíz del repo
cd ../../../..
npm run cap:sync:ios

# 3. Xcode → Product → Archive → Distribute → App Store Connect → Upload
npm run cap:open:ios
```

Para cambios de **versión pública** (1.0.0 → 1.1.0), sube `MARKETING_VERSION` en Xcode y reinicia el contador de build (`CURRENT_PROJECT_VERSION = 1`) — opcional, también vale seguir incrementando.

---

## 8. Tropezones frecuentes

| Síntoma | Causa típica | Fix |
|---|---|---|
| `No profiles for 'com.kengoapp.app' were found` en Archive | App ID no registrado o caps inconsistentes | Crea App ID en §1.1 con las mismas capabilities que el target en Xcode |
| `Missing Push Notification Entitlement` tras upload | `aps-environment = development` en build Release | Aplica §3.1 |
| Build atascado en "Processing" >2h | A veces Apple se cuelga | Re-upload con build number +1. Email a Apple solo si pasa >24h |
| `Invalid Swift Support` | mezcla de Xcode versions | Limpia con `Product → Clean Build Folder` y re-archive |
| TestFlight muestra "Missing Compliance" | No declaraste cifrado | Aplica §3.2, o responde "No" en App Store Connect en la fila del build |
| Push notification no llega en TestFlight | Estás usando token APNs sandbox | Verifica que la APNs key (no certificado de sandbox) está subida a Firebase y que el build se hizo con `aps-environment = production` |
| El icon aparece como cuadrado blanco en TestFlight | Asset no procesa correctamente | `npm run cap:assets` desde raíz, luego `npm run cap:sync:ios`. Asegura `apps/app/assets/icon.png` opaco 1024×1024 |
| Splash blanca en device pero correcta en simulador | Caché del launch image en iOS | Borra la app del device y reinstala desde TestFlight |

---

## 9. Siguientes pasos (fuera del alcance de TestFlight pero relacionados)

- **Fastlane + match** para automatizar el upload (`fastlane deliver`, `fastlane pilot`) y compartir certificados entre máquinas.
- **GitHub Actions con `macos-latest`** para CI que dispare el upload en cada tag `v*` (necesita `App Store Connect API Key` en secrets).
- **App Store público**: rellenar la pestaña App Store (descripción, screenshots, age rating) y enviar a App Review desde TestFlight tras validar la beta.
- **Universal Links** sobre el dominio `kengoapp.com` (sirviendo `apple-app-site-association`) para que los enlaces HTTPS abran la app en vez del scheme custom `kengo://`. Hoy no es bloqueante.

Documentación interna relacionada:
- `docs/CAPACITOR_NATIVE_APP.md` — arquitectura general de la integración Capacitor.
- `docs/SETUP_PUSH_NOTIFICATIONS.md` — flujo completo de push iOS+Android.
- `docs/DESARROLLOS_PENDIENTES_CAPACITOR.md` — backlog operativo (publicación, CI, IAP).
