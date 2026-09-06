# Respuesta a Apple — Guideline 2.1(b) Information Needed (modelo de negocio)

> Revisión de la versión **1.2.0 (build 7)**, septiembre 2026. Apple pausó la
> revisión con una petición 2.1(b): cinco preguntas sobre el modelo de negocio.
> Este doc contiene el análisis (español) y la respuesta lista para pegar
> (inglés) en App Store Connect → Resolution Center → *Reply to App Review*.
> Credenciales y notas de revisión: `CUENTAS_REVISION_TIENDAS.md`.

---

## 1. Qué está preguntando Apple realmente

La 2.1(b) **no es un rechazo por infracción**: es el cuestionario que App Review
envía cuando detecta que la app da acceso a algo de pago y necesita decidir si
aplica la guideline **3.1.1** (obligación de In-App Purchase) o alguna de las
excepciones de la **3.1.3**. Para Kengo aplican dos:

- **3.1.3(b) Multiplatform Services** — la app puede dar acceso a suscripciones
  compradas fuera (web u otras plataformas) **siempre que la app de iOS no
  incluya botones, enlaces ni llamadas a la acción que dirijan a la compra
  externa**.
- **3.1.3(e) / servicios B2B** — la suscripción la contrata una organización
  (la clínica) para su personal, no el consumidor individual dentro de la app.

La estrategia de la respuesta: contestar las cinco preguntas de forma directa y
dejar claro, con hechos verificables en el binario, que (1) quien paga es la
clínica, (2) la compra ocurre solo en la web, (3) los pacientes no pagan nada y
(4) la app iOS no contiene ninguna superficie de compra.

> **Nota de encuadre**: el argumento "cobramos por web porque la plataforma
> necesita soporte web" no se usa tal cual — Apple no acepta preferencias de
> facturación como justificación y puede sonar a elusión de la comisión. El
> mismo hecho se presenta como lo que es para la 3.1.3(b): Kengo es un
> **servicio multiplataforma** (web de escritorio + app móvil), la suscripción
> cubre el servicio completo y se contrata donde la clínica gestiona su
> administración, el navegador.

## 2. Evidencia en el código que respalda cada afirmación

| Afirmación | Evidencia |
|---|---|
| La suscripción es por clínica; los asientos facturables son fisios/admins, nunca pacientes | `convex/schema.ts` (tabla `clinicBilling`), `convex/_helpers/capacity.ts:34-35` |
| La compra ocurre solo en la web (Stripe Checkout hospedado, en navegador) | `convex/billing/actions.ts` (`createCheckoutSession`, `success_url` → `kengoapp.com/mi-clinica/suscripcion`) |
| Trial de 14 días sin tarjeta al crear la clínica | `convex/clinics/mutations.ts:86-92`, `convex/billing/actions.ts` (`STRIPE_TRIAL_DAYS ?? 14`) |
| Planes: Lonely 89 €, Smart 249 €, Medium 449 €, variante ilimitada, Enterprise >9 fisios por ventas | `convex/billing/_helpers.ts:28-53` (`PLANES`, `LIMITE_FISIOS_AUTOSERVICIO`) |
| El gating es en servidor y solo afecta a fisio/admin | `convex/_helpers/permissions.ts:196-210` (`requireActiveSubscription`) y sus usos en `plans/`, `routines/`, `assignments/`, `accessCodes/`… |
| En builds nativos toda la UI de decisión de compra está oculta y las acciones son no-op | `apps/app/src/app/core/billing/subscription.service.ts:39-58` (`pagosSoloWeb`, `bloqueadoEnNativo`), plantilla `features/clinica/pages/suscripcion/suscripcion.component.html`, tests en `subscription.service.spec.ts` |
| Cero StoreKit / IAP / RevenueCat | `package.json` (sin plugins de compra), sin entitlement `in-app-payments` |
| Los pacientes entran gratis por invitación y no ven billing | `features/onboarding/`, `convex/accessCodes/`, `subscription.service.ts:63-70` (query en `skip` para pacientes) |
| El paciente conserva acceso aunque la clínica deje de pagar | `core/guards/active-subscription.guard.ts` (comentario explícito) y copy de `suscripcion.component.html` |
| No se venden bienes físicos ni servicios dentro de la app | No existe tienda/reservas/pagos de paciente en `apps/app/src/app/features/` |

Matiz conocido y asumido: en nativo sí se muestra el **precio del plan actual
como estado de cuenta** y el botón de **cancelar** (cancelar no exige IAP). Son
información de cuenta, no CTAs de compra. Si Apple respondiera con un rechazo
3.1.1 explícito, el siguiente paso sería ocultar también esos importes en
nativo.

## 3. Respuesta para App Store Connect (pegar tal cual)

```
Thank you for reviewing Kengo. Happy to explain our business model.

Kengo is a business-to-business (B2B), multiplatform software service for
physiotherapy clinics, delivered through a web application and this mobile
app. A clinic subscribes to Kengo as a whole on our website — clinics run
their day-to-day administration (staff, billing, patient management) from the
web application on their desktop computers — and its staff (physiotherapists)
then use the app to build exercise-based treatment plans and follow up with
their patients. Patients are invited by their clinic and use the app
completely free of charge. Nothing is sold inside the app, on any platform.

Answers to your questions:

1. Who are the users that will use the paid subscriptions in the app?

Physiotherapy clinics (businesses), not individual consumers. The subscription
is contracted at clinic level by the clinic owner, and billable seats are the
clinic's professional staff (physiotherapists/admins). Patients — the end
consumers — never pay anything: they join by invitation from their clinic and
all of their features (guided exercise sessions, progress, pain log, chat with
their physiotherapist) are free, regardless of the clinic's payment status.

2. Where can users purchase the subscriptions that can be accessed in the app?

Exclusively on our website, kengoapp.com, in the browser, via Stripe-hosted
checkout, as a B2B purchase (Spanish tax ID and business billing address are
collected at checkout). The subscription covers the Kengo service as a whole
(web application and mobile app), consistent with guideline 3.1.3(b)
(multiplatform services): clinics contract and manage it where they run their
business administration, the web application on desktop. When a clinic
registers it automatically gets a 14-day free trial with no card required.
The iOS app contains no purchase flow of any kind: no checkout, no
buy/upgrade buttons, and no links or calls to action directing users to
purchase outside the app.

3. What specific types of previously purchased subscriptions can a user access
in the app?

The clinic subscription plans, sized by number of physiotherapists: Lonely
(1 physiotherapist), Smart (2-4), Medium (5-9), each with an optional
"unlimited patients" variant, plus custom enterprise agreements for larger
organizations (arranged directly with our sales team). "Access" in the app
simply means that staff members of a clinic with an active subscription can
use the professional tools; there is no content library or consumer digital
content being purchased or unlocked.

4. What paid content, subscriptions, or features are unlocked within the app
that do not use In-App Purchase?

The professional (clinic-side) tools are enabled by the clinic's subscription:
creating and editing treatment plans and routines, assigning them to patients,
inviting patients, and staff messaging. This is validated server-side against
the clinic's subscription status. Consistent with guideline 3.1.3, the app
itself sells nothing and contains no purchasing mechanism: in the native iOS
build all purchase-related UI is hidden, and the subscription screen only
shows the clinic's account status with the note that the subscription is
managed from the web version. Patient-side features are not gated at all.

5. Can users purchase physical goods or services together with digital content
in your app?

No. The app sells no physical goods and no services, and there is no bundling
of any kind. Clinics provide their in-person physiotherapy care entirely on
their own; Kengo is only the software tool they subscribe to (on the web) to
manage exercise plans and patient follow-up.

For your convenience, the review account provided in App Review Information
(review-fisio@kengoapp.com) belongs to a demo clinic with an active
subscription, so every professional feature can be reviewed; the second
account (review-paciente@kengoapp.com, password in the notes) shows the free
patient mode.

Please let us know if you need any further information.
```

## 4. Después de enviar

- Responder desde el hilo de la 2.1(b) en el Resolution Center (no hace falta
  binario nuevo: la build 7 ya cumple lo que se afirma).
- Si Apple contesta con un rechazo **3.1.1** pese a todo, el plan B es ocultar
  también en nativo los importes informativos (hero de `suscripcion`, hint de
  upgrade y subtítulo de `miclinica`) y re-enviar. Limpieza opcional sin
  relación con la respuesta: la ruta muerta `returnTo: "native"` de
  `createCheckoutSession` y el `billing-return.html` empaquetado en el IPA.
