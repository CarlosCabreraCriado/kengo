# Plan de pruebas — Stripe Production-Ready

> Guía completa para validar las **10 fases** del plan production-ready
> (`docs/PLAN_STRIPE_PRODUCTION_READY.md`) antes de promover el sistema a
> live. Pensado para ejecutarse de principio a fin: primero en modo **test**
> de Stripe, y solo cuando todo pase, **switch a live**.
>
> Complementa a `docs/TESTING_STRIPE.md` (que cubría el sistema antes del
> plan production-ready). Si una prueba aparece en ambos, este documento
> tiene prioridad.

---

## Estado del documento

| Sección                                  | Cobertura                            |
| ---------------------------------------- | ------------------------------------ |
| 1. Pre-requisitos y setup                | Cuentas, claves, herramientas        |
| 2. Configuración Stripe Dashboard (test) | Tax, wallets, Portal, webhooks       |
| 3. Validaciones por bloque               | 10 bloques (A–J) del plan            |
| 4. Escenarios multi-clínica              | Owner único de N clínicas            |
| 5. Validación fiscal España              | NIF/CIF, Stripe Tax, facturas        |
| 6. Robustez de webhooks                  | Idempotencia + ordering + dedup      |
| 7. Pruebas de regresión                  | El sistema previo sigue funcionando  |
| 8. Criterios de aceptación final         | Antes de pasar a live                |
| 9. Switch a producción                   | Pasos para promover a live mode      |
| 10. Rollback                             | Cómo revertir si algo va mal en live |

**Leyenda**:

- `[ ]` Pendiente
- `[~]` Bloqueado o no aplica en este entorno
- `[x]` Aprobado

---

## 1. Pre-requisitos y setup

### 1.1 Herramientas

- [ ] **Stripe CLI** instalado y autenticado contra la cuenta **test**
  ```bash
  brew install stripe/stripe-cli/stripe
  stripe login   # autorizar la cuenta test
  ```
- [ ] **Convex** local levantado: `npx convex dev`
- [ ] **App Angular** local: `npm start` (puerto 4200 por defecto)
- [ ] **Backend Node.js** local (si aplica para algún endpoint): `npm run start:backend`
- [ ] **Resend** API key configurada (o aceptar que los emails solo se loguean sin enviarse)
- [ ] **Convex Dashboard** abierto en pestaña aparte (para inspeccionar tablas)
- [ ] **Stripe Dashboard test** abierto en pestaña aparte

### 1.2 Variables de entorno (Convex deployment test)

| Variable                   | Valor de test                    | Notas                                       |
| -------------------------- | -------------------------------- | ------------------------------------------- |
| `STRIPE_SECRET_KEY`        | `sk_test_...`                    | Secret de la cuenta test                    |
| `STRIPE_WEBHOOK_SECRET`    | `whsec_...` (de `stripe listen`) | Temporal, durante la sesión                 |
| `STRIPE_PRICE_ID`          | `price_...` (tiered)             | Price con tramos 1→65€, 2-4→170€, 5-10→280€ |
| `STRIPE_TRIAL_DAYS`        | `14`                             | Trial estándar                              |
| `STRIPE_GRACE_PERIOD_DAYS` | `7`                              | Gracia tras `payment_failed`                |
| `KENGO_APP_URL`            | `http://localhost:4200`          | Sin slash final                             |
| `RESEND_API_KEY`           | (opcional)                       | Para emails reales                          |

- [ ] Confirmar las 7 variables presentes con `npx convex env list`

### 1.3 Forwarding del webhook

```bash
stripe listen \
  --forward-to http://localhost:8000/stripe/webhook \
  --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.trial_will_end,invoice.paid,invoice.payment_failed,checkout.session.completed
```

- [ ] CLI imprime `whsec_...` → copiarlo a `STRIPE_WEBHOOK_SECRET` en Convex
- [ ] CLI muestra los eventos llegando en tiempo real

### 1.4 Cuentas de prueba

Crear con antelación (en `npm start` test):

- [x] **Owner A** — `owner-a@test.kengo` (será propietario de Clínica A)
- [ ] **Admin A2** — `admin-a2@test.kengo` (co-admin no-owner de Clínica A)
- [ ] **Fisio A3** — `fisio-a3@test.kengo`
- [ ] **Owner B** — `owner-b@test.kengo` (mismo usuario que Owner A podría hacerlo, para test multi-clínica)
- [ ] **Paciente P1** — `paciente-p1@test.kengo` (asignado a Clínica A)
- [ ] **Paciente P2** — `paciente-p2@test.kengo` (asignado a Clínica B)

---

## 2. Configuración Stripe Dashboard (modo test)

### 2.1 Stripe Tax

- [ ] **Settings → Tax → Activate**
- [ ] Jurisdicción: España (IVA 21%)
- [ ] Default tax behavior: `inclusive` o `exclusive` según el precio del Price
- [ ] Confirmar que el price tiered tiene `tax_behavior` configurado

### 2.2 Wallets

- [ ] **Settings → Payment methods → Apple Pay → Activate**
- [ ] Verificación de dominio: subir `apple-developer-merchantid-domain-association` a `https://kengoapp.com/.well-known/` (o el dominio de test si aplica)
- [ ] **Settings → Payment methods → Google Pay → Activate**
- [ ] Confirmar que ambos aparecen como opciones disponibles en el price page de Stripe

### 2.3 Customer Portal

- [ ] **Settings → Customer Portal → Configure**
- [ ] **Customer information**: nombre y dirección editables ✅
- [ ] **Invoice history**: visible ✅
- [ ] **Payment methods**: añadir/eliminar/establecer default ✅
- [ ] **Subscriptions → Cancel**: permitir cancelación ✅, behavior `at_period_end`, no pedir motivo (decisión #16)
- [ ] **Subscriptions → Update plan**: **DESHABILITAR** (el plan se autorregula por quantity)
- [ ] Confirmar el dominio de redirect (`https://kengoapp.com/mi-clinica/suscripcion` o `localhost:4200`)

### 2.4 Webhook endpoint

- [ ] **Developers → Webhooks → Add endpoint**
- [ ] URL: tu Convex HTTP endpoint (`https://<deployment>.convex.cloud/stripe/webhook` o el túnel del CLI)
- [ ] Eventos: los 7 listados arriba
- [ ] Confirmar que el `Signing secret` coincide con `STRIPE_WEBHOOK_SECRET`

### 2.5 Sanity check inicial

- [ ] `stripe trigger payment_intent.created` debe llegar al webhook (`stripe listen` lo imprime)
- [ ] El log de Convex muestra el evento procesándose

---

## 3. Validaciones por bloque del plan

### 3.1 Bloque A — Robustez de webhooks (dedup + ordering)

**Objetivo**: garantizar que reentregas de Stripe no producen efectos colaterales duplicados y que eventos fuera de orden no sobrescriben estado más reciente.

#### 3.1.1 Dedup por `event.id`

- [x] Disparar un evento real (`stripe subscriptions update <sub_id> --metadata test_dedup=1` sobre la sub de Clínica A).
- [x] En el Stripe Dashboard → Developers → Events → seleccionar el evento → **Resend webhook**.
- [x] Verificar:
  - [x] **1 sola fila** nueva en `stripeWebhookEvents` con ese `eventId`.
  - [x] Log de Convex muestra `[stripe webhook] evento duplicado <id> — ignorado` en la segunda entrega.
  - [x] `clinicBilling.actualizadoEn` cambia solo una vez (no dos).
  - [~] Si el evento tenía efectos de email, **solo se envía un email** (Resend Dashboard). _(N/A para `subscription.updated`; se valida en Bloque G con `payment_failed`)_

#### 3.1.2 Ordering por timestamp

> **Nota metodológica**: el dedup por `event.id` (validado en 3.1.1) corta
> los _resend_ del Dashboard antes de llegar a la comprobación de ordering.
> Para ejercitar la rama "stale" hay que invocar `applySubscriptionEvent`
> directamente desde el Convex Dashboard con un `eventCreatedMs` inferior al
> `lastStripeEventMs` ya almacenado.

- [x] Provocar al menos un `customer.subscription.updated` real para sembrar `lastStripeEventMs` en `clinicBilling`.
- [x] Desde Convex Dashboard → Functions → `billing/internal:applySubscriptionEvent`, invocar con `eventCreatedMs` < `lastStripeEventMs` existente.
- [x] Verificar:
  - [x] Log de Convex muestra `[billing] applySubscriptionEvent stale (clinic=..., eventMs=X, lastMs=Y) — ignorado`.
  - [x] `clinicBilling` mantiene los valores previos (no se aplica patch): `actualizadoEn`, `lastStripeEventMs`, `estadoLocal` sin cambios.

#### 3.1.3 Resolución de `clinicId`

- [x] Disparar `invoice.payment_failed` (`stripe trigger invoice.payment_failed`) — genera un customer artificial pero permite probar la lógica de "ignorar sin error".
- [x] Verificar:
  - [x] Si el evento NO tiene `metadata.orgId` válido → ignorado sin error, pero **sí se registra en `stripeWebhookEvents`** (dedup activo).
  - [x] Si lo tiene → `clinicBilling.estadoLocal = "past_due"` (probado invocando `billing/internal:markPastDueWithGrace` directamente, ya que no podemos forzar un cobro fallido real sobre una sub en `trialing` sin payment method).
  - [x] Estado restaurado a `trialing` tras la prueba.

---

### 3.2 Bloque J — Propietario único

#### 3.2.1 Creación de clínica nueva asigna owner automáticamente

- [x] Como **Owner A** crear Clínica A en `/mi-clinica`.
- [x] Verificar en Convex Dashboard:
  - [x] `clinics` tiene la fila nueva con `ownerUserId = OwnerA._id`
  - [x] `clinicMemberships` tiene `{ userId: OwnerA, puesto: "admin" }` para esa clínica
  - [x] `clinicBilling.estadoLocal = "trialing"` (tras ~1s, cuando el scheduler ejecuta `startTrialForClinic`)
  - [x] Stripe Dashboard → customer con `metadata.orgId = <clinicId>`

#### 3.2.2 Transferencia de propiedad

- [x] Como Owner A, promocionar a Admin A2 a `admin` desde `/mi-clinica` → dialog del miembro → "Promocionar a administrador"
- [x] Abrir el dialog de Admin A2 → debe aparecer:
  - [x] Badge "Propietario" **NO** visible (todavía es Owner A)
  - [x] Botón **"Transferir propiedad"** visible (solo el owner lo ve)
- [x] Click "Transferir propiedad" → confirmar
- [x] Verificar:
  - [x] `clinics.ownerUserId` ahora apunta a Admin A2 (Convex Dashboard)
  - [x] Nueva fila en `clinicOwnershipAudit` con `via: "self"`, `fromUserId: OwnerA`, `toUserId: AdminA2`
  - [x] Toast "Propiedad transferida correctamente"
  - [x] Tras refrescar, Owner A ve el dialog de Admin A2 con badge "Propietario", botón de transferencia **ya no aparece** (Owner A ya no es owner)

#### 3.2.3 Owner intenta salir de la clínica sin transferir

- [x] Como Admin A2 (ya owner), intentar salir de la clínica (botón "Desvincular" no debería aparecer ya que `puedeDesvincular()` filtra `esOwnerTarget`).
- [~] **Negative test**: invocar directamente desde DevTools la mutation `clinicMemberships.remove` con el membership del owner → debe devolver código `OWNER_MUST_TRANSFER_FIRST`. _(diferido a Bloque B, que prueba el mismo guard)_

#### 3.2.4 Admin no-owner intenta gestionar billing

Como Owner A (después de transferir a Admin A2, A ya no es owner):

- [x] Entrar a `/mi-clinica/suscripcion`.
- [x] Verificar:
  - [x] **Banner informativo** "El responsable de la suscripción es {AdminA2}" visible
  - [x] **CTA principal oculto** (no aparece "Activar suscripción", "Gestionar pago", etc.)
  - [x] **Botón cancelar suscripción oculto**
  - [x] **Fila "Ver todas las facturas" oculta**
  - [x] Estado de la suscripción (badge, fecha de renovación, plan actual) **sí visible** (modo read-only)
- [x] **Negative test backend**: invocar directamente `api.billing.actions.createCheckoutSession` desde DevTools → debe devolver código `OWNER_REQUIRED`.

#### 3.2.5 Transferir a un fisio (no admin) → rechazo

- [x] Como Admin A2 (owner), intentar transferir propiedad al Fisio A3.
- [x] El selector del dialog **no debería listarlo** (solo lista admins) — al abrir el dialog de A3, el botón "Transferir propiedad" no aparece (requiere `puesto === 'admin'`).
- [~] **Negative test**: invocar `api.clinics.mutations.transferOwnership` con `toUserId: FisioA3._id` directamente → devuelve `OWNER_MUST_BE_ADMIN`. _(omitido: UI guard suficiente y mutation requiere auth de usuario)_

#### 3.2.6 Transferencia forzada por soporte

- [x] Desde Convex Dashboard → Functions → `clinics/mutations:forceTransferOwnership`:
  ```json
  {
    "clinicId": "<clinicId>",
    "toUserId": "<otherUserId>",
    "reason": "Owner abandonó la cuenta, verificado por email corporativo",
    "executedByAdminEmail": "soporte@kengoapp.com"
  }
  ```
- [x] Verificar:
  - [x] `clinics.ownerUserId` cambia
  - [x] Nueva fila en `clinicOwnershipAudit` con `via: "support"`, `reason`, `executedByAdminEmail`

---

### 3.3 Bloque B — Bloqueo del owner sin transferir

> **Modo de verificación**: auditoría de código (no hay UI que ejercite estas
> rutas y el Convex Dashboard no permite simular identidad de usuario para
> probar el guard end-to-end con bajo coste).

- [x] **Guard 1 — `clinicMemberships.add`** (degradación admin → fisio sobre el owner): `convex/clinicMemberships/mutations.ts:88-96` invoca `assertNotOwnerWithoutTransfer` cuando un admin baja de puesto y resulta ser el owner.
- [x] **Guard 2 — `clinicMemberships.remove`**: `convex/clinicMemberships/mutations.ts:156-158` invoca `assertNotOwnerWithoutTransfer` para admins.
- [x] **Helper `assertNotOwnerWithoutTransfer`** (`convex/_helpers/permissions.ts:123-130`) compara `clinic.ownerUserId === userId` y lanza `ConvexError({ code: "OWNER_MUST_TRANSFER_FIRST" })`.
- [x] Tras transferir a otro admin: los mismos guards dejan de disparar (el owner pasa a serlo otro), por lo que las rutas se desbloquean.

---

### 3.4 Bloque C — Stripe Tax + NIF/CIF + métodos de pago

#### 3.4.1 Checkout con tarjeta + NIF

- [x] Como Owner A, click "Activar suscripción" (o "Añadir método de pago" si trial).
- [x] En Stripe Checkout, verificar campos:
  - [x] **Tax ID** (NIF/CIF) presente y obligatorio (`required: "if_supported"`) — Stripe muestra "IVA de ES" por defecto, hay que seleccionar "ES NIF" manualmente (incidencia registrada, no bloqueante).
  - [x] **Address** se solicita y se guarda en el customer (tras fix `billing_address_collection: "required"`).
  - [~] **Apple Pay** visible si estás en Safari iOS o macOS con tarjeta configurada
  - [~] **Google Pay** visible si estás en Chrome con cuenta Google activa
- [x] Completar con `4242 4242 4242 4242`, NIF español válido, dirección España.
- [x] Tras el redirect:
  - [x] `clinicBilling.estadoLocal = "active"`
  - [x] Customer en Stripe tiene `name`, `address`, `tax_id` poblados
  - [x] Email de bienvenida llega con subject `[Kengo · Clínica A] Tu suscripción está activa`
  - [x] `clinicBilling.welcomeEmailSentAt` queda poblado

#### 3.4.2 Stripe Tax aplicado en factura

- [x] Stripe Dashboard → Subscription → Upcoming invoice
- [x] Verificar:
  - [x] Línea de IVA 21% (España) calculada automáticamente
  - [x] El total = subtotal + IVA
  - [x] La factura PDF (descargable desde Portal) muestra NIF/CIF, dirección y IVA

#### 3.4.3 Reactivar sin reenviar welcome

- [~] Cancelar suscripción → `canceled`. _(se valida en Bloque D)_
- [~] Reactivar desde la UI ("Reactivar suscripción"). _(se valida en Bloque D)_
- [~] Completar Checkout otra vez. _(se valida en Bloque D)_
- [~] Verificar:
  - [~] El email de bienvenida **NO** se reenvía (`welcomeEmailSentAt` ya estaba poblado, `notifyCheckoutCompleted` aborta). _(idempotencia ya validada en 3.4.1 setup mode + se re-valida en Bloque D)_

#### 3.4.4 Forzar método de pago nuevo (`payment_method_collection: 'always'`)

- [~] Cancelar suscripción. _(se valida en Bloque D)_
- [~] Reactivar → Stripe Checkout debe pedir un método de pago **nuevo** (no reutiliza el anterior automáticamente). _(se valida en Bloque D; `payment_method_collection: "always"` se mantiene en el branch subscription mode tras el fix de modos)_

---

### 3.5 Bloque D — Re-suscripción tras `canceled`

- [x] Tener una clínica con `estado = "canceled"` (cancelación definitiva, no `cancelAtPeriodEnd`).
  - Para forzarlo en test: `stripe subscriptions cancel sub_...` desde CLI.
- [x] Entrar a `/mi-clinica/suscripcion` como owner.
- [x] Verificar:
  - [x] El CTA muestra **"Reactivar suscripción"** (con icono `restart_alt`)
  - [x] Click abre Stripe Checkout (NO Customer Portal)
  - [x] El Checkout reusa el `stripeCustomerId` existente (no se crea uno nuevo)
  - [x] **NO** se aplica un nuevo trial (la suscripción nace en `active` tras el pago)
- [x] Tras pago exitoso:
  - [x] `clinicBilling.estadoLocal = "active"`
  - [x] `clinicBilling.stripeSubscriptionId` es uno nuevo (Stripe no permite reactivar una `canceled`, crea otra); el fix de `finalizeSubscriptionCheckout` lo persiste correctamente en local.
  - [x] El email welcome **no se reenvía** (idempotencia)

---

### 3.6 Bloque E — Aislamiento estricto por clínica destino

Setup: Owner A es admin de Clínica A (`active`) y Clínica B (`unpaid` — forzar con `setGraceUntilForTesting` + `checkGracePeriodsExpired`).

- [ ] Cambiar al contexto de Clínica B (switcher de avatar).
- [ ] Intentar crear una rutina **de clínica** en `/rutinas`.
- [ ] Verificar:
  - [ ] Backend devuelve `SUBSCRIPTION_INACTIVE` (porque B está unpaid)
  - [ ] La rutina NO se crea
- [ ] Cambiar al contexto de Clínica A → crear rutina de clínica.
  - [ ] Funciona, la rutina queda persistida con `clinicId = A`
- [ ] Crear rutina **privada** (no de clínica) desde cualquier contexto.
  - [ ] Funciona (el helper `requireAnyActiveSubscriptionForUser` permite porque A está activa)
- [ ] Validar que `routines.update` / `duplicate` aplican la misma regla:
  - [ ] Editar la rutina de Clínica B (que ya existía pre-suspensión) → rechazo `SUBSCRIPTION_INACTIVE`
  - [ ] Editar la rutina de Clínica A → ok

---

### 3.7 Bloque F — Chat con clínica suspendida

Setup: Clínica A en `unpaid`. Existe una conversación entre Paciente P1 y Fisio A3.

- [ ] Como **Fisio A3** abrir el chat con P1 → intentar enviar mensaje.
  - [ ] Backend devuelve `SUBSCRIPTION_INACTIVE`
  - [ ] UI muestra error (recomendado: banner inline "Reactiva la suscripción para volver a responder" — **pendiente de implementar como mejora UX**)
- [ ] Como **Paciente P1** abrir el mismo chat → enviar mensaje.
  - [ ] Mensaje se envía correctamente
  - [ ] Fisio recibe el mensaje en su bandeja (la conversación se actualiza)
- [ ] Tras reactivar Clínica A:
  - [ ] Fisio A3 ya puede responder

---

### 3.8 Bloque G — Emails dunning

Para cada email, comprobar **subject** + **cuerpo menciona `clinicaNombre`** + **destinatario es el owner determinista** (no un admin random).

#### 3.8.1 `trial_will_end`

- [ ] Acelerar el final del trial en Stripe (ajustar `trial_end` a +3 días desde Dashboard).
- [ ] Stripe dispara `customer.subscription.trial_will_end` automáticamente 3 días antes.
- [ ] Verificar email recibido:
  - [ ] Subject: `[Kengo · {clinicaNombre}] Tu periodo de prueba termina pronto`
  - [ ] Destinatario: email del `clinic.ownerUserId`
  - [ ] Cuerpo menciona `clinicaNombre`

#### 3.8.2 `payment_failed`

- [ ] Stripe Dashboard → cambiar método de pago a `4000 0000 0000 0341` (rechazo).
- [ ] Forzar cobro (Actions → Charge now).
- [ ] Verificar email:
  - [ ] Subject: `[Kengo · {clinicaNombre}] Hay un problema con el pago`
  - [ ] Destinatario: owner
  - [ ] Cuerpo menciona `clinicaNombre`

#### 3.8.3 `welcomeAfterCheckout`

- [ ] Tras Checkout exitoso (sección 3.4.1).
- [ ] Verificar email:
  - [ ] Subject: `[Kengo · {clinicaNombre}] Tu suscripción está activa`
  - [ ] Cuerpo menciona `clinicaNombre`

#### 3.8.4 `subscriptionCanceled`

- [ ] Cancelar suscripción definitivamente (no `at_period_end`).
- [ ] Verificar email:
  - [ ] Subject: `[Kengo · {clinicaNombre}] Suscripción cancelada`
  - [ ] Cuerpo menciona `clinicaNombre`
  - [ ] CTA "Reactivar suscripción" lleva a la app

#### 3.8.5 Idempotencia welcome tras reactivación

- [ ] Tras cancelar y reactivar (sección 3.4.3), comprobar que el welcome NO se reenvía.

---

### 3.9 Bloque H — UI multi-clínica

#### 3.9.1 Header con nombre de clínica

- [ ] Ir a `/mi-clinica/suscripcion` con Clínica A activa.
- [ ] Verificar:
  - [ ] El back-button muestra "Suscripción" + subtítulo "Clínica A"
- [ ] Cambiar al switcher → Clínica B activa.
- [ ] El header pasa a mostrar "Clínica B".

#### 3.9.2 Modo read-only para admins no-owner

(Ya cubierto en 3.2.4, listado aquí por completitud)

#### 3.9.3 Banner de bloqueo con nombre de clínica

- [ ] Forzar `unpaid` en Clínica A.
- [ ] Como **fisio** de Clínica A, intentar crear plan en `/planes/nuevo`.
- [ ] Redirige a `/mi-clinica/suscripcion?bloqueada=1`.
- [ ] El banner rojo muestra: **"La suscripción de Clínica A está suspendida"** (no genérico).
- [ ] Si el usuario es owner: CTA "Actualizar método de pago" visible.
- [ ] Si no es owner: mensaje "Avisa a {ownerNombre} para que actualice el método de pago" sin CTA.

#### 3.9.4 Modal éxito post-checkout con nombre

- [ ] Completar checkout y volver con `?ok=1`.
- [ ] Modal/card de éxito visible (puede ser ajustada a "Has activado la suscripción de {clinicaNombre}" — opcional UX).

---

### 3.10 Bloque I — Limpieza

- [ ] `tieneAccesoActivo()` eliminado de `subscription.service.ts`.
- [ ] Grep `tieneAccesoActivo` en `apps/app/src` → 0 resultados.
- [ ] (Opcional) Histórico de facturas paginado / con límite mayor a 6.

---

## 4. Escenarios multi-clínica (un owner gestiona N clínicas)

Setup:

- Owner X es **owner de Clínica X** (`active`)
- Owner X también es **admin (no-owner) de Clínica Y** (donde Owner Y es propietario)
- Owner X es **owner de Clínica Z** (`unpaid`)

- [ ] Stripe Dashboard tiene **3 customers distintos**, uno por clínica (X, Y, Z), cada uno con su `metadata.orgId` propio.
- [ ] Cada cliente tiene su propio `tax_id` y `address` (pueden ser entidades fiscales distintas).
- [ ] Owner X cambia entre clínicas con el switcher:
  - [ ] Clínica X activa → header `Clínica X`, ve CTAs (es owner)
  - [ ] Clínica Y activa → header `Clínica Y`, NO ve CTAs (no es owner) + banner "El responsable es Owner Y"
  - [ ] Clínica Z activa → header `Clínica Z`, banner rojo "La suscripción de Z está suspendida" + CTA "Actualizar pago" (es owner)
- [ ] Cancelar X → solo X pasa a `canceled`; Y sigue activa, Z sigue unpaid.
- [ ] Email de cancelación llega con subject `[Kengo · Clínica X] Suscripción cancelada` — distinguible de un email de Y o Z en bandeja.
- [ ] Intentar salir de X sin transferir → `OWNER_MUST_TRANSFER_FIRST`.
- [ ] Intentar salir de Y (no es owner) → permitido sin restricciones.
- [ ] Owner X transfiere X a otro admin de X → ya puede salir; los emails de billing de X van al nuevo owner; Z sigue dirigida a Owner X.

---

## 5. Validación fiscal España

- [ ] Generar al menos una factura real (Checkout completado).
- [ ] Stripe Dashboard → Customer → Invoice → PDF
- [ ] Verificar que la factura contiene:
  - [ ] **Razón social** (recogida en Checkout)
  - [ ] **NIF/CIF** (recogido vía `tax_id_collection`)
  - [ ] **Dirección fiscal completa**
  - [ ] **IVA 21%** desglosado (línea separada)
  - [ ] **Número de factura correlativo** (Stripe lo genera)
  - [ ] **Fecha de emisión**
  - [ ] **Datos del emisor** (Kengo / razón social configurada en Stripe Account settings)
- [ ] Descargar PDF desde Customer Portal → mismo contenido.

> **Nota legal**: este sistema cubre Stripe Tax (IVA automático) y datos
> fiscales mínimos B2B. **No incluye integración con Verifactu/SII de la
> AEAT** (fuera de scope, decisión #3). Si Kengo necesita facturación
> electrónica obligatoria por Ley Antifraude, debe integrarse con un
> proveedor externo (Quipu, B2Brouter, etc.) en una iniciativa separada.

---

## 6. Robustez de webhooks (transversal)

- [ ] **Reentrega manual**: Stripe Dashboard → Events → Resend webhook → no se duplica nada (ver 3.1.1).
- [ ] **Ordering**: eventos viejos no sobrescriben estado nuevo (ver 3.1.2).
- [ ] **Errores → retry de Stripe**: provocar un error en `onEvent` (p. ej. cambiar temporalmente un parámetro inválido) → Stripe reintenta automáticamente.
- [ ] **`stripeWebhookEvents`** crece con cada evento procesado y no contiene duplicados (consultar índice `by_eventId`).
- [ ] **Sin `metadata.orgId`**: eventos artificiales de `stripe trigger` no tienen `orgId` válido → se ignoran limpiamente (loggeados, no fallan).

---

## 7. Pruebas de regresión

Verificar que el sistema pre-existente sigue funcionando:

- [ ] **Onboarding de clínica nueva** (sección 3.1 del `TESTING_STRIPE.md` original)
- [ ] **Activación tras trial** (sección 3.2)
- [ ] **Escalado de tier por número de fisios** (sección 3.3)
- [ ] **Cancelación at_period_end + reactivación antes del fin** (Bloque D no afecta este flujo)
- [ ] **Pacientes acceden a sus rutinas con clínica suspendida** (sección 3.6)
- [ ] **+10 fisios → contactar ventas** (sección 3.7)
- [ ] **Cron de gracia** (sección 3.5 con `setGraceUntilForTesting`)

---

## 8. Criterios de aceptación final

Antes de promover a live, **todos** los checkbox de las secciones 1-7 deben estar marcados. Adicionalmente:

- [ ] `npx tsc --project convex/tsconfig.json --noEmit` → 0 errores
- [ ] `npx tsc --noEmit -p apps/app/tsconfig.app.json` → 0 errores
- [ ] `/verify` (script del proyecto) → 0 lint warnings nuevos
- [ ] **Backfill `clinics.ownerUserId`** ejecutado en staging con 0 clínicas huérfanas
- [ ] **Backfill `routines.clinicId`** ejecutado en staging con 0 rutinas huérfanas
- [ ] `clinics.ownerUserId` promovido a no-opcional en `schema.ts`
- [ ] Tabla `stripeWebhookEvents` existe y registra eventos
- [ ] Tabla `clinicOwnershipAudit` existe (puede estar vacía)
- [ ] Stripe Tax habilitado en cuenta test, IVA aparece en facturas
- [ ] Customer Portal configurado (cancel ✅, ver facturas ✅, update method ✅, change plan ❌)
- [ ] Apple Pay verificado en dominio
- [ ] Google Pay activo

---

## 9. Switch a producción (live mode)

Solo cuando los criterios de la sección 8 estén verdes.

### 9.1 Preparación

- [ ] **Stripe Dashboard → toggle a `Live mode`**
- [ ] Crear Product + Price tiered en live (1→65€, 2-4→170€, 5-10→280€) — idéntico a test
- [ ] Activar Stripe Tax en live
- [ ] Activar Apple Pay + Google Pay en live (re-verificar dominio si aplica)
- [ ] Configurar Customer Portal en live con la misma config que test
- [ ] Crear webhook endpoint en live apuntando al Convex prod (`https://<prod>.convex.cloud/stripe/webhook`)
- [ ] Copiar el nuevo `signing secret` para `STRIPE_WEBHOOK_SECRET` de prod

### 9.2 Convex prod — variables de entorno

- [ ] `STRIPE_SECRET_KEY` → `sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET` → `whsec_...` del endpoint live
- [ ] `STRIPE_PRICE_ID` → el price live (no el de test)
- [ ] `KENGO_APP_URL` → `https://kengoapp.com` (sin slash final)
- [ ] `STRIPE_TRIAL_DAYS`, `STRIPE_GRACE_PERIOD_DAYS`, `RESEND_API_KEY` → live values

### 9.3 Deploy + migraciones en prod

```bash
npx convex deploy
```

Luego desde Convex Dashboard prod (Functions → Run):

- [ ] **Dry-run** `migrations/backfillClinicOwner` con `{ "apply": false }`
- [ ] Revisar log de pendientes → resolver con `migrations/deleteClinicCascade` o promociones manuales
- [ ] **Aplicar** `migrations/backfillClinicOwner` con `{ "apply": true }`
- [ ] Confirmar 0 pendientes
- [ ] Si quedan: el campo `ownerUserId` en `schema.ts` ya es no-opcional → cualquier clínica sin owner romperá deploy. Resolverlas antes de continuar.

### 9.4 Smoke tests en live

Con una clínica real propia (o de un beta tester de confianza):

- [ ] Crear clínica nueva → trial activo en live
- [ ] Completar Checkout con tarjeta real (cargo mínimo, p.ej. 0,50€) o tarjeta de pruebas en live (`4242 4242 4242 4242` NO funciona en live — usar tarjeta real)
- [ ] Verificar email welcome
- [ ] Verificar factura con NIF/IVA correcto
- [ ] Cancelar y reactivar
- [ ] Asegurar que el cron de gracia (`03:30 UTC daily`) está activo en Convex prod

### 9.5 Monitorización inicial

- [ ] Activar alertas de **webhook failures** en Stripe Dashboard (Settings → Notifications)
- [ ] Stripe Dashboard → Sigma o Reports → revisar primeras facturas
- [ ] Convex prod → revisar logs diariamente durante la primera semana
- [ ] Verificar que `stripeWebhookEvents` crece sin duplicados

---

## 10. Rollback

Si algo va mal después del switch a live:

### 10.1 Bug crítico no destructivo

- [ ] Revertir el deploy de Convex: `npx convex deploy --rollback` o re-deploy de la rama anterior
- [ ] Stripe webhook endpoint sigue funcionando (los eventos quedan encolados en Stripe hasta 3 días)
- [ ] Una vez fix aplicado, Stripe reintenta automáticamente los eventos pendientes

### 10.2 Bug destructivo (datos corruptos)

- [ ] **No borrar `clinicBilling`** sin antes exportar.
- [ ] Convex Dashboard → tabla → Export
- [ ] Si datos de Stripe quedaron inconsistentes con los locales: comparar `stripeCustomerId` / `stripeSubscriptionId` entre ambos, reconciliar manualmente.

### 10.3 Rollback de propietario único

Si por alguna razón hay que volver a "cualquier admin puede gestionar billing":

- [ ] Revertir en `clinics/mutations.ts:transferOwnership` no es viable (los datos del audit ya están).
- [ ] Cambio mínimo: temporalmente en `billing/actions.ts`, sustituir `assertOwnerOnClinicByExternalId` por `assertAdminOnClinicByExternalId` en cada action (6 sitios). Desplegar.
- [ ] La invariante de schema `ownerUserId: v.id("users")` sigue activa, no rompe nada, simplemente cualquier admin podrá invocar las actions.

### 10.4 Cancelar suscripciones masivamente (emergencia)

Si hay un evento crítico que requiere parar facturación:

- [ ] Stripe Dashboard → Subscriptions → Bulk cancel (con `cancel_at_period_end: true` para no afectar el período actual)
- [ ] **NO** borrar customers en Stripe — perdería el histórico de facturas legalmente requerido.

---

## Apéndice — Comandos útiles

### Stripe CLI

```bash
# Listen al webhook local
stripe listen --forward-to http://localhost:8000/stripe/webhook

# Triggers automáticos (crean artefactos artificiales)
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.payment_failed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
stripe trigger checkout.session.completed

# Listar recursos
stripe customers list --limit 10
stripe subscriptions list --limit 10
stripe events list --limit 20

# Reenviar un evento concreto
stripe events resend evt_XXXXX
```

### Convex Dashboard — Funciones útiles

| Función                                     | Args                                                           | Propósito                               |
| ------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `migrations/backfillClinicOwner:run`        | `{ "apply": false }` o `true`                                  | Asignar `ownerUserId`                   |
| `migrations/deleteClinicCascade:inspect`    | `{ "clinicId": "..." }`                                        | Contar contenido de una clínica         |
| `migrations/deleteClinicCascade:run`        | `{ "clinicId", "confirmName", "apply": false }`                | Borrar clínica en cascada               |
| `migrations/backfillRoutineClinicId:run`    | `{}`                                                           | Asignar `clinicId` a rutinas históricas |
| `billing/internal:setGraceUntilForTesting`  | `{ "clinicId", "daysFromNow": -1 }`                            | Forzar gracia agotada                   |
| `billing/internal:checkGracePeriodsExpired` | `{}`                                                           | Disparar cron de gracia manualmente     |
| `clinics/mutations:forceTransferOwnership`  | `{ "clinicId", "toUserId", "reason", "executedByAdminEmail" }` | Transferir propiedad por soporte        |

### Tarjetas de prueba Stripe (test mode)

| Número                | Comportamiento                                                |
| --------------------- | ------------------------------------------------------------- |
| `4242 4242 4242 4242` | Success                                                       |
| `4000 0000 0000 0341` | Pago aprueba pero declina al cobrar (genera `payment_failed`) |
| `4000 0000 0000 9995` | Insufficient funds                                            |
| `4000 0025 0000 3155` | Requiere 3DS authentication                                   |

Más en https://stripe.com/docs/testing

---

## Errores detectados durante el testing

> Sección viva. Cada vez que durante una verificación se observe un
> comportamiento distinto al esperado, anotarlo aquí con: fecha, sección
> del test, descripción, severidad y estado.

| Fecha | Sección | Descripción | Severidad | Estado |
| ----- | ------- | ----------- | --------- | ------ |
| 2026-05-28 | 3.4.1 | Selector de Tax ID en Stripe Checkout muestra "IVA de ES" (`eu_vat`) como opción por defecto en lugar de "ES NIF" (`es_cif`) para clientes con `country=ES`. **No es configurable** vía API de Checkout (confirmado en docs oficiales). El usuario debe seleccionar manualmente "ES NIF" del desplegable. El dato se guarda correctamente y la factura sale bien. | Baja (UX) | Aceptado |
| 2026-05-28 | 3.4.1 | Stripe Checkout **NO pide la dirección fiscal completa** (street/CP/ciudad). Causa: `billing_address_collection` no está especificado, así que Stripe usa `"auto"` que con `automatic_tax: true` solo recoge los campos mínimos para calcular impuestos. Como nuestro `customer` ya viene con `address.country=ES` (baseline fijado en `startTrialForClinic` por commit 640f6e8), Stripe Tax considera que ya tiene suficiente y no pide el resto. **Esto incumple los requisitos de facturación B2B en España** (la factura debe llevar domicilio fiscal completo del cliente). Fix aplicado: añadido `billing_address_collection: "required"` en `convex/billing/actions.ts:createCheckoutSession` (commit pendiente). Validado: tras redeploy el Checkout pide street/CP/ciudad y la factura los muestra. | Alta (legal/factura) | Resuelto |
| 2026-05-28 | 3.4.1 | Checkout y factura muestran `"Producto × Cantidad N"` con la cantidad cruda de fisios (p.ej. "× 3" para una clínica en tramo 2-4 fisios). El **importe es correcto** (170€ flat del tramo), pero el cliente puede pensar que paga "3 unidades de algo" en vez de "el plan 2-4 fisios". Stripe no permite ocultar el campo `quantity` en subscription items. Fix aplicado (opción C): `convex/billing/actions.ts` ahora sincroniza `customer.invoice_settings.custom_fields = [{ name: "Plan", value: "Tramo 2-4 Fisios" }]` en `startTrialForClinic`, `createCheckoutSession` y `updateStripeQuantity`. La factura siguiente lleva ese campo en cabecera. Aplica solo a facturas futuras (no retroactivo). Pendiente: A+B (renombrar Product / añadir descripción) cuando el cliente lo prefiera. | Media (UX factura) | Fix aplicado, pendiente validación |
| 2026-05-28 | 3.4.3 | En `/mi-clinica/suscripcion`, una sub `trialing + cancel_at_period_end: true` mostraba el CTA "Añadir método de pago" y al pulsarlo abría un **Checkout nuevo** (creando una segunda subscription) en lugar de mostrar "Reactivar suscripción" y deshacer la cancelación de la existente. Causa: orden de comprobaciones en `accionPrincipal()` y `etiquetaAccionPrincipal()` evaluaba la rama `trialing` antes que `cancelaAlFinDelPeriodo()`, por lo que esta última nunca se alcanzaba para subs en trial con cancelación programada. El caso `active + cancel_at_period_end` funcionaba bien por casualidad (la rama `active` cae al default). Fix aplicado: `suscripcion.component.ts` reordena las comprobaciones priorizando `canceled` → `cancelaAlFinDelPeriodo()` → resto. | Alta (datos: creaba subs duplicadas) | Fix aplicado, pendiente validación |

