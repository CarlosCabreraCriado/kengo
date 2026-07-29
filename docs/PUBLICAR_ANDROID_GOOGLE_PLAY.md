# Publicar Kengo en Google Play — guía paso a paso

Guía operativa para llevar la app Android (`com.kengoapp.app`) desde el estado
actual del repo hasta producción en Google Play.

- **Copy y formularios de la ficha** → `docs/GOOGLE_PLAY_LISTING.md` (ya redactado).
- **Detalles técnicos de Capacitor** → `docs/CAPACITOR_NATIVE_APP.md`.
- **Pendientes de código nativo** → `docs/DESARROLLOS_PENDIENTES_CAPACITOR.md`.

## Punto de partida (verificado el 2026-07-29)

| Elemento | Estado |
|---|---|
| Proyecto Android (Capacitor 8) | ✅ existe en `apps/app/android` |
| `applicationId` | ✅ `com.kengoapp.app` (inmutable tras publicar) |
| `versionCode` / `versionName` | ✅ `2` / `1.0.1` |
| `minSdk` / `targetSdk` | ✅ 24 / 36 → cumple el requisito de Play de agosto 2026 |
| R8 en release (`minifyEnabled`) | ✅ activado — **hay que validar un build release firmado** |
| FCM (`google-services.json`) | ✅ presente, proyecto `kengo-7e804` |
| Deep links `kengo://` + App Links | ✅ manifest acotado a `/magic` e `/invitacion` |
| **Keystore de release + `signingConfigs`** | ❌ **no existe** → no se puede firmar un AAB |
| **`assetlinks.json`** | ❌ tiene marcadores `PENDIENTE_*` |
| Ficha en Play Console | ❌ sin crear |

Los dos ❌ del final son los únicos bloqueantes duros de código/infra. El resto
del trabajo es de consola y de verificación en dispositivo.

---

## Fase 0 — Herramientas locales (30–60 min)

1. Instalar **Android Studio** (incluye SDK, `adb`, emulador y un JDK 21 embebido).
2. En *Settings → Languages & Frameworks → Android SDK → SDK Platforms*, instalar
   **Android 16 (API 36)**; en *SDK Tools*, **Android SDK Build-Tools**,
   **Platform-Tools** y **Command-line Tools**.
3. Añadir al `~/.zshrc`:

   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   ```

4. Verificar:

   ```bash
   java -version        # 17 o 21
   adb --version
   sdkmanager --list_installed | grep "platforms;android-36"
   ```

5. **Dispositivo físico** (recomendado sobre emulador): *Ajustes → Información del
   teléfono → tocar "Número de compilación" 7 veces* → *Opciones de desarrollador
   → Depuración por USB*. Conectar y aceptar la huella RSA. Comprobar con
   `adb devices`.

> El emulador no sirve para validar haptics ni push reales con fiabilidad. Para
> la fase 2 hace falta un teléfono de verdad, preferiblemente con Android 15 o 16.

---

## Fase 1 — Cuenta de Google Play Console (1–3 días de espera)

Empieza por aquí: la verificación de identidad es lo único que no puedes acelerar.

1. Registro en <https://play.google.com/console/signup> — **25 USD, pago único**.
2. **Elegir tipo de cuenta. Esta decisión define el calendario:**

   | Tipo | Requisitos | Consecuencia |
   |---|---|---|
   | **Organización** (recomendado) | Nombre legal, [número D-U-N-S](https://developer.android.com/distribute/console/organization-account), web y email corporativo | Puede publicar en producción directamente |
   | **Personal** (creada después del 13-nov-2023) | DNI y dirección | Obliga a **12 testers opted-in durante 14 días seguidos** en un test cerrado antes de poder solicitar acceso a producción |

   Si Kengo se comercializa a clínicas, la cuenta de organización es además lo
   correcto de cara al RGPD (el responsable del tratamiento es la empresa, no una
   persona física). Obtener el D-U-N-S es gratis y tarda unos días.
3. Verificación de identidad: subir documentación y esperar (24 h – 3 días
   normalmente; puede alargarse).
4. Activar **verificación en dos pasos** en la cuenta de Google del titular. Si se
   pierde el acceso a esta cuenta, se pierde la app.
5. Definir la dirección de contacto pública: `info@kengoapp.com`.

---

## Fase 2 — Validar la app en un dispositivo real (½–2 días)

Nada de esto se ha probado todavía en Android (ver `DESARROLLOS_PENDIENTES_CAPACITOR.md`
§B). Hacerlo **antes** de firmar y subir: cada corrección posterior a un AAB
publicado cuesta un `versionCode` nuevo y una revisión.

```bash
npm run cap:sync:android     # build:native + npx cap sync android
npm run cap:open:android     # abre Android Studio → botón Run
# o directamente:
npm run cap:run:android
```

Inspecciona la WebView desde Chrome en `chrome://inspect#devices`.

Checklist mínimo antes de pasar de fase:

- [ ] **Login y persistencia**: iniciar sesión, matar la app, reabrir → sesión viva.
      Sin errores de CORS en consola (el origin de la WebView es
      `https://app.kengoapp.local`, ya en la allowlist de `convex/http.ts`).
- [ ] **Realtime de Convex**: `/mensajes` recibe un mensaje enviado desde otra sesión.
- [ ] **Magic link por custom scheme**:
      ```bash
      adb shell am start -W -a android.intent.action.VIEW -d "kengo://magic?t=TOKEN_REAL"
      ```
- [ ] **Push (FCM)**: aceptar el permiso `POST_NOTIFICATIONS` (Android 13+), recibir
      una notificación con la app en background y en foreground, y comprobar que
      el icono no sale como cuadrado blanco.
- [ ] **Stripe**: `/mi-clinica/suscripcion` → checkout con `4242 4242 4242 4242` →
      vuelta a la app por `kengo://billing/return?status=success`.
- [ ] **Cámara y galería** en el avatar (permisos en primera ejecución).
- [ ] **Edge-to-edge**: con `targetSdk 36`, Android 15+ dibuja bajo las barras de
      sistema sin posibilidad de opt-out. Revisar header, tab bar, CTAs y la
      pantalla de sesión activa. Si el contenido queda tapado, hay dos palancas:
      las utilidades `safe-area` de `styles.css` (pendiente A1) o
      `StatusBar.setOverlaysWebView({ overlay: false })`.
- [ ] **Splash e icono**: son los definitivos, no los placeholders de Capacitor
      (`npm run cap:assets` si hay que regenerar; luego *Build → Clean Project*).

---

## Fase 3 — Keystore de subida (30 min, irreversible)

La clave con la que firmas la primera vez es la que Google asocia a tu cuenta
para siempre. **Si la pierdes, no puedes publicar actualizaciones** (con Play App
Signing se puede pedir un reset de la clave de subida, pero es un trámite lento).

1. Generar el keystore **fuera del repositorio**:

   ```bash
   mkdir -p ~/keys
   keytool -genkeypair -v \
     -keystore ~/keys/kengo-upload.jks \
     -alias kengo-upload \
     -keyalg RSA -keysize 4096 -validity 10000 \
     -storetype PKCS12
   ```

   Responde al CN con `Kengo`, O con el nombre legal de la empresa, C con `ES`.

2. **Custodiar**: el `.jks` y las dos contraseñas al gestor de contraseñas de la
   empresa, más una copia cifrada en otro sitio. No en Slack, no en el repo.

3. Antes de crear cualquier fichero con credenciales, **añadir al `.gitignore`**
   (hoy no están ignorados):

   ```gitignore
   apps/app/android/keystore.properties
   apps/app/android/local.properties
   *.jks
   *.keystore
   ```

4. Crear `apps/app/android/keystore.properties` (ya ignorado por el paso anterior):

   ```properties
   storeFile=/Users/carloscabrera/keys/kengo-upload.jks
   storePassword=...
   keyAlias=kengo-upload
   keyPassword=...
   ```

5. Añadir el bloque de firma a `apps/app/android/app/build.gradle`. Cambio a
   aplicar cuando se dé luz verde:

   ```gradle
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       // ...
       signingConfigs {
           release {
               if (keystorePropertiesFile.exists()) {
                   storeFile file(keystoreProperties['storeFile'])
                   storePassword keystoreProperties['storePassword']
                   keyAlias keystoreProperties['keyAlias']
                   keyPassword keystoreProperties['keyPassword']
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               shrinkResources true
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

6. Anotar la huella de la clave de subida (hará falta en la fase 6):

   ```bash
   keytool -list -v -keystore ~/keys/kengo-upload.jks -alias kengo-upload | grep -A1 SHA256
   ```

---

## Fase 4 — Construir y probar el AAB firmado (2–4 h)

```bash
npm run cap:sync:android
cd apps/app/android
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

**Antes de subirlo, probar la variante release en dispositivo.** R8 y
`shrinkResources` están activos y pueden romper reflexión en plugins de Capacitor
(push, deep links, cámara) sin que el build falle:

```bash
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Repetir con esa APK los puntos de push, deep links y Stripe de la fase 2. Si algo
se rompe solo en release, la causa suele ser ProGuard: añadir reglas `-keep` en
`apps/app/android/app/proguard-rules.pro`.

Reglas de versionado para cada subida posterior:

- `versionCode` **entero, siempre creciente** — Play rechaza un valor repetido.
- `versionName` visible al usuario; mantenerlo alineado con `package.json`
  (hoy `1.0.1`).

---

## Fase 5 — Crear la app en Play Console (2–3 h)

1. *Todas las apps → Crear app*: nombre `Kengo`, español (España) como idioma
   por defecto, tipo **App**, **Gratis**.
2. Aceptar las declaraciones de directrices y leyes de exportación de EE. UU.
3. **Activar Play App Signing** (*Versiones → Configuración → Integridad de la
   app*). Es el modo por defecto: tú firmas con la clave de subida y Google
   re-firma con la clave de distribución. Esto significa que **hay dos huellas
   SHA-256** y las dos importan en la fase 6.
4. Subir el AAB a **Pruebas internas** (*Versiones → Pruebas → Pruebas internas →
   Crear versión*). Este canal admite hasta 100 testers por email y se activa en
   minutos, sin revisión completa.
5. Crear la lista de testers internos y comprobar la instalación desde el enlace
   de participación en un teléfono distinto al de desarrollo.

---

## Fase 6 — Cerrar los App Links (1 h)

Ahora ya existen las dos huellas. Sin este paso, abrir `https://kengoapp.com/magic`
desde el correo abre el navegador en lugar de la app, y `autoVerify` falla en
silencio.

1. Copiar el SHA-256 del **certificado de la clave de firma de la app** en
   *Integridad de la app → Play App Signing*.
2. Sustituir los dos marcadores de
   `apps/app/public/.well-known/assetlinks.json`:
   - huella de la **clave de firma de Play** (la que valida Google);
   - huella de la **clave de subida** (para que verifiquen también los builds locales).
3. Desplegar el servicio de la **app** en Railway (el apex `kengoapp.com` sirve la
   app; `apps/app/server.js` ya expone `.well-known` con `dotfiles: 'allow'`).
4. Verificar **mirando el body**, no el código de estado — un fichero mal nombrado
   devuelve `index.html` con 200:

   ```bash
   curl -s https://kengoapp.com/.well-known/assetlinks.json
   ```

5. Verificar en dispositivo:

   ```bash
   adb shell pm verify-app-links --re-verify com.kengoapp.app
   adb shell pm get-app-links com.kengoapp.app   # debe decir: verified
   ```

---

## Fase 7 — Contenido de la app y cumplimiento (3–5 h)

Todo en *Política → Contenido de la app*. Play bloquea la publicación hasta que no
haya ni un apartado en rojo. El copy y las respuestas están en
`docs/GOOGLE_PLAY_LISTING.md`.

- [ ] **Política de privacidad**: `https://www.kengoapp.com/legal/privacidad`.
- [ ] **Acceso a la app**: la app requiere login → hay que dar credenciales de
      prueba (una cuenta fisio y una paciente) e instrucciones. Sin esto, el
      revisor ve una pantalla de login y rechaza.
- [ ] **Anuncios**: No.
- [ ] **Clasificación de contenido**: cuestionario IARC.
- [ ] **Público objetivo**: 18+. No dirigida a menores → no aplica Families Policy.
- [ ] **Seguridad de los datos**: la tabla completa está en
      `GOOGLE_PLAY_LISTING.md` §2. Declarar **datos de salud**, cifrado en
      tránsito y URL de borrado `https://www.kengoapp.com/eliminar-cuenta`
      (existe en la landing).
- [ ] **Apps de salud**: declaración obligatoria en la categoría *Salud y
      bienestar*. Responder **No** a "diagnóstico o tratamiento médico" —
      Kengo es herramienta de apoyo; decir sí arrastraría el Reglamento (UE)
      2017/745 de producto sanitario.
- [ ] **Eliminación de cuenta**: declarar que se puede borrar desde dentro de la
      app y desde la URL pública.
- [ ] Apps de gobierno: No. Funciones financieras: No.

> **Coherencia obligatoria**: el formulario de Data safety, el texto de
> `libs/shared/legal/.../privacidad` y la tabla de App Privacy de Apple tienen que
> decir lo mismo. Una discrepancia es motivo de suspensión, no de aviso.

---

## Fase 8 — Ficha de la tienda y material gráfico (3–4 h)

*Crecimiento → Presencia en Play Store → Ficha principal de Play Store*. Textos
listos en `GOOGLE_PLAY_LISTING.md` §1 (los límites de caracteres de Play no
coinciden con los de Apple: no reutilizar el copy de Apple tal cual).

| Recurso | Requisito |
|---|---|
| Nombre | máx. 30 caracteres |
| Descripción breve | máx. 80 |
| Descripción completa | máx. 4000 |
| Icono | 512 × 512 PNG 32 bits, sin transparencia |
| Gráfico de funciones | 1024 × 500 PNG/JPG (obligatorio) |
| Capturas de teléfono | 2 a 8; recomendado 1080 × 1920 |
| Capturas de tablet | opcionales, pero sin ellas Play degrada la app en pantallas grandes |
| Vídeo | opcional (URL de YouTube) |

Para las capturas: mejor hacerlas en el dispositivo real con la app en release. El
target `npm run e2e:screenshots` (Playwright, salida en `screenshots/`) sirve para
un primer borrador, pero el marco del navegador y las métricas falsas se notan.

---

## Fase 9 — Escalado de pruebas y producción

1. **Pruebas internas** (ya en la fase 5) → arreglar lo que salga.
2. **Informe previo al lanzamiento**: Play ejecuta la app en un parque de
   dispositivos y reporta cierres, ANR y problemas de accesibilidad. Requiere las
   credenciales de prueba de la fase 7.
3. **Pruebas cerradas**: obligatorio si la cuenta es personal creada después del
   13-nov-2023 → **12 testers opted-in durante 14 días seguidos**. "Opted-in"
   significa que aceptaron la invitación *e instalaron* la app con la cuenta
   invitada; invitados sin instalar no cuentan. Después se solicita el acceso a
   producción desde la propia consola.
4. **Producción**: enviar a revisión (de horas a 7 días la primera vez; para una
   app de salud, contar con la parte alta).
5. **Lanzamiento gradual**: empezar al 10–20 % del tráfico y subir. Permite frenar
   con un *halt rollout* si aparecen cierres.

---

## Decisión pendiente: pagos y política de Play

Kengo cobra la suscripción de la clínica con **Stripe fuera de la app**. La
política de pagos de Google exige Google Play Billing para compras digitales
consumidas en la app, y es la causa de rechazo más habitual en apps con
suscripción propia. Tras el acuerdo con Epic (marzo 2026) y las reglas de EEE del
DMA, enlazar a un pago externo es posible, pero con condiciones y comisión.

Tres caminos, de menor a mayor coste:

1. **No exponer el checkout en el build Android** — ocultar el CTA de suscripción
   en nativo y que el admin de la clínica suscriba desde el navegador. Es lo más
   rápido y lo que menos superficie de rechazo deja. Coste: cambio de UI
   condicionado por plataforma.
2. **Acogerse al programa de ofertas externas / facturación alternativa del EEE** —
   permite el enlace de salida declarándolo en la consola y pagando la comisión
   reducida. Coste: trámite en consola y comisiones.
3. **Envolver el pago en Play Billing** (RevenueCat o `@capacitor-community/stripe`) —
   coste alto: reescribir `SubscriptionService` y duplicar webhooks.

**Para pruebas internas y cerradas no bloquea.** Hay que resolverlo antes de
enviar a producción. El mismo debate está abierto para iOS
(`DESARROLLOS_PENDIENTES_CAPACITOR.md` §E3).

---

## Ruta crítica

```
Fase 1 (cuenta, 1-3 días de espera)  ──┐
Fase 0 + 2 (toolchain y validación)  ──┼→ Fase 3 (keystore) → Fase 4 (AAB)
                                        │      → Fase 5 (interna) → Fase 6 (App Links)
                                        └→ Fases 7 y 8 (cumplimiento y ficha, en paralelo)
                                               → Fase 9 (cerradas → producción)
```

Con cuenta de organización y sin sorpresas en la fase 2: **1–2 semanas** hasta
producción. Con cuenta personal, súmale las **2 semanas** del test cerrado
obligatorio.

## Cambios de código que esta guía deja pendientes

Ninguno aplicado todavía. Cuando se dé luz verde:

1. `.gitignore` — ignorar `keystore.properties`, `local.properties`, `*.jks`, `*.keystore`.
2. `apps/app/android/app/build.gradle` — bloque `signingConfigs` + `signingConfig` en `release`.
3. `apps/app/public/.well-known/assetlinks.json` — las dos huellas SHA-256 reales.
4. Opcional según la fase 2: utilidades `safe-area` en componentes fijos (A1),
   status bar por ruta (A2/A3) y reglas `-keep` en `proguard-rules.pro`.
