# Cuentas de revisión para Google Play y App Store

Documento único para las dos tiendas. Google lo exige en *Política → Contenido de
la app → **Acceso a la app***; Apple, en *App Review Information → **Sign-In
Required***. Sin credenciales operativas el rechazo es automático (guideline 2.1
de Apple; "App access" en Play).

> Creadas y verificadas en **producción** el 2026-07-30.

---

## 1. Credenciales

Las contraseñas **no se guardan en el repositorio**. Están en el gestor de
contraseñas de la empresa.

| Rol | Email | Contraseña |
|---|---|---|
| Fisioterapeuta / admin de clínica | `review-fisio@kengoapp.com` | `[VER GESTOR DE CONTRASEÑAS]` |
| Paciente | `review-paciente@kengoapp.com` | `[VER GESTOR DE CONTRASEÑAS]` |

Ambas entran por **email + contraseña** en `/login`. Detalles que importan a un
revisor:

- **No hace falta recibir ningún correo.** Better-Auth está configurado con
  `emailAndPassword.requireEmailVerification: false` (`convex/auth.ts`), así que
  no hay código de verificación ni enlace mágico de por medio. Es justo lo que
  Google exige cuando avisa de que sus revisores no pueden recibir OTPs.
- **No hay login social**, así que no aplica el requisito de "Sign in with Apple"
  (guideline 4.8).
- Los buzones `@kengoapp.com` de estas dos cuentas **no existen**. Es
  intencionado, pero implica que `/recuperar-password` no es una vía de rescate:
  si se pierden las contraseñas hay que regenerarlas desde soporte.

---

## 2. Texto para *Acceso a la app* (Google Play)

```
Kengo tiene dos modos, derivados del puesto del usuario en su clínica. Se
adjuntan credenciales de ambos. Ninguna requiere recibir correo ni código de
verificación: el acceso es con email y contraseña.

MODO FISIOTERAPEUTA
Usuario: review-fisio@kengoapp.com
Contraseña: [contraseña]
Qué se puede revisar: catálogo de ejercicios con vídeo, constructor de planes,
ficha del paciente con adherencia y evolución del dolor, y chat con el paciente.

MODO PACIENTE
Usuario: review-paciente@kengoapp.com
Contraseña: [contraseña]
Qué se puede revisar: actividad diaria, sesión guiada con vídeo y contador de
series, registro de dolor al terminar, progreso y chat con el fisioterapeuta.

La clínica de demostración ya tiene un plan activo, historial de sesiones y una
conversación, de modo que ambas cuentas muestran datos desde el primer acceso.

La suscripción de la clínica se contrata con Stripe en el navegador, fuera de la
aplicación. No hay compras dentro de la app.
```

## 3. Texto para *App Review Information* (App Store)

En **Sign-In Required** marcar *Yes* y poner la cuenta de fisioterapeuta, que es
el caso completo. En **Notes**:

```
Kengo tiene dos modos, derivados del puesto del usuario en su clínica.

La cuenta facilitada arriba (review-fisio@kengoapp.com) entra en modo
fisioterapeuta: catálogo de ejercicios con vídeo, constructor de planes, ficha
del paciente con adherencia y dolor, y chat.

Para revisar el modo paciente, cerrar sesión y entrar con:
  review-paciente@kengoapp.com / [contraseña]
Muestra la actividad del día, la sesión guiada con vídeo y contador de series, el
registro de dolor al terminar y el chat con su fisioterapeuta.

Ambas cuentas usan email y contraseña; no se necesita enlace mágico ni recibir
ningún correo. La clínica de demostración ya tiene datos sembrados.

La suscripción de la clínica se gestiona con Stripe en el navegador, fuera de la
app. No hay compras integradas.

La cuenta se puede eliminar desde Perfil → Eliminar cuenta, y también desde
https://www.kengoapp.com/eliminar-cuenta sin instalar la app.
```

---

## 4. Qué hay sembrado en producción

| Elemento | Valor |
|---|---|
| Clínica | `Clínica Kengo Demo` (comercial: `Kengo Demo`) |
| `clinicId` | `jx77t41db17j6kyeghnq7q2ts58bhvs9` |
| Usuario fisio | `mn76xvqb6cbrysjt425a0ny84d8bgsw4` — admin, `tambienEsPaciente: true` |
| Usuario paciente | `mn7dr45prsna0dda039z4vbwdh8bgskw` |
| Plan | `kx726nzm8q6fhdw780dxyewea58bhzhw` — "Rehabilitación de rodilla y cadera", `activo`, versión 2 |
| Versión anterior | `kx740112zdt4x0za9pyccrajnd8bhcgb`, en estado `modificado`. Normal: editar un plan crea una versión nueva y archiva la previa. No borrarla |
| Vigencia del plan | 2026-07-30 → **2035-12-31**, los **siete** días de la semana |
| Ejercicios | 5: 1 Minute Squat Test, 90-90 Hip Lift, 90º Knee Extension, Active Hip Flexion, Adductor Rockers (3×15), cada uno con instrucciones para el paciente |
| Sesión | 1 completada el 2026-07-30, 5/5 ejercicios, dolor 3/10 y nota del paciente. Alimenta racha e historial |
| Chat | 2 mensajes, uno en cada sentido |

> La sesión completada quedó ligada a la **versión 1** del plan, así que el panel del paciente muestra la sesión de hoy como pendiente sobre la versión 2. Es lo deseable para una revisión: el historial y la racha se conservan, y el revisor tiene una sesión que puede ejecutar de principio a fin.

Dos decisiones deliberadas que **no hay que "corregir"**:

- **`fechaFin` en 2035** y **todos los días de la semana activos**: garantizan que
  el revisor encuentre ejercicios pendientes sea cual sea el día en que abra la
  app, ahora y en revisiones futuras. Un plan de un mes de lunes a viernes
  dejaría la pantalla vacía en cuanto caducase.
- **La clínica no tiene suscripción de Stripe viva** (ver §5).

---

## 5. Por qué esta clínica no caduca — y cómo no romperlo

`clinics.create` lanza `internal.billing.actions.startTrialForClinic`, que abre
una suscripción de Stripe con **trial de 14 días**. Al vencer, Stripe emite
`customer.subscription.updated`; el webhook de `convex/http.ts` resuelve la
clínica por `metadata.orgId` y sobrescribe `clinicBilling.estadoLocal`. Como
`requireActiveSubscription` (`convex/_helpers/permissions.ts`) bloquea
`plans.create/update`, `accessCodes.create`, `assignments.assign` y
`messages.sendMessage`, la cuenta de revisión quedaría inservible a los 14 días.

Por eso la suscripción de Stripe se desvincula y se cancela, y el estado se fija
a mano. **El orden importa**: quitar `orgId` *antes* de cancelar, para que el
evento de cancelación no encuentre la clínica.

| Referencia | Valor |
|---|---|
| Stripe customer | `cus_UytYs1xBwOGGDk` |
| Stripe subscription | `sub_1TyvleEa0q7bmfXjjWLuDWIS` |
| Fin del trial original | 2026-08-13 |

Pasos (Stripe Dashboard + Convex Dashboard):

1. Stripe → suscripción `sub_1TyvleEa0q7bmfXjjWLuDWIS` → *Metadata* → **borrar la
   clave `orgId`**.
2. Stripe → cancelar esa suscripción.
3. Convex → *Run Function* → `billing.internal.upsertClinicBilling` con:
   ```json
   { "clinicId": "jx77t41db17j6kyeghnq7q2ts58bhvs9", "estadoLocal": "active" }
   ```

### Mantenimiento

- **No reactivar** la suscripción de Stripe de esta clínica ni devolverle el
  `orgId`: volvería a gobernar el `estadoLocal` y la cuenta caducaría.
- **No añadir fisioterapeutas** a la clínica demo: `syncQuantityFromMemberships`
  intentaría actualizar una suscripción cancelada.
- Ninguna de las dos cuentas debe entrar en `SUPPORT_USER_IDS`: daría al revisor
  acceso a la impersonación de usuarios reales.
- Comprobar `estadoLocal` tras cada envío a revisión.

---

## 6. Cómo borrar la clínica demo

Cuando deje de hacer falta, y solo entonces: eliminar `assignments`, `plans` y
`planExercises` de `clinicId = jx77t41db17j6kyeghnq7q2ts58bhvs9`, después las
`clinicMemberships`, la `clinics` y la fila de `clinicBilling`, y por último las
dos cuentas de Better-Auth. Mientras la app esté publicada en cualquiera de las
dos tiendas, **no borrar nada**: Apple exige que la cuenta demo siga operativa
durante toda la vida de la app.

---

## 7. Documentos relacionados

- `docs/GOOGLE_PLAY_LISTING.md` — copy y formularios de Play.
- `docs/PUBLICAR_ANDROID_GOOGLE_PLAY.md` — guía operativa de publicación Android.
- `docs/APP_STORE_CONNECT_COPY.md` — copy de App Store Connect.
- `docs/SETUP_TESTFLIGHT.md` — distribución en TestFlight.
