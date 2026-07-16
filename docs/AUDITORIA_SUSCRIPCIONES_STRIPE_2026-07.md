# Auditoría del flujo de suscripciones, trials e integración Stripe

**Fecha:** 2026-07-16
**Alcance:** flujo de compra, gestión de suscripciones, periodos de trial e integración con Stripe (backend Convex `convex/billing/*` + frontend Angular `apps/app/src/app/core/billing/*` + configuración Stripe **live** verificada vía API).
**Método:** lectura exhaustiva de código (3 auditorías especializadas: ciclo de vida, gating/seguridad, UX) + verificación en vivo contra la cuenta Stripe de producción (`acct_1TS1DOEa0q7bmfXj`) con clave restringida read-only.
**Estado de producción:** fase temprana — **2 suscripciones reales, ambas `active`, qty=1**, sin duplicados ni huérfanas todavía. La mayoría de los bugs de ciclo de vida son **latentes** (aún no se han manifestado porque no ha habido impagos, cancelaciones ni clínicas con >1 fisio). Esto da margen para corregir antes de que escalen.

---

## Veredicto ejecutivo

La arquitectura es **sólida en su diseño**: webhooks idempotentes, trial sin tarjeta, periodo de gracia, cron de expiración, self-heal de suscripciones huérfanas, atribución multiclínica y gating por `SUBSCRIPTION_INACTIVE`. El componente oficial `@convex-dev/stripe` verifica la firma del webhook correctamente y los secretos no están versionados.

**Pero hay 4 problemas CRÍTICOS que rompen el flujo end-to-end hoy mismo en producción**, más varios de seguridad/autorización graves que exceden el billing pero afloraron en la auditoría. Ninguno se ha manifestado aún por el bajo volumen, pero **el primer impago, la primera cancelación o el primer cliente que pague desde móvil los activará**.

### Checklist de configuración Stripe (live) — verificado vía API

| Elemento | Estado | Detalle |
|---|:---:|---|
| Secretos fuera del repo | ✅ | Claves solo en env de Convex; nada versionado |
| Firma de webhook | ✅ | El componente valida con `STRIPE_WEBHOOK_SECRET` (400 si falla) |
| Webhook endpoint activo | ✅ | `https://backend.kengoapp.com/stripe/webhook`, `status: enabled` |
| **Webhook API version** | ❌ | **`2026-04-22.dahlia`** → rompe la resolución de `invoice.*` (ver C-1) |
| Price tiered correcto | ⚠️ | `price_1TlcCh…` EUR, volume tiers 65€/170€/280€ ✓; pero anomalía a partir de 11 fisios (ver M-8) |
| Trial sin tarjeta | ✅ | `trial_settings.end_behavior.missing_payment_method: create_invoice` en las subs reales |
| `automatic_tax` en subs | ✅ | Activo en las 2 subs reales; `orgId` presente en metadata |
| **Customer Portal configurado** | ❌ | **0 configuraciones en live** → "Gestionar pago" falla (ver C-2) |
| **Stripe Tax con registros** | ❌ | Tax activo, sede en Canarias, pero **0 registros fiscales** → facturas con **0€ de impuesto** (ver H-3) |
| Dunning / Smart Retries | ❓ | No legible con la clave restringida; requiere revisión en Dashboard (ver M-9) |

---

## CRÍTICOS

### C-1 — El webhook usa API `2026-04-22.dahlia` y el código lee `invoice.subscription` (que ya no existe) → sin periodo de gracia, bloqueo instantáneo al primer impago

**Confirmado en vivo.** El endpoint está fijado a `2026-04-22.dahlia`. Desde la versión *basil* (2025-03-31) el campo `subscription` de la factura se movió a `invoice.parent.subscription_details.subscription`; ya no hay `subscription` en el nivel superior.

- **Evidencia:** `convex/http.ts:41-51` — `const invoice = event.data.object as { subscription?: string }`; `resolveClinicId` depende de ese campo para `invoice.paid` / `invoice.payment_failed`.
- **Escenario de fallo (real):** una clínica falla el cobro → Stripe emite `invoice.payment_failed` cuyo payload **no trae `subscription`** → `resolveClinicId` devuelve `undefined` → `if (!clinicId) return` (`http.ts:133`) → **`markPastDueWithGrace` nunca corre**: sin `graceUntil`, sin email de aviso. El estado `past_due` llega solo por `customer.subscription.updated` (que sí resuelve vía `metadata.orgId`), pero ese handler **no fija `graceUntil`** → `billingPermiteOperar` ve `past_due` sin gracia → **la clínica queda bloqueada de inmediato, con 0 días de gracia y sin ningún email**, justo lo contrario del diseño de 7 días.
- **Recomendación:** leer `invoice.parent?.subscription_details?.subscription ?? (invoice as any).subscription`, o resolver por `invoice.customer → metadata.orgId`. Añadir test del payload dahlia. Considerar además bajar la API version del endpoint a una alineada con el código, pero lo robusto es soportar el formato nuevo.

### C-2 — El Customer Portal no está configurado en live → "Gestionar pago / Actualizar método de pago / Cancelar" falla para todos los clientes activos

**Confirmado en vivo.** `GET /v1/billing_portal/configurations` devuelve **0 configuraciones** en modo live.

- **Evidencia:** `convex/billing/actions.ts:520-523` llama `stripeApi.createCustomerPortalSession(ctx, { customerId, returnUrl })` sin `configuration`. Stripe exige una configuración de portal guardada en live; sin ella, `billing_portal.sessions.create` lanza error.
- **Escenario de fallo (real, afecta a los 2 clientes actuales):** una clínica `active` pulsa "Gestionar pago" (`suscripcion.component.ts:230-258` enruta `active`/`past_due`/`unpaid` al Portal) → la action lanza → toast "No se pudo abrir el portal de gestión". **No pueden actualizar la tarjeta, ver facturas del portal ni cancelar desde la app.**
- **Recomendación:** configurar el Customer Portal en **Dashboard → Settings → Billing → Customer portal** (modo live): permitir actualización de método de pago, historial de facturas y cancelación (coherente con `cancelAtPeriodEnd`). Verificar tras guardar que `GET /v1/billing_portal/configurations` devuelve una config `is_default: true`.

### C-3 — El deep link nativo `kengo://billing/return` nunca hace match → el usuario se queda atrapado en el interstitial tras pagar en móvil

**Confirmado leyendo el código.** El listener construye `path` con `pathname + search + hash`, pero para un esquema custom el segmento tras `//` es el **host**, no el path.

- **Evidencia:** `apps/app/src/app/app.component.ts:349-350,359` — `new URL('kengo://billing/return?status=success')` → `host: "billing"`, `pathname: "/return"` → `path = "/return?status=success"` → `path.startsWith('/billing/return')` es **`false`**. Cae en `router.navigateByUrl('/return?...')`, que no es ninguna ruta (no hay wildcard en `app.routes.ts`); `externalBrowser.close()` nunca se ejecuta.
- **Escenario de fallo (real en iOS/Android):** el usuario completa el pago en Stripe Checkout → `billing-return.html` hace `location.replace('kengo://billing/return?status=success')` → la rama de billing no matchea → el SFSafariViewController / Custom Tab con el spinner "Volviendo a la app…" **queda encima de la app indefinidamente**. El cliente acaba de pagar y percibe que la app se colgó. (El mismo bug afecta a `kengo://magic`; en producción no se ha notado porque los magic links llegan como universal link `https://kengoapp.com/magic`.)
- **Recomendación:** normalizar el esquema custom antes de comparar, p. ej. `const path = parsed.protocol === 'kengo:' ? '/' + parsed.host + parsed.pathname + parsed.search : parsed.pathname + parsed.search + parsed.hash;` o directamente `event.url.startsWith('kengo://billing/return')`. Añadir test de parsing con ambas formas y **probar en dispositivo real**.

### C-4 — El dedup de webhooks marca el evento como procesado ANTES de procesarlo → eventos perdidos permanentemente ante cualquier fallo transitorio

- **Evidencia:** `convex/http.ts:65-79` ejecuta y commitea `recordWebhookEvent` antes del `switch`; `convex/billing/internal.ts:373-400` inserta y devuelve `skip:false`. Cada `ctx.runMutation` en una httpAction es una transacción independiente.
- **Escenario de fallo:** llega `invoice.payment_failed` → se registra (commit) → el handler falla (OCC agotado, deploy en curso, error transitorio) → `http.ts:180-184` re-lanza → Stripe reintenta → en el retry `recordWebhookEvent` devuelve `skip:true` → **el evento se descarta sin haberse aplicado jamás**. Aplica igual a `subscription.updated` (estado desincronizado permanente) y `checkout.session.completed` (trial nunca termina / subId de S2 nunca se persiste).
- **Recomendación:** registrar con estado `pending` y sellar `processedAt` en una mutación **al final**, tras el éxito; saltar solo si existe registro ya `processed`. Alternativa mínima: mover `recordWebhookEvent` después del `switch` y apoyarse en la idempotencia de las mutaciones destino (el riesgo de un email duplicado es mucho menor que el de un evento perdido).

---

## Seguridad / autorización (crítico, fuera del billing estricto pero surgido en la auditoría)

> Estos hallazgos no son de suscripciones, pero son **explotables por cualquier usuario autenticado** y se detectaron al recorrer las mutations. Se listan aquí porque su severidad lo exige.

### S-1 (CRÍTICO) — `accessTokens.create` permite generar un magic-link de acceso para CUALQUIER usuario → account takeover

- **Evidencia:** `convex/accessTokens/mutations.ts:21-64` recibe `userId` arbitrario; valida suscripción y permiso sobre `clinicId`, pero **nunca comprueba que `userId` tenga relación con el requester ni sea paciente de esa clínica**. El token produce una URL `/magic?t=…` que vía `consume-access-token` (`http.ts:458`) emite un login para el email de ese usuario.
- **Escenario:** un fisio llama `accessTokens.create({ userId: <admin de otra clínica>, clinicId: <la suya> })`, canjea la URL y **entra como la víctima**. Takeover completo.
- **Recomendación:** validar que `userId` es paciente en `clinicId` (patrón `assertCanAccessPaciente`) antes de crear el token. Igual en `sendByEmail` (`accessTokens/actions.ts:15`).

### S-2 (ALTO) — `clinicMemberships.add` / `remove` sin verificación de rol del actor → escalada de privilegios y sabotaje

- **Evidencia:** `convex/clinicMemberships/mutations.ts:168-174` (`add`: solo `getAuthenticatedUser` + gating de suscripción; **sin `checkClinicPermission`**) y `:258-262` (`remove`: sin check).
- **Escenario:** cualquier autenticado hace `add({ userId: <yo>, clinicId: <ajena>, puesto: "admin" })` → se autoconvierte en admin de una clínica ajena (acceso a pacientes, sube la quantity facturada); o `remove({ membershipId: <paciente ajeno> })` → cascada que cancela sus planes y borra assignments.
- **Recomendación:** exigir que el actor sea admin de `clinicId` en `add`, y admin de la clínica del membership **o** el propio `membership.userId` (autosalida) en `remove`. Comparar con `expelMember`/`expelPatient` (`:342`,`:403`), que sí validan.

### S-3 (ALTO) — `storage.deleteObject` borra cualquier objeto R2 sin autorización fina

- **Evidencia:** `convex/storage/actions.ts:86-104` — solo `getUserIdentity`; el propio comentario delega la authz "al caller", pero es una action pública invocable directamente.
- **Escenario:** `deleteObject({ key: "logos/<uuid-de-otra-clínica>" })` destruye assets ajenos.
- **Recomendación:** validar prefijo permitido y pertenencia antes de borrar.

### S-4 (ALTO) — `users.updatePatient` no ata el `patientId` a la clínica del fisio y reconcilia membresías globales

- **Evidencia:** `convex/users/mutations.ts:319-392` — valida permiso sobre `clinicId` pero no que `patientId` sea paciente de esa clínica; el bloque `clinicMemberships` (`:360-392`) borra/inserta membresías del target en **cualquier** clínica del array.
- **Recomendación:** exigir `assertCanAccessPaciente(patientId, clinicId)` y limitar la reconciliación a clínicas donde el actor tiene gestión.

### S-5 (MEDIO) — `sessions.complete` cierra y anota sesiones ajenas

- **Evidencia:** `convex/sessions/mutations.ts:82-116` — patchea `observacionesPaciente` (`:92`) **antes** de comprobar propiedad; nunca compara `session.pacienteId` con el usuario.
- **Recomendación:** cargar la sesión y exigir `session.pacienteId === user._id` antes de cualquier patch.

---

## ALTOS (billing)

### H-1 — Eventos de una suscripción zombi (S1) pisan el estado de la vigente (S2)

- **Evidencia:** `convex/http.ts:83-114` — ni `applySubscriptionEvent` ni `markCanceled` comparan `event.data.object.id` con `clinicBilling.stripeSubscriptionId`; se indexa solo por `clinicId` (`internal.ts:221-288`, `406-419`).
- **Escenario:** una clínica que reactivó con una S2 nueva recibe semanas después `customer.subscription.deleted` de la S1 antigua (misma `orgId`, timestamp más nuevo) → `markCanceled` → **clínica pagando queda bloqueada** + email de "suscripción cancelada" al owner que acaba de pagar.
- **Recomendación:** descartar (o solo loguear) eventos `customer.subscription.*` cuyo `id` no sea el `stripeSubscriptionId` vigente.

### H-2 — `createCheckoutSession` en `mode: subscription` sin guard de estado → segunda suscripción viva y doble cobro

- **Evidencia:** `convex/billing/actions.ts:438-479` — `useSetupMode = estado === "trialing"`; todo lo demás (incl. `past_due`, `unpaid`, `canceled`, `incomplete`, estado stale) va a `mode: subscription` sin cancelar la S1 previa.
- **Escenario:** clínica `unpaid` con S1 aún viva (dunning activo) → se crea S2 → los reintentos de S1 pueden cobrar con la nueva tarjeta → **dos subs cobrando a la vez** (y H-1 encima). Mitigado parcialmente porque la UI enruta `past_due`/`unpaid` al Portal, pero la action pública no lo impide y con estado stale la propia UI ofrece "Reactivar".
- **Recomendación:** antes de crear la S2, cancelar las subs `past_due`/`unpaid` residuales del customer, o rechazar con error semántico si ya hay una sub viva.

### H-3 — Stripe Tax activo con 0 registros fiscales → las facturas salen con 0€ de impuesto (sede en Canarias / IGIC)

**Confirmado en vivo.** Tax settings `status: active`, sede en Santa Cruz de Tenerife (Canarias), pero **0 registros fiscales activos**. Las facturas reales confirman: `total=6500, tax=None, automatic_tax.status=complete` → Stripe "calcula" impuesto 0 porque no hay registros donde recaudar.

- **Matiz relevante:** Canarias **no** está en el territorio IVA de la UE; aplica **IGIC** (7% general), que Stripe Tax soporta de forma limitada. Emitir SaaS B2B sin ninguna línea de impuesto puede ser un incumplimiento según las obligaciones de registro de la empresa.
- **Recomendación:** revisar con el asesor fiscal si corresponde registrar IGIC/IVA en Stripe Tax (o gestionar el impuesto fuera de Stripe) y si `tax_behavior` del price debe ser `inclusive`/`exclusive` en vez de `unspecified`. **Este punto es de negocio/legal, no de código** — señalado por su impacto.

### H-4 — `markPastDueWithGrace` resetea `graceUntil` en cada `payment_failed` → la gracia se extiende con cada reintento

- **Evidencia:** `convex/billing/internal.ts:436` fija `graceUntil = now + N días` incondicionalmente y reencola `notifyPaymentFailed` en cada evento.
- **Escenario:** con Smart Retries (~4 intentos en 2-3 semanas) la clínica opera ~3-4 semanas gratis en vez de 7 días, y el owner recibe un email por cada reintento. (Hoy es teórico porque C-1 impide que este handler corra; al arreglar C-1 emerge.)
- **Recomendación:** fijar `graceUntil` solo en la **transición** a `past_due` (`if (existing.estadoLocal !== "past_due") { … }`).

### H-5 — El ordering `lastStripeEventMs` no se aplica en `markCanceled` / `markActiveAfterPayment` / `markPastDueWithGrace`

- **Evidencia:** `internal.ts:406-419`, `463-479`, `426-457` — ninguno lee ni sella `lastStripeEventMs`; solo `applySubscriptionEvent` (`:239-249`) lo usa.
- **Escenario:** un `subscription.updated(active)` retrasado llega tras un `subscription.deleted` → se aplica → clínica marcada `active` con sub cancelada en Stripe (opera gratis para siempre). Simétrico: `past_due` viejo tras `invoice.paid` bloquea a quien pagó.
- **Recomendación:** sellar y comprobar `lastStripeEventMs` (con `eventCreatedMs`) en todos los handlers de estado.

### H-6 — Estados `canceled` / `incomplete` bloquean escritura en backend pero el frontend los trata como operativos

- **Evidencia:** `permissions.ts:168-184` (solo `trialing`/`active`/`past_due`-en-gracia/`null` permiten operar) vs `subscription.service.ts:116-122` (`bloqueada` solo con `unpaid` o `past_due` sin gracia) y `billing-banner.component.ts:151-210` (sin rama para `canceled`/`incomplete`).
- **Escenario:** clínica `canceled` → el fisio no ve banner, el guard le deja entrar a `/planes/nuevo`, monta un plan de 20 ejercicios y **al guardar** salta `SUBSCRIPTION_INACTIVE`. La peor UX: descubrir el bloqueo tras invertir el trabajo.
- **Recomendación:** alinear `bloqueada()` con `billingPermiteOperar` (bloquear `canceled`, `incomplete` y `none`-con-fila) y añadir rama de banner para esos estados.

### H-7 — `finalizeSetupCheckout` roto si el trial expira antes de completar el checkout; `trial_end: now` puede ir "in the past"

- **Evidencia:** `convex/billing/actions.ts:749-753` — `trial_end: Math.floor(Date.now()/1000)` sin comprobar el status de la sub ni pagar la invoice abierta.
- **Escenario:** el usuario abre el Checkout `trialing`, el trial expira (`create_invoice` → sub `past_due` con invoice abierta), completa el checkout → el PM se adjunta pero `update({ trial_end: now })` sobre una sub no-trialing no paga nada → **el cliente añadió tarjeta y sigue bloqueado** hasta el siguiente Smart Retry. Además `Math.floor(Date.now()/1000)` puede llegar ya en el pasado → `trial_end is in the past` intermitente (la scheduled action no se reintenta).
- **Recomendación:** usar el literal `trial_end: "now"` (soportado por el SDK) y, si `sub.status === "past_due"`, hacer `stripe.invoices.pay(latest_invoice)` con el PM nuevo en vez de tocar `trial_end`.

### H-8 — `ActiveSubscriptionGuard` tiene carrera: si la query de billing aún no emitió, deja pasar

- **Evidencia:** `active-subscription.guard.ts:23-35` espera `cargarMiUsuario()` pero no la primera emisión de `suscripcion()`; `bloqueada()` es `false` mientras `suscripcion()` es `undefined` (`subscription.service.ts:116-118`).
- **Escenario:** navegación directa a `/planes/nuevo` con clínica suspendida en cold start → el guard evalúa antes de que el watchQuery emita (300 ms-2 s) → entra al builder → bloqueado al guardar.
- **Recomendación:** esperar la primera emisión (`loading() === false`) con timeout defensivo.

### H-9 — Admin no-owner: la sección de facturas falla siempre, contradiciendo el copy de la pantalla

- **Evidencia:** `convex/billing/actions.ts:910-935` — `listInvoicesForClinic` exige owner (`assertOwnerOnClinicByExternalId`), pero `suscripcion.component.ts:192-203` la dispara para cualquier admin; el copy read-only (`suscripcion.component.html:18-22`) promete "puedes consultar… las facturas aquí".
- **Recomendación:** relajar la lectura de facturas a `checkClinicPermission(['admin'])`, o no invocar `cargarFacturas` cuando `!esOwner()` y ajustar el copy.

### H-10 — Doble click en el CTA principal dispara dos Checkout sessions

- **Evidencia:** `suscripcion.component.html:178-186` — `[loading]="loading()"` está cableado al `isLoading` del **watchQuery** (false en reposo), no al estado de la action; `subscription.service.ts:129-154` no tiene guard de reentrada.
- **Escenario:** la action tarda 1-3 s; dos clicks → dos sessions; en nativo dos `Browser.open` encadenados con glitch visual.
- **Recomendación:** señal `accionEnCurso = signal(false)` atada a `[loading]`/`[disabled]` de todos los CTAs de billing, con early-return.

---

## MEDIOS

### M-1 — `startTrialForClinic` sin retry ni saneo: si Stripe falla al crear la clínica, opera gratis para siempre y pierde el trial

- **Evidencia:** `convex/clinics/mutations.ts:88-92` (único `runAfter(0)`, at-most-once, sin retry); `permissions.ts:172` (`if (!billing) return true` → permisivo); `actions.ts:438-439` (sin fila → `estado "none"` → checkout `mode: subscription` **sin trial**).
- **Escenario:** Stripe caído 10 min durante un alta → no hay fila `clinicBilling` → nada la recrea → la clínica opera ilimitadamente gratis; y si el owner paga, se le crea sub sin los 14 días.
- **Recomendación:** cron diario de reconciliación "clínicas sin `clinicBilling` (o `estado none`) → reintentar `startTrialForClinic`"; en el catch de la action, registrar fila con flag de error.

### M-2 — `startTrialForClinic` no es idempotente frente a fallo parcial → subs de trial duplicadas

- **Evidencia:** `actions.ts:183-185` (idempotencia solo por `stripeSubscriptionId` local); `:215-232` (`subscriptions.create` **sin `idempotencyKey`**; solo lo tiene `createCustomer`).
- **Escenario:** la action crea la sub en Stripe y muere antes del `upsertClinicBilling` → un reintento manual / `extendTrialForClinic` crea una segunda sub trialing.
- **Recomendación:** `idempotencyKey: clinicId` en `subscriptions.create` y/o listar subs vivas antes de crear.

### M-3 — Carrera en el sync de quantity: la cantidad se congela al encolar, no al ejecutar

- **Evidencia:** `internal.ts:114-121` calcula `n` en la mutation y lo pasa como arg → `actions.ts:984-1012` lo usa tal cual. Convex no garantiza orden entre scheduled actions.
- **Escenario:** alta y baja casi simultáneas → Stripe puede quedar con la quantity equivocada hasta el siguiente cambio de plantilla; además el guard `cantidadFisios === n` (`:115`) suprime el sync correctivo.
- **Recomendación:** recomputar `n` dentro de `updateStripeQuantity` (vía `getBillingContext`) e ignorar el arg.

### M-4 — `clinicMemberships.add` no aplica el límite de autoservicio (>10) → infra-facturación silenciosa

- **Evidencia:** `clinicMemberships/mutations.ts:168-231` — sin check de `LIMITE_FISIOS_AUTOSERVICIO` (a diferencia de `accessCodes`); `syncQuantityFromMemberships` con n=11 solo marca `requiereContactoVentas` y **no toca Stripe** (`internal.ts:88-107`).
- **Escenario:** fisio nº 11 dado de alta vía `add` → Stripe factura 10 mientras trabajan 11, sin aviso operativo.
- **Recomendación:** replicar el throw `REQUIERE_CONTACTO_VENTAS` en `add` cuando el puesto es facturable.

### M-5 — `updateStripeQuantity` usa el subId local sin self-heal → la quantity nunca se sincroniza si el puntero está muerto

- **Evidencia:** `actions.ts:991-997` — no pasa por `resolveActiveSubscriptionId`.
- **Recomendación:** usar `resolveActiveSubscriptionId` también aquí.

### M-6 — El diálogo del gate manda al fisio no-admin a un dead-end

- **Evidencia:** `subscription-gate.service.ts:50-66` — mensaje único "reactiva la suscripción de tu clínica" + navegación a `/mi-clinica/suscripcion`, ruta con `ClinicAdminGuard` (`clinica.routes.ts:19`) que expulsa al fisio raso a `/inicio` con toast de permisos.
- **Recomendación:** bifurcar por `esAdminEnClinicaActiva()`: para no-admin, mensaje "Avisa a {ownerNombre} para reactivar la suscripción" sin CTA de navegación.

### M-7 — El banner usa `esAdmin()` global (admin en cualquier clínica), no de la clínica activa

- **Evidencia:** `billing-banner.component.ts:152` (`session.esAdmin()`) vs `session.service.ts:171-173` (some sobre todas las clínicas); el estado mostrado sí es el de la clínica activa.
- **Escenario:** (a) admin en A pero fisio en la activa B ve un banner cuyo CTA "Resolver" acaba en un empty state; (b) el fisio raso **nunca** ve el aviso de trial/suspensión (su primera noticia es el gate al guardar) — pese a que la query se abrió a fisios justamente para avisarles.
- **Recomendación:** usar `esAdminEnClinicaActiva()` para las variantes con CTA de pago y una variante informativa sin CTA para fisios no-admin.

### M-8 — Anomalía de precio a partir de 11 fisios (275€ < 280€ de 10 fisios)

**Confirmado en vivo.** El price tiene tiers `volume`: `up_to 1 → 6500`, `up_to 4 → 17000`, `up_to 10 → 28000`, y **resto → `unit_amount 2500`**.

- **Escenario:** con quantity=11 (alcanzable vía M-4), volume tiering aplica el último tier a todas las unidades → 11 × 25€ = **275€**, menos que los 280€ de 10 fisios. Además ese tier contradice el "contactar ventas" (precio a medida) para >10.
- **Recomendación:** decidir si el tramo >10 debe existir en el price (y con qué importe) o si debe bloquearse siempre por ventas; alinear con M-4.

### M-9 — `watchQuery` nunca emite error; retorno web sin limpiar query params ni reconciliación; dunning sin verificar

- **Evidencia:** `convex.service.ts:221-232` — `onUpdate` sin callback de error → la rama `@else if (error())` de la página es código muerto y un fallo de query = **spinner infinito**. `suscripcion.component.ts:171-180` — `?ok=1` no se limpia de la URL (la tarjeta "¡Suscripción activada!" reaparece al recargar) y `?cancel=1` no tiene representación. Si el webhook tarda/falla no hay polling ni botón de refresh.
- **Dunning:** no legible con la clave restringida; **verificar en Dashboard** el nº de reintentos y la acción final (`cancel`/`mark_unpaid`) para alinearlos con `STRIPE_GRACE_PERIOD_DAYS=7`.
- **Recomendación:** pasar `onError` a `onUpdate` y poblar la señal `error`; limpiar query params (`router.navigate([], { queryParams: {}, replaceUrl: true })`); añadir tarjeta neutra para `cancel`; considerar una action `syncFromStripe` de respaldo al volver con `ok=1`.

### M-10 — Al cambiar de clínica activa, el watchQuery muestra datos de la clínica anterior hasta la primera emisión

- **Evidencia:** `convex.service.ts:208-233` — al cambiar args pone `isLoading=true` pero **no resetea `value`** (solo en `skip`/logout).
- **Escenario:** cambiar de A (trial 2 días) a B (active) muestra ~200-800 ms el estado/nombre/facturas de A; con `bloqueada()` es un flash de "Suscripción suspendida" ajeno.
- **Recomendación:** `value.set(undefined)` al cambiar de args antes de re-suscribir.

---

## BAJOS

- **B-1** — `diasRestantesTrial` con `Math.ceil` sobre ventanas de 24 h: muestra "Trial · 1 **días**" (sin singular) y "termina en 1 día" cuando quedan 2 horas (`subscription.service.ts:79-84`, `suscripcion.component.html:106-108`). Usar días de calendario en TZ local y pluralizar.
- **B-2** — `Browser.close()` no implementado en Android (`external-browser.service.ts:42-50`, catch silencioso); relevante una vez arreglado C-3. Documentar o usar `@capacitor/inappbrowser`.
- **B-3** — `billing-return.html` no funciona sin JS: el fallback manual apunta a `href="#"` (`:64,73-74`). Hardcodear el deep link como href por defecto. (Copias iOS/Android verificadas idénticas con `diff`.)
- **B-4** — Doble toast si el fallback manual dispara además del redirect automático (`billing-return.html:74-78`). Flag de dedup en el listener.
- **B-5** — `requiereContactoVentas` nunca se limpia al bajar de >10 a ≤10 fisios (`internal.ts:88-107`). Patchear a `false` en la rama n ≤ límite.
- **B-6** — Guard `lastStripeEventMs >= eventCreatedMs` con resolución de 1 s descarta eventos distintos del mismo segundo (`internal.ts:243`). Usar `>` (la redelivery ya la cubre el dedup por `event.id`).
- **B-7** — `markActiveAfterPayment` ignora `estadoLocal: "unpaid"` (`internal.ts:471`): tras el bloqueo del día 7, un cobro tardío no reactiva vía `invoice.paid` (depende de `sub.updated`). Incluir `unpaid`.
- **B-8** — `checkGracePeriodsExpired` hace full scan de `clinicBilling` (`internal.ts:505`). Índice `by_estadoLocal_graceUntil` cuando crezca; no urgente.
- **B-9** — Migración enterprise inserta `estadoLocal: "none"` que **bloquea** clínicas >10 fisios de golpe (`migrations.ts:133-141` + `permissions.ts:168-184`). Introducir estado `enterprise_pending` permitido, o no insertar fila.
- **B-10** — `accessCodes.consume` de un código de fisio no exige suscripción activa (`accessCodes/mutations.ts:85-127`); `deactivate`/`reactivate`/`accessTokens.revoke` sin check de permisos de clínica. Añadir `requireActiveSubscription` (fisio) y check admin.
- **B-11** — Camino `auth.register` con código omite validaciones de `consume` (expiración, `usosMaximos`, email, sync de quantity) — `auth/mutations.ts:136-199`. Unificar en un helper compartido.
- **B-12** — `pdf.generatePlanPdf` sin gating (a diferencia de `generateAndSendPlanPdf`) y con efecto de escritura (mint de accessToken) — `pdf/actions.ts:715`. Añadir `assertActiveSubscriptionByPlanId`.
- **B-13** — `http /api/contact/send` sin rate-limit (`http.ts:539`): vector de spam vía Resend. Throttle/captcha.
- **B-14** — Accesibilidad: el banner no tiene `role="status"`/`aria-live` y el contraste de las variantes warning es dudoso (`billing-banner.component.ts:54-81`).
- **B-15** — Token JWT de Directus real versionado en `.claude/settings.local.json` (issuer `directus`, `admin_access:true`, expirado abr-2026). Rotar y sacarlo del control de versiones por higiene.

---

## Lo que está bien (verificado)

- Firma de webhook validada por el componente (400 si falla); errores re-lanzados → Stripe reintenta.
- Lectura de `current_period_end` desde `subscription.items.data[0]` (correcto para API 2025+); `trial_end` top-level.
- `metadata.orgId` presente en subs y checkout (ambos modos) — el agujero es solo `invoice.*` (C-1).
- Trial sin tarjeta con `end_behavior: create_invoice` correcto en las 2 subs reales.
- Gating por **owner** en todas las actions públicas de billing (`assertOwnerOnClinicByExternalId`).
- `getMyClinicSubscription` filtra por membership; no expone secretos de Stripe.
- Las dos reglas de "activa" (`permissions.ts` vs `billing/internal.ts`) son equivalentes para `past_due`+gracia, `null` y `active`/`trialing`.
- Welcome email idempotente (`welcomeEmailSentAt`); emails al owner determinista vía `clinics.ownerUserId`.
- `resolveActiveSubscriptionId` / `recoverClinicSubscriptionId` curan punteros a subs muertas (con un solo customer por clínica).
- `applyFeedbackBatch`, `executions.*`, `sessions.*` sin gating = **intencional** (acciones de paciente, que nunca deben bloquearse). Validado que `applyFeedbackBatch` es del paciente y comprueba ownership.
- Cobertura del sync de quantity en alta/baja/expulsión/canje/promoción de miembros.
- Copias de `billing-return.html` web/iOS/Android idénticas; esquema `kengo://` registrado en `Info.plist` y `AndroidManifest`.
- Price tiered correcto para 1-10 fisios (65€/170€/280€), EUR, mensual, producto activo con tax code SaaS.

---

## Roadmap de remediación sugerido

**Antes de captar más clientes (bloqueante):**
1. **C-2** configurar el Customer Portal en live (config de Dashboard, minutos).
2. **C-1** soportar el formato de invoice de la API dahlia (o resolver clinicId por customer).
3. **C-3** arreglar el parsing del deep link nativo + probar en dispositivo.
4. **S-1, S-2, S-3, S-4** cerrar los huecos de autorización (explotables hoy).

**Sprint siguiente (robustez del ciclo de vida):**
5. **C-4** dedup de webhook por efecto/`processedAt` final.
6. **H-1, H-2, H-5, H-7** correctitud de estados (sub vigente, doble sub, ordering, setup tardío).
7. **H-4** gracia no acumulativa; **H-6/H-8** alinear front con backend; **H-9/H-10** UX de billing.
8. **M-1, M-2** reconciliación e idempotencia del trial.

**Negocio/legal (paralelo):**
9. **H-3** decidir el tratamiento fiscal (IGIC/IVA) con asesoría; **M-8** revisar el tramo >10 del price; **M-9** verificar dunning en Dashboard.

**Higiene / menores:** el resto de M y B.

---

*Auditoría realizada con clave restringida read-only sobre live. Todas las llamadas a Stripe fueron GET; no se modificó ninguna configuración. **Recuerda revocar la clave restringida** (Dashboard → Developers → API keys) ahora que la auditoría terminó.*
