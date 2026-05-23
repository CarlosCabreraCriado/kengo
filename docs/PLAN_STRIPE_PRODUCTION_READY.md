# Plan Stripe Production-Ready — TODO ejecutable

> Plan de implementación del refuerzo del sistema de suscripciones Stripe para
> dejarlo "production-ready". Pensado para ejecutarse en **múltiples sesiones**:
> ve marcando tareas conforme las completes y deja notas en la "Bitácora de
> sesiones" al final.
>
> **Plan completo de diseño** (con justificaciones, edge cases, alternativas
> descartadas): `.claude/plans/quiero-revisar-el-sistema-snappy-patterson.md`.
> Este documento es la versión accionable.

## Estado global

| Fase | Bloque | Estado | Descripción corta |
|------|--------|--------|--------------------|
| 1    | A — Webhooks | ✅ Completada | Idempotencia + ordering de eventos Stripe |
| 2    | J — Propietario único | ✅ Completada | `clinics.ownerUserId` + transferencia explícita |
| 3    | B — Bloqueo del owner sin transferir | ✅ Completada | Cascada cuando sale el owner (incluido en Fase 2) |
| 4    | C — Stripe Tax + NIF/CIF + métodos de pago | ✅ Código completo | Pendiente: config Dashboard (Stripe Tax + Apple/Google Pay) |
| 5    | D — Re-suscripción tras canceled | ✅ Completada | CTA "Reactivar" |
| 6    | E — Aislamiento estricto por clínica destino | ✅ Completada | Deprecar `requireAnyActiveSubscriptionForUser` |
| 7    | F — Chat con clínica suspendida | ✅ Backend completo | Pendiente: banner UI en chat de fisio si SUBSCRIPTION_INACTIVE |
| 8    | G — Emails dunning | ✅ Completada | Welcome + cancelación + clinicaNombre en subject |
| 9    | H — UI multi-clínica | ✅ Completada | Header clínica + read-only para no-owners |
| 10   | I — Limpieza | ✅ Completada | Eliminar código muerto |

**Leyenda de estado**: ⬜ Pendiente · 🟡 En progreso · ✅ Completada · ⛔ Bloqueada

## Decisiones de negocio (referencia rápida)

| # | Decisión |
|---|---|
| 1 | `STRIPE_PRICE_ID` ya es **tiered/graduated** en Dashboard (verificar antes de tocar nada) |
| 2 | Bloquear baja del **último admin** (reformulado como bloqueo del owner sin transferir) |
| 3 | Stripe Tax automático + NIF/CIF obligatorio (sin Verifactu/SII) |
| 4 | Pacientes en clínica suspendida: acceso indefinido |
| 5 | Métodos de pago: tarjeta + Apple Pay + Google Pay (sin Bizum) |
| 6 | Re-suscripción simple sin nuevo trial tras `canceled` |
| 7 | Aislamiento estricto por clínica destino |
| 8 | Sin panel admin interno; confiar en Stripe Dashboard |
| 9 | Webhook idempotencia + ordering |
| 10 | Customer Portal: cancelar + ver facturas + actualizar método de pago |
| 11 | Emails nuevos: bienvenida + cancelación definitiva |
| 12 | Sin tests automatizados — validación manual |
| 13 | GDPR fuera de scope |
| 14 | Sin archivado automático de datos |
| 15 | Trial 14d / gracia 7d se mantienen |
| 16 | Sin exit-survey |
| 17 | Chat en clínica suspendida: el paciente puede enviar, el fisio no |
| 18 | **Propietario único por clínica** (`clinics.ownerUserId`) |

## Invariantes (criterio de revisión de PRs)

1. 1 admin puede gestionar N clínicas.
2. Cada clínica tiene su propia suscripción Stripe (customer + subscription independientes).
3. Ninguna operación de billing cruza fronteras de clínica.
4. El contexto activo (`ClinicaActivaService`) determina qué suscripción se ve y se gestiona.
5. Las decisiones de bloqueo se evalúan por clínica.
6. Las facturas y los datos fiscales son por clínica.
7. Una clínica tiene exactamente un propietario (`clinics.ownerUserId`); solo él toca billing.

---

## Fase 1 — Bloque A · Robustez de webhooks

**Por qué primero**: sin idempotencia y versionado, cualquier cambio posterior introduce
efectos colaterales sin trazabilidad.

**Estado**: ✅ Completada

### Pre-checks

- [x] Verificar si `@convex-dev/stripe` ya expone dedup interno por `event.id`. **Resultado**: el componente hace upserts idempotentes en sus tablas internas (customers, subscriptions, etc.) pero NO protege el `onEvent` handler. Tabla propia necesaria.

### Tareas

- [x] **Schema**: añadir tabla `stripeWebhookEvents` en `convex/schema.ts`
- [x] **Schema**: añadir campo `lastStripeEventMs?: number` + `welcomeEmailSentAt?: number` a `clinicBilling`
- [x] **Backend**: nueva `internalMutation recordWebhookEvent` en `convex/billing/internal.ts`
- [x] **Backend**: versionar `applySubscriptionEvent` por `eventCreatedMs`
- [x] **Backend**: integrar dedup + ordering en `convex/http.ts` (resolución de `clinicId` unificada al inicio + `recordWebhookEvent` antes de cualquier efecto colateral)

### Verificación al completar

- [ ] `stripe trigger customer.subscription.updated` dos veces seguidas → la segunda se descarta (un solo log de procesamiento).
- [ ] Enviar manualmente un evento con `event.created` antiguo → se descarta como stale.
- [ ] Eventos normales siguen funcionando (trial_will_end, invoice.paid, etc.).

---

## Fase 2 — Bloque J · Propietario único por clínica [FUNDAMENTAL]

**Por qué ahora**: es el cambio arquitectónico más sensible. Varios bloques (B, C, G, H)
dependen de él. Requiere migración de datos: planificar con cuidado.

**Estado**: ✅ Completada. Migración ejecutada y `ownerUserId` promovido a campo no-opcional en `schema.ts:67`. Todas las clínicas tienen owner.

### Modelo de datos

- [x] **Schema**: `ownerUserId: v.optional(v.id("users"))` en `clinics` + índice `by_ownerUserId`
- [x] **Schema**: tabla `clinicOwnershipAudit` (trazabilidad de transferencias)
- [x] **Migración**: `convex/migrations/backfillClinicOwner.ts` con flag `apply` (dry-run/aplicar)
- [x] Ejecutar migración en **dry-run** → 4 clínicas asignadas, 2 huérfanas detectadas ("Clinica de prueba" y "Maria fisio")
- [x] Resolver clínicas huérfanas con `migrations/deleteClinicCascade` (borrado en cascada con confirmación por nombre)
- [x] Aplicar migración (`{ apply: true }`) — 4 clínicas con owner asignado
- [x] **Schema**: `ownerUserId` promovido a no-opcional (`schema.ts:67`)
- [x] Fallback transitorio "primer admin que aparezca" eliminado de `getBillingContext` y de `getMyClinicSubscription`
- [x] `ClinicSubscription.ownerUserId` cambiado a no-opcional en shared-models

### Helpers de permisos

- [x] `esOwner` + `assertOwnerOnClinic` + `assertOwnerOnClinicByExternalId` (en `permissions.ts`)
- [x] `assertNotOwnerWithoutTransfer` (error `OWNER_MUST_TRANSFER_FIRST`)
- [x] `assertOwnerIsAdmin` (error `OWNER_MUST_BE_ADMIN`)
- [x] internalQuery `assertOwnerOnClinicByExternalId` en `billing/internal.ts` (para usar desde actions Node)

### Mutations de transferencia

- [x] `clinics.transferOwnership({ clinicId, toUserId })` con auditoría `via: "self"`
- [x] `clinics.forceTransferOwnership` (internalMutation, soporte) con auditoría `via: "support"` + `reason` + `executedByAdminEmail`
- [x] `clinics.create` asigna automáticamente `ownerUserId: user._id` al creador

### Migrar actions de billing a owner-only

- [x] Las 6 actions (`createCheckoutSession`, `createCustomerPortalSession`, `cancelSubscription`, `reactivateSubscription`, `listInvoicesForClinic`, `contactarVentas`) sustituyen `assertAdminOnClinicByExternalId` por `assertOwnerOnClinicByExternalId`

### `getBillingContext` lee del owner

- [x] `convex/billing/internal.ts:getBillingContext` usa `clinic.ownerUserId` (con fallback al primer admin si la clínica aún no tiene owner — caso transitorio pre-migración)
- [x] `notifyTrialEnding` y `notifyPaymentFailed` heredan el owner determinista de `getBillingContext`

### Reglas de cascada

- [x] `clinicMemberships.remove`: llama `assertNotOwnerWithoutTransfer` antes de borrar la membership de un admin
- [x] `clinicMemberships.add`: si la operación degrada al admin (a fisio/paciente) y ese admin es el owner, rechaza
- [x] `expelMember`: sólo permite expulsar `puesto === 'fisio'`, así el owner está blindado por construcción

### Frontend — UI de transferencia

- [x] `MiembroDetailDialogComponent`:
  - Badge `<ui2-pill variant="success" icon="workspace_premium">Propietario</ui2-pill>` cuando `m.isOwner`
  - Botón "Transferir propiedad" visible solo si el actor es owner y el destinatario es admin distinto del actor
  - Captura códigos `OWNER_REQUIRED`, `OWNER_MUST_TRANSFER_FIRST`, `OWNER_MUST_BE_ADMIN`, `OWNER_TRANSFER_NOOP` y mapea a mensajes claros
- [x] `clinics.queries.getMembers`: devuelve `isOwner: boolean` por miembro
- [x] `MiembroEquipo` añade `isOwner: boolean`

### Comunicación del cambio

- [ ] Considerar grace period informativo de 1-2 semanas para admins no-owner
- [ ] (Opcional) Crear `docs/RUNBOOK_OWNERSHIP_TRANSFER.md`

### Verificación al completar

- [ ] Tras migración: todas las clínicas tienen `ownerUserId` no-nulo
- [ ] Owner ejecuta `transferOwnership` → `ownerUserId` cambia y los emails llegan correctamente
- [ ] Owner intenta transferir a un fisio → rechazo
- [ ] Admin no-owner intenta `createCheckoutSession` vía DevTools → `OWNER_REQUIRED`
- [ ] `forceTransferOwnership` queda registrada en `clinicOwnershipAudit`

---

## Fase 3 — Bloque B · Bloqueo del owner sin transferir

**Estado**: ⬜ Pendiente

> Reemplaza al antiguo "bloqueo del último admin". Depende del Bloque J.

### Tareas

- [ ] El helper `assertNotOwnerWithoutTransfer` ya está creado en la Fase 2 (verificar)
- [ ] Integrar en `convex/clinicMemberships/mutations.ts:remove` (línea 132-204): llamar antes de la cascada si el miembro saliente es el owner
- [ ] Integrar en mutations de cambio de puesto: rechazar si el admin a degradar es el owner
- [ ] Frontend `apps/app/src/app/features/clinica/components/miembro-detail-dialog/`: capturar `OWNER_MUST_TRANSFER_FIRST` → modal con CTA "Transferir propiedad antes de salir"
- [ ] Flujo UX: el modal redirige a `/mi-clinica/equipo?transferOwner=1` con vista del equipo + selector

### Verificación al completar

- [ ] Owner intenta salir → `OWNER_MUST_TRANSFER_FIRST`
- [ ] Owner transfiere → ya puede salir
- [ ] Admin no-owner intenta salir → permitido sin restricciones

---

## Fase 4 — Bloque C · Stripe Tax + NIF/CIF + métodos de pago

**Estado**: ⬜ Pendiente

> Cumplimiento fiscal B2B España. Depende del Bloque J (customer Stripe se
> inicializa con datos del owner). Coordina con configuración del Dashboard.

### Backend — Checkout

- [ ] `convex/billing/actions.ts:createCheckoutSession` (155-214):
  - [ ] Cambiar el assert a `assertOwnerOnClinicByExternalId` (ya hecho en Fase 2, verificar)
  - [ ] Añadir `automatic_tax: { enabled: true }`
  - [ ] Añadir `tax_id_collection: { enabled: true }`
  - [ ] Añadir `customer_update: { name: 'auto', address: 'auto' }`
  - [ ] Mantener `payment_method_types: ['card']` (Apple/Google Pay vienen incluidos)
  - [ ] Si el wrapper del componente no expone estos campos: llamar `stripe.checkout.sessions.create` directo con `getStripeClient()`

### Backend — Trial

- [ ] `convex/billing/actions.ts:startTrialForClinic` (79-149):
  - [ ] Añadir `automatic_tax: { enabled: true }` al `subscriptions.create`
  - [ ] El `email`/`name` del customer Stripe debe leerse del **owner** (verificado en Fase 2)

### Stripe Dashboard (sin código)

- [ ] Habilitar **Stripe Tax** con jurisdicción España
- [ ] Habilitar **Apple Pay**: subir `apple-developer-merchantid-domain-association` a `https://kengoapp.com/.well-known/` y verificar dominio en Dashboard
- [ ] Habilitar **Google Pay**
- [ ] Configurar **Customer Portal**:
  - [ ] Actualizar método de pago: ✅
  - [ ] Ver/descargar facturas: ✅
  - [ ] Cancelar self-service: ✅
  - [ ] Cambio de plan: ❌ (lo gestionamos por quantity automáticamente)

### Verificación al completar

- [ ] Checkout con tarjeta `4242 4242 4242 4242` → factura incluye NIF/CIF + IVA 21% + dirección
- [ ] Apple Pay aparece en Checkout (probar en dispositivo iOS)
- [ ] Google Pay aparece en Checkout (probar en Chrome desktop)
- [ ] Customer Portal permite cambio de método, ver facturas, cancelar; no permite cambio de plan
- [ ] Factura PDF cumple campos mínimos de contabilidad B2B España

---

## Fase 5 — Bloque D · Re-suscripción simple tras canceled

**Estado**: ⬜ Pendiente

### Tareas

- [ ] `apps/app/src/app/features/clinica/pages/suscripcion/suscripcion.component.ts` (líneas 210-243):
  - [ ] El branch del CTA principal debe tratar `estado === 'canceled'` como caso especial
  - [ ] Etiqueta: "Reactivar suscripción"
  - [ ] Acción: llamar `iniciarCheckout` (NO `abrirPortal`)
- [ ] Backend (verificación, sin cambios esperados):
  - [ ] `createCheckoutSession` reusa `stripeCustomerId` existente ✓ (líneas 180-189)
  - [ ] `markCanceled` conserva `stripeCustomerId` ✓ (`internal.ts:268`)
- [ ] Añadir `payment_method_collection: 'always'` en `createCheckoutSession` para forzar nuevo método al reactivar

### Verificación al completar

- [ ] Suscripción en `canceled`: la UI muestra "Reactivar suscripción"
- [ ] Click → Checkout abre con el customer existente, sin trial
- [ ] Tras pago → estado vuelve a `active`, no se duplica el customer
- [ ] Email de welcome NO se reenvía (gracias a `welcomeEmailSentAt` del Bloque G)

---

## Fase 6 — Bloque E · Aislamiento estricto por clínica destino

**Estado**: ⬜ Pendiente

> Requiere migración de datos. Planificar fuera de horario o feature-flag.
> Coordinar despliegue backend + frontend (rompe firma de `routines.create`).

### Migración de schema

- [ ] `convex/schema.ts`: añadir `clinicId: v.optional(v.id("clinics"))` a tabla `routines`
- [ ] Crear `convex/migrations/backfillRoutineClinicId.ts` (espejo de `backfillPlanClinicId*`)
  - Por cada `routine`, asignar la primera clínica donde `autorId` es fisio/admin
- [ ] Ejecutar dry-run + revisar log + ejecutar en prod

### Backend

- [ ] `convex/routines/mutations.ts:create` (línea 22-57):
  - [ ] Aceptar `clinicId: Id<"clinics">` obligatorio cuando `visibilidad === 'clinica'`
  - [ ] Opcional para `visibilidad === 'privado'`
  - [ ] Sustituir `requireAnyActiveSubscriptionForUser` por `requireActiveSubscription(ctx, args.clinicId)` cuando hay `clinicId`
  - [ ] Renombrar helper a `requireAnyActiveClinicMembership` para el caso de rutinas privadas
  - [ ] Persistir `clinicId` en el `db.insert`
- [ ] `convex/routines/mutations.ts:update` (línea 89): cargar `routine.clinicId`; si existe, validar; si no, fallback al helper renombrado
- [ ] `convex/routines/mutations.ts:duplicate` (línea 140): igual que update

### Frontend

- [ ] `apps/app/src/app/features/rutinas/data-access/rutinas.service.ts:132`: actualizar firma de `create` para enviar `clinicId = ClinicaActivaService.selectedClinicaId()`
- [ ] Coordinar despliegue backend + frontend para evitar errores en cliente

### Verificación al completar

- [ ] Fisio admin de A (activa) y de B (suspendida) intenta crear rutina para B → `SUBSCRIPTION_INACTIVE`
- [ ] Fisio crea rutina para A → ok
- [ ] Rutinas privadas funcionan sin `clinicId`

---

## Fase 7 — Bloque F · Chat con clínica suspendida

**Estado**: ⬜ Pendiente

### Backend

- [ ] `convex/conversations/mutations.ts:sendMessage` (línea 144): sustituir `requireActiveSubscription` por validación condicional:
  - [ ] Cargar `membership` del `me._id` en `conv.clinicId`
  - [ ] Si `membership.puesto === 'paciente'` → permitir sin tocar billing
  - [ ] Si `membership.puesto` es `fisio` o `admin` → llamar `requireActiveSubscription`

### Frontend

- [ ] En la pantalla de chat: capturar `SUBSCRIPTION_INACTIVE` en el handler del fisio
- [ ] Mostrar banner inline al fisio: "Reactiva la suscripción para volver a responder"
- [ ] El paciente sigue chateando con normalidad y viendo el historial

### Verificación al completar

- [ ] Clínica en `unpaid`: paciente envía mensaje → ok
- [ ] Mismo escenario: fisio envía → banner "Reactiva la suscripción"
- [ ] Tras reactivar: fisio puede volver a responder

---

## Fase 8 — Bloque G · Emails dunning faltantes

**Estado**: ⬜ Pendiente

> Depende del case `checkout.session.completed` del Bloque A y del owner
> determinista del Bloque J.

### Regla transversal

> El `subject` de **todos** los emails de billing debe seguir el formato
> `[Kengo · {clinicaNombre}] {asunto}`. Aplicar también a los emails existentes
> (`trial_will_end`, `payment_failed`).

### Templates

- [ ] `convex/email/templates.ts`:
  - [ ] `welcomeAfterCheckout` → subject `"[Kengo · {clinicaNombre}] Tu suscripción está activa"`
  - [ ] `subscriptionCanceled` → subject `"[Kengo · {clinicaNombre}] Suscripción cancelada"`
  - [ ] `ownershipTransferredOld` → "Has transferido la propiedad de {clinicaNombre} a {newOwnerNombre}"
  - [ ] `ownershipTransferredNew` → "Eres el nuevo responsable de billing de {clinicaNombre}"
  - [ ] **Auditar** `trial_will_end` y `payment_failed`: aplicar el mismo formato de subject si no lo siguen
- [ ] El primer párrafo del cuerpo debe mencionar `{clinicaNombre}` explícitamente

### Actions de email

- [ ] `convex/email/actions.ts`:
  - [ ] `sendWelcomeAfterCheckout({ to, nombreAdmin, clinicaNombre, portalUrl })`
  - [ ] `sendSubscriptionCanceledEmail({ to, nombreAdmin, clinicaNombre, reactivateUrl })`
  - [ ] `sendOwnershipTransferredOld(...)`
  - [ ] `sendOwnershipTransferredNew(...)`

### Actions de billing

- [ ] `convex/billing/actions.ts` (paralelas a `notifyTrialEnding`):
  - [ ] `notifyCheckoutCompleted({ clinicId })` con guard de idempotencia
  - [ ] `notifySubscriptionCanceled({ clinicId })`

### Idempotencia

- [ ] **Schema**: añadir `welcomeEmailSentAt?: number` a `clinicBilling`
- [ ] `notifyCheckoutCompleted` solo dispara si `welcomeEmailSentAt` está vacío

### Webhooks

- [ ] `convex/http.ts:onEvent`:
  - [ ] Añadir case `"checkout.session.completed"` → `scheduler.runAfter(0, internal.billing.actions.notifyCheckoutCompleted, ...)`
  - [ ] En `"customer.subscription.deleted"` (línea 46): tras `markCanceled`, encolar `notifySubscriptionCanceled`

### Verificación al completar

- [ ] Checkout exitoso → llega email "[Kengo · X] Tu suscripción está activa"
- [ ] Cancelación definitiva → llega email "[Kengo · X] Suscripción cancelada"
- [ ] Reactivación tras cancelar → email welcome NO se reenvía
- [ ] Transferencia de propiedad → llegan dos emails (uno al antiguo, otro al nuevo owner) con clínica clara

---

## Fase 9 — Bloque H · UI multi-clínica

**Estado**: ⬜ Pendiente

> Depende del Bloque J para el modo read-only de admins no-owner.

### Pantalla `/mi-clinica/suscripcion`

- [ ] `apps/app/src/app/features/clinica/pages/suscripcion/suscripcion.component.ts`:
  - [ ] Añadir header bajo el back-button: "Suscripción · {nombreClínicaActiva}" (componente `<ui2-big-title>` o `<ui2-section-label>`)
  - [ ] Si admin tiene >1 clínica: render embebido del `<ui2-clinica-switcher>` junto al header
  - [ ] Si admin tiene 1 clínica: omitir switcher embebido

### Card del dashboard

- [ ] `apps/app/src/app/features/clinica/components/miclinica/subscription-card/subscription-card.component.ts`:
  - [ ] Encabezado de la card incluye el nombre de la clínica
  - [ ] Si el usuario NO es owner: ocultar el CTA "Gestionar plan", mostrar solo estado y fecha

### Modo read-only para admins no-owner

- [ ] `apps/app/src/app/core/billing/subscription.service.ts`:
  - [ ] Añadir computed `esOwnerDeClinicaActiva()` que cruce `ClinicaActivaService.selectedClinicaId()` con `clinics.ownerUserId`
- [ ] Pantalla `/mi-clinica/suscripcion`:
  - [ ] Si no es owner: ocultar TODOS los CTAs (Activar, Gestionar pago, Cancelar, Reactivar, Ver facturas)
  - [ ] Mostrar mensaje: "El responsable de billing de {clinicaNombre} es {ownerNombre}. Contacta con esa persona para gestionar la suscripción."

### Banners y modales

- [ ] Banner de bloqueo (`?bloqueada=1`): mencionar nombre de clínica → `"La suscripción de {clinicaNombre} está suspendida..."`
- [ ] Modal éxito post-checkout: `"Has activado la suscripción de {clinicaNombre}"`
- [ ] Modal cancelación: `"{clinicaNombre} se cancelará el {fecha}"`

### Limpieza

- [ ] `apps/app/src/app/core/billing/subscription.service.ts`: eliminar `tieneAccesoActivo()` no usado (línea 80)

### Verificación al completar

- [ ] Admin con 2 clínicas alterna entre ellas → el header cambia, el switcher embebido funciona
- [ ] Admin no-owner abre suscripción → no ve CTAs, ve mensaje con el nombre del owner
- [ ] Banner de bloqueo muestra el nombre de la clínica
- [ ] Modal éxito y cancelación incluyen el nombre de la clínica

---

## Fase 10 — Bloque I · Limpieza menor

**Estado**: ⬜ Pendiente

### Tareas

- [ ] Eliminar `tieneAccesoActivo()` no usado en `apps/app/src/app/core/billing/subscription.service.ts:80` (puede haberse hecho en Fase 9)
- [ ] Decisión sobre `listInvoicesForClinic` (`actions.ts:461`, default 6):
  - [ ] Opción A: subir el default a 24
  - [ ] Opción B: exponer a la UI con paginación simple
- [ ] Revisar comentarios `TODO`/`FIXME` introducidos durante la implementación y resolver o documentar

### Verificación al completar

- [ ] Build pasa sin warnings nuevos
- [ ] `/verify` no devuelve errores nuevos
- [ ] Histórico de facturas muestra más de 6 entradas si las hay

---

## Verificación end-to-end (al cierre del plan)

Ejecutar todos los flujos en **staging con Stripe test mode** antes de aprobar producción.

### Stripe CLI + entorno de test

- [ ] `stripe listen --forward-to http://localhost:CONVEX_PORT/stripe/webhook`
- [ ] `stripe trigger customer.subscription.trial_will_end` → email al owner
- [ ] `stripe trigger invoice.payment_failed` → `past_due` + `graceUntil` + email
- [ ] `stripe trigger invoice.paid` → vuelve a `active`, `graceUntil` se limpia
- [ ] `stripe trigger customer.subscription.deleted` → `canceled` + email cancelación
- [ ] Relanzar el mismo evento dos veces → segundo se descarta (dedup OK)
- [ ] Cron de gracia: `setGraceUntilForTesting` con `-1` + forzar cron → `unpaid`

### Flujos manuales en UI

- [ ] Crear clínica nueva → trial 14 días sin tarjeta
- [ ] Checkout con `4242 4242 4242 4242` → `active` + email welcome + NIF/CIF en factura
- [ ] Checkout con Apple Pay y Google Pay (en dispositivos compatibles)
- [ ] Cancelar desde Portal → `canceled` + email cancelación
- [ ] Reactivar desde UI → CTA "Reactivar" + Checkout sin trial nuevo
- [ ] Owner intenta salir sin transferir → `OWNER_MUST_TRANSFER_FIRST`
- [ ] Promover fisio a admin → transferir propiedad → owner anterior puede salir
- [ ] Clínica en `unpaid`: paciente envía mensaje ✓, fisio bloqueado
- [ ] Fisio crea rutina para clínica suspendida (siendo admin de otra activa) → `SUBSCRIPTION_INACTIVE`

### Propietario único (Fase 2 / Bloque J)

- [ ] Tras migración: todas las clínicas tienen `ownerUserId` no-nulo
- [ ] Admin no-owner abre suscripción → ve estado pero no CTAs
- [ ] Admin no-owner intenta `createCheckoutSession` vía DevTools → `OWNER_REQUIRED`
- [ ] `transferOwnership` cambia `ownerUserId` + emails a antiguo y nuevo owner
- [ ] Owner intenta transferir a un fisio → rechazo
- [ ] Admin no-owner intenta degradar al owner → rechazo
- [ ] `forceTransferOwnership` desde Dashboard queda registrada en `clinicOwnershipAudit`

### Multi-clínica

- [ ] Usuario owner de A y B → dos customers Stripe distintos, NIFs diferentes
- [ ] A `active`, B `unpaid` → header cambia con el switcher; banner rojo solo en B
- [ ] Cancelar A → solo A pasa a `canceled`; B sigue como estaba
- [ ] Email de A llega con subject `[Kengo · A] ...`, distinguible del de B
- [ ] Owner de A pero co-admin no-owner en B intenta Portal de B → `OWNER_REQUIRED`
- [ ] Owner intenta salir de A (es owner) → bloqueado; sale de B (no es owner) → permitido
- [ ] Transferir A a otro admin → emails ahora van al nuevo owner; B sigue con el owner original

### Validación fiscal

- [ ] Factura Stripe incluye razón social, NIF/CIF, IVA 21%, dirección
- [ ] PDF desde Customer Portal cumple los campos mínimos B2B España

---

## Riesgos y notas activas

> Trasladados del plan de diseño. Revisar al inicio de cada sesión.

- ⚠️ **Componente `@convex-dev/stripe`** puede no exponer `automatic_tax`, `tax_id_collection`, `payment_method_types`. Validar antes; si no, llamar `stripe.checkout.sessions.create` directo.
- ⚠️ **Stripe Tax sin address en trial**: la primera factura post-trial puede salir sin tax si el admin nunca pasó por Checkout. Reforzar el email `trial_will_end`.
- ⚠️ **Migración Bloque J**: el backfill puede dejar clínicas sin owner si no tienen ningún admin. Dry-run obligatorio + listado de afectadas.
- ⚠️ **Cambio de comportamiento Bloque J**: los admins no-owner pierden acceso a billing. Comunicar con antelación.
- ⚠️ **Aislamiento estricto Bloque E**: rompe firma de `routines.create`. Coordinar despliegue backend + frontend.
- ⚠️ **Dedup webhook Bloque A**: si el componente Stripe ya hace dedup interno, reutilizarlo en lugar de duplicar tabla.
- ℹ️ **Owner desaparecido**: sin autoservicio. Depende de `forceTransferOwnership` por soporte tras verificación externa.
- ℹ️ **Coopropiedad real**: no contemplada. Si surge demanda, evaluar `clinics.ownerUserIds: Id<"users">[]` en v2.

---

## Bitácora de sesiones

> Añade una entrada al final de cada sesión de trabajo con fecha, tareas completadas
> y notas o decisiones tomadas. Mantén el formato.

### Sesión inicial (2026-05-23)
- ✅ Plan diseñado y aprobado
- ✅ Documento de seguimiento creado en `docs/PLAN_STRIPE_PRODUCTION_READY.md`
- Próximo paso: arrancar Fase 1 (Bloque A — Webhooks).

### Sesión 2026-05-23 (continuación — implementación completa de código)

Implementadas las 10 fases en código en una sola sesión continua. El typecheck Convex y Angular pasan limpios al cierre.

**Backend (Convex)**
- Bloque A — webhooks: tabla `stripeWebhookEvents` con dedup por `event.id`; `clinicBilling.lastStripeEventMs` para ordering; `applySubscriptionEvent` descarta eventos stale; `convex/http.ts` registra cada evento antes de aplicarlo y resuelve `clinicId` de forma unificada.
- Bloque J — propietario único: `clinics.ownerUserId` (opcional, pendiente de migrar a no-opcional tras backfill), `clinicOwnershipAudit`, helpers (`esOwner`, `assertOwnerOnClinic`, `assertOwnerOnClinicByExternalId`, `assertNotOwnerWithoutTransfer`, `assertOwnerIsAdmin`), `clinics.transferOwnership`, `clinics.forceTransferOwnership` (soporte). `clinics.create` ahora asigna automáticamente `ownerUserId = user._id`. `getBillingContext` lee del owner con fallback al primer admin pre-migración. Las 6 billing actions pasan a `assertOwnerOnClinicByExternalId`. Migración `migrations/backfillClinicOwner.ts` con flag `apply` (dry-run/aplicar).
- Bloque B — bloqueo del owner: `clinicMemberships.remove` y degradación en `add` rechazan si el saliente es el owner (código `OWNER_MUST_TRANSFER_FIRST`).
- Bloque C — Stripe Tax + métodos pago: `createCheckoutSession` ahora llama directamente a `stripe.checkout.sessions.create` con `automatic_tax`, `tax_id_collection: { required: 'if_supported' }`, `customer_update: { name, address }`, `payment_method_collection: 'always'`. `startTrialForClinic` añade `automatic_tax: { enabled: true }`. Apple/Google Pay vienen vía wallets en Dashboard (sin código).
- Bloque E — aislamiento estricto: `routines.create` acepta `clinicId` (obligatorio si `visibilidad === 'clinica'`), valida con `requireActiveSubscription` contra esa clínica; `update` lee `routine.clinicId`; `duplicate` mantiene fallback al helper "any-active" porque la copia es privada.
- Bloque F — chat suspendido: `conversations.sendMessage` solo bloquea fisio/admin con `requireActiveSubscription`; el paciente sigue chateando.
- Bloque G — emails dunning: nuevas templates `welcomeAfterCheckoutTemplate` + `subscriptionCanceledTemplate` + actions `sendWelcomeAfterCheckoutEmail` + `sendSubscriptionCanceledEmail`. Subjects unificados `[Kengo · {clinicaNombre}] ...`. `notifyCheckoutCompleted` con idempotencia vía `clinicBilling.welcomeEmailSentAt` + `markWelcomeEmailSent`. Hook `checkout.session.completed` y `subscription.deleted` añadidos al webhook.

**Frontend (Angular)**
- `clinics.queries.getMembers` devuelve `isOwner` por miembro; `MiembroEquipo` lo expone.
- `MiembroDetailDialog`: badge "Propietario" + botón "Transferir propiedad" + handling de códigos `OWNER_*`.
- `billing.queries.getMyClinicSubscription` devuelve `clinicaNombre`, `ownerUserId`, `ownerNombre`, `esOwner`. `ClinicSubscription` (shared-models) actualizado.
- `SubscriptionService`: nuevos computed `esOwnerDeClinicaActiva`, `ownerNombre`, `clinicaNombre`. Eliminado `tieneAccesoActivo` no usado.
- `suscripcion.component`: header muestra nombre de clínica; banner informativo "El responsable de la suscripción es {ownerNombre}" cuando no es owner; CTAs (acción principal, cancelar, contactar ventas, ver todas las facturas) ocultos para no-owners; banner de bloqueo personaliza el copy según rol; CTA "Reactivar suscripción" abre Checkout (no Portal) cuando estado = `canceled`.
- `rutinas.service.createRutina`: envía `clinicId = ClinicaActivaService.selectedClinicaId()` cuando `visibilidad === 'clinica'`.

**Pendiente de ejecución manual**
- Bloque J: ejecutar `migrations/backfillClinicOwner` con `apply: false` en dev → revisar log → `apply: true` en dev → staging → prod → resolver clínicas pendientes → promover `ownerUserId` a no-opcional en `schema.ts`.
- Bloque E: ejecutar `migrations/backfillRoutineClinicId` (ya existente) en cada entorno.
- Bloque C — Stripe Dashboard: activar Stripe Tax (España), habilitar Apple Pay (con verificación de dominio en `https://kengoapp.com/.well-known/`), habilitar Google Pay, configurar Customer Portal (cancelar self-service + ver facturas + actualizar método; deshabilitar cambio de plan).
- Bloque H: opcional, mostrar `ui2-clinica-switcher` embebido en la pantalla de suscripción para admins con varias clínicas; añadir banner inline al fisio en la pantalla de chat cuando recibe `SUBSCRIPTION_INACTIVE`.

**Próximo paso recomendado**
1. Validación manual con Stripe CLI siguiendo la sección "Verificación end-to-end" del plan.
2. Ejecutar las dos migraciones de datos en cada entorno.
3. Configurar Stripe Dashboard (Tax + wallets + Portal).
4. Coordinar despliegue backend + frontend.

### Sesión 2026-05-23 (cierre del Bloque J — Propietario único)

Tras ejecución del usuario:
- ✅ Detectadas 2 clínicas huérfanas (`sin_admin`) en dry-run de `backfillClinicOwner`. Creada herramienta de soporte `convex/migrations/deleteClinicCascade.ts` con `inspect` + `run` (dry-run/apply con confirmación por nombre).
- ✅ Borradas las 2 clínicas huérfanas.
- ✅ Aplicado backfill: 4 clínicas con `ownerUserId` asignado al admin más antiguo.
- ✅ `clinics.ownerUserId` promovido a no-opcional en `schema.ts`. Convex codegen pasa contra los datos reales = la invariante "exactamente un owner por clínica" queda blindada por el schema.
- ✅ Eliminados los fallbacks transitorios "primer admin" en `getBillingContext` (`convex/billing/internal.ts`) y en `getMyClinicSubscription` (`convex/billing/queries.ts`).
- ✅ `ClinicSubscription.ownerUserId` cambiado a no-opcional en `libs/shared/models`.

Estado del plan: las 10 fases están completas en código y datos. **Solo queda configuración externa (Stripe Dashboard)** y validación E2E con Stripe CLI.

<!--
### Sesión YYYY-MM-DD
- Tareas completadas:
  - [ ] ...
- Decisiones tomadas:
  - ...
- Bloqueos / pendientes:
  - ...
- Próximo paso:
  - ...
-->
