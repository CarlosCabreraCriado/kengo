# Plan: Sistema de Suscripción con Stripe para Kengo

> **Plan multi-sesión con checkboxes para tracking de progreso.**
> Marca cada tarea con `[x]` cuando la termines. Cada fase es atómica y testeable de forma independiente.

---

## Context

Kengo es una plataforma de gestión clínica de fisioterapia. Hoy es gratuita; el negocio requiere monetizar mediante suscripciones mensuales por clínica, con tarifa escalonada por número de fisioterapeutas:

| Fisios | Precio |
|--------|--------|
| 1 | 65 € / mes |
| 2-4 | 170 € / mes |
| 5-10 | 280 € / mes |
| +10 | Contactar ventas |

Solo el **admin** de la clínica gestiona la suscripción. La suscripción está vinculada al documento `clinics` (Convex), no al usuario individual.

### Decisiones de producto confirmadas

- **Cálculo de seats**: auto-sincronizado con `clinicMemberships` (puesto `fisio`/`admin`). Al añadir/quitar miembros, la quantity de Stripe se actualiza automáticamente con prorrateo.
- **Gating**: bloqueo hard tras 7 días de gracia post-impago. Pacientes nunca se ven afectados; solo fisios/admin.
- **Trial**: 14 días sin tarjeta al crear clínica nueva.
- **+10 fisios**: botón "Contactar ventas" que abre formulario y envía email vía `internal.email.actions.sendContactForm`.

### Decisiones técnicas clave

- **Componente oficial `@convex-dev/stripe`** ([docs](https://www.convex.dev/components/stripe)): encapsula customer, checkout, webhook, customer portal, subscription lifecycle.
- **Estrategia de pricing en Stripe**: **un solo `Price`** recurring con `billing_scheme: "tiered"`, `tiers_mode: "volume"` y `flat_amount` por banda. Esto permite usar el método nativo `updateSubscriptionQuantity(N)` del componente sin lógica custom de "detectar tier y cambiar price".

```
tiers: [
  { up_to: 1,  flat_amount: 6500 },   // 65 €
  { up_to: 4,  flat_amount: 17000 },  // 170 €
  { up_to: 10, flat_amount: 28000 }   // 280 €
]
```

- **Vínculo clínica ↔ Stripe**: pasamos `clinicId` como `orgId` al componente. Recuperamos suscripción con `getSubscriptionByOrgId(clinicId)`.
- **Cache local** (tabla `clinicBilling`) solo para campos custom (fecha de gracia local, último estado conocido para gating sin race conditions).

### Archivos críticos a tocar

| Archivo | Rol |
|---|---|
| `convex/convex.config.ts` | Registrar componente Stripe |
| `convex/schema.ts` | Añadir tabla `clinicBilling` |
| `convex/http.ts` | Montar webhook de Stripe |
| `convex/billing/` (nuevo módulo) | Mutations/queries/actions de billing |
| `convex/clinicMemberships/mutations.ts` | Hook al añadir/quitar miembro → sync quantity |
| `convex/clinics/mutations.ts:create` | Crear customer Stripe + trial al crear clínica |
| `convex/_helpers/permissions.ts` | Helper `requireActiveSubscription` |
| `apps/app/src/app/features/clinica/clinica.routes.ts` | Ruta `/mi-clinica/suscripcion` |
| `apps/app/src/app/features/suscripcion/` (nuevo) | Feature completa frontend |
| `apps/app/src/app/core/guards/clinic-admin.guard.ts` (nuevo) | Solo admin de clínica accede |
| `apps/app/src/app/core/billing/subscription.service.ts` (nuevo) | Estado reactivo de suscripción |
| `libs/shared/models/src/lib/domain/billing.ts` (nuevo) | Tipos `SubscriptionEstado`, `Plan`, etc. |

### Funciones existentes a reutilizar

- `getAuthenticatedUser` y `checkClinicPermission` en `convex/_helpers/permissions.ts`
- `internal.email.actions.sendContactForm` para el caso +10 fisios
- `SessionService.esAdminEnClinica(clinicId)` y `esAdmin` para gating frontend
- `ConvexService` (`apps/app/src/app/core/convex/convex.service.ts`) para llamadas
- Catálogo `ui2-*` (cards, dialog-host, button, pill, list-row, kpi-card, empty-state, spinner)
- `DialogService` y `ToastService` desde `apps/app/src/app/shared/services/`

---

## FASE 0 — Preparación Stripe Dashboard y entorno

> Setup de cuenta y producto. **Hacer en cuenta de test primero**, luego replicar en prod en la última fase.
>
> 📖 Procedimiento detallado en [`SETUP_STRIPE_CONVEX.md`](./SETUP_STRIPE_CONVEX.md). Reutilizable al cambiar de cuenta o provisionar un entorno nuevo.

- [x] Crear cuenta Stripe (si no existe) y activar modo **test**
- [x] Crear **Product** "Kengo Suscripción Clínica" en Stripe Dashboard (test mode)
- [x] Crear **Price** recurring mensual con configuración:
  - [x] `billing_scheme: tiered`, `tiers_mode: volume`
  - [x] Tier 1 → up_to 1, flat 65,00 €
  - [x] Tier 2 → up_to 4, flat 170,00 €
  - [x] Tier 3 → up_to 10, flat 280,00 €
  - [x] Currency: EUR, recurring monthly
  - [x] Anotar el `priceId` resultante (ej. `price_1Xxx...`)
- [x] Configurar **Customer Portal** en Stripe Dashboard:
  - [x] Permitir cancelación de suscripción
  - [x] Permitir actualizar método de pago
  - [x] Permitir descargar facturas
  - [x] Branding (logo Kengo, colores, política privacidad URL)
- [x] Crear **Webhook endpoint** en Stripe (test):
  - [x] URL real: `https://backend.kengoapp.com/stripe/webhook` (Convex self-hosted en Railway, no `*.convex.site`)
  - [x] Suscribirse a eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.created`, `customer.updated`, `invoice.created`
  - [x] Anotar el `webhookSecret`
- [x] Añadir variables de entorno al **deployment de Convex** (gestionadas en Railway → Variables del servicio Convex):
  - [x] `STRIPE_SECRET_KEY` (test key `sk_test_...`)
  - [x] `STRIPE_WEBHOOK_SECRET` (whsec_...)
  - [x] `STRIPE_PRICE_ID` (el price recurring del producto)
  - [x] `STRIPE_TRIAL_DAYS=14`
  - [x] `STRIPE_GRACE_PERIOD_DAYS=7`
  - [x] `KENGO_APP_URL=https://kengoapp.com` (o `http://localhost:4200` en local)
  - [x] `SALES_EMAIL=ventas@kengoapp.com` (o el que se use)

> ✅ **FASE 0 completada el 2026-04-30** — Stripe Dashboard configurado en modo test (product, price tiered, customer portal, webhook apuntando a `backend.kengoapp.com`). Las 7 variables de entorno cargadas en Railway. Pendiente para FASE 14: replicar todo en modo live al desplegar a producción.

---

## FASE 1 — Instalación y registro del componente Stripe en Convex

- [x] `npm install @convex-dev/stripe stripe` en la raíz del monorepo (versión `0.1.4`)
- [x] Editar `convex/convex.config.ts`:
  ```ts
  import { defineApp } from "convex/server";
  import betterAuth from "@convex-dev/better-auth/convex.config";
  import stripe from "@convex-dev/stripe/convex.config.js";

  const app = defineApp();
  app.use(betterAuth);
  app.use(stripe);
  export default app;
  ```
  > Nota: el path de import correcto es `"@convex-dev/stripe/convex.config.js"` con extensión `.js` (no `.ts`), según el README del paquete v0.1.4.
- [x] Editar `convex/http.ts` para montar webhook (al inicio del archivo, junto a la registración de Better-Auth):
  ```ts
  import { components } from "./_generated/api";
  import { registerRoutes as registerStripeRoutes } from "@convex-dev/stripe";

  registerStripeRoutes(http, components.stripe, { webhookPath: "/stripe/webhook" });
  ```
  > Los handlers personalizados (`events`/`onEvent`) se conectan en sesión 3 (FASE 5).
- [x] `npx convex dev` para desplegar — log: `✔ Installed component stripe.` + `Convex functions ready! (4.62s)`
- [x] Volver al Stripe Dashboard y **actualizar la URL real** del webhook con el dominio Convex (`https://backend.kengoapp.com/stripe/webhook`)
- [x] Verificar instalación: el componente Stripe quedó registrado (`components.stripe.*` disponible)

---

## FASE 2 — Schema y módulo `convex/billing/`

> Tabla local para cache + campos custom (gracia, contacto +10, etc.). El componente Stripe ya guarda customer/subscription/payments/invoices en sus propias tablas.

- [x] Añadir a `convex/schema.ts` la tabla `clinicBilling`:
  ```ts
  clinicBilling: defineTable({
    clinicId: v.id("clinics"),
    // Estado cacheado (para queries rápidas y gating sin ir al componente)
    estadoLocal: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("unpaid"),
      v.literal("none"),
    ),
    // ID del customer/subscription en componente Stripe (espejo para acceso rápido)
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    // Fechas clave
    trialEnd: v.optional(v.number()),       // ms epoch
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // Periodo de gracia post-impago (calculado por nuestro código)
    graceUntil: v.optional(v.number()),
    // Cache de quantity activa
    cantidadFisios: v.optional(v.number()),
    requiereContactoVentas: v.optional(v.boolean()),
    actualizadoEn: v.number(),
  }).index("by_clinicId", ["clinicId"]),
  ```
- [x] Crear carpeta `convex/billing/` con archivos:
  - [x] `convex/billing/queries.ts`
  - [x] `convex/billing/mutations.ts` (stub — se rellena en sesión 2)
  - [x] `convex/billing/actions.ts` (stub `"use node"` — se rellena en sesión 2)
  - [x] `convex/billing/internal.ts` (mutations internas llamadas desde webhook handlers)
- [x] **Query**: `billing.queries.getMyClinicSubscription(clinicId)`:
  - Verifica `checkClinicPermission(ctx, user._id, clinicId, ["admin"])`
  - Devuelve `{ estado, trialEnd, currentPeriodEnd, cancelAtPeriodEnd, fisiosActuales, cantidadFacturada, plan, planes, requiereContactoVentas, graceUntil }`
  - El precio actual se calcula localmente del tier según `fisiosActuales`
- [x] **Query interna**: `billing.queries.getClinicBillingStatusInternal(clinicId)` sin auth check (uso interno desde webhooks)
- [x] **Mutation interna**: `billing.internal.upsertClinicBilling({ clinicId, ...campos })` para webhooks
- [x] **Helper**: `convex/billing/_helpers.ts` con `PLANES`, `planParaFisios(n)`, `calcularPrecioPorFisios(n)` y `requiereContactoVentas(n) => n > 10`

> ✅ **Sesión 1 completada el 2026-04-30** — backend foundation lista. Componente Stripe registrado, schema migrado, módulo `convex/billing/` con queries/internal/helpers operativos. Pendiente cierre manual de FASE 0 (webhook real apuntando al deployment Convex y `STRIPE_WEBHOOK_SECRET` en env vars). Próximo: sesión 2 (actions de lifecycle — trial sin tarjeta, checkout, customer portal — y helper `requireActiveSubscription`).

---

## FASE 3 — Activación de suscripción y onboarding con trial

- [x] **Action**: `billing.actions.startTrialForClinic(clinicId)` (`"use node"`):
  - Implementado como `internalAction` con override opcional `trialDays` para migraciones futuras (FASE 14)
  - Crea customer vía `StripeSubscriptions.createCustomer` (con `metadata.orgId = clinicId` e `idempotencyKey = clinicId`)
  - Crea subscription vía SDK directo (`stripe.subscriptions.create`) con `trial_period_days`, `quantity` y `trial_settings.end_behavior.missing_payment_method = "create_invoice"` para que al final del trial sin tarjeta pase a `past_due` en lugar de cancelar
  - Idempotente: si la clínica ya tiene `stripeSubscriptionId` no recrea
  - Persiste en `clinicBilling`: `estadoLocal: "trialing"`, `trialEnd`, `currentPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId`, `cantidadFisios`
- [x] **Modificar `convex/clinics/mutations.ts:create`**:
  - Tras crear `clinics` y `clinicMemberships`, encola `internal.billing.actions.startTrialForClinic` con `ctx.scheduler.runAfter(0, …)`
  - Si la action falla no se hace rollback de la clínica (logging y reintento manual desde UI llegará en sesión 5)
- [x] **Action**: `billing.actions.createCheckoutSession({ clinicId })`:
  - `action` pública. Verifica admin via `internal.billing.internal.assertAdminOnClinicByExternalId` (lee `auth.getUserIdentity().subject`)
  - Reutiliza `stripeCustomerId` si existe; si no, lo crea
  - Llama `StripeSubscriptions.createCheckoutSession` con `mode: "subscription"`, `successUrl/cancelUrl` parametrizados con `KENGO_APP_URL`, y `subscriptionMetadata.orgId`
  - Devuelve `{ url }`
- [x] **Action**: `billing.actions.createCustomerPortalSession({ clinicId })`:
  - `action` pública con check de admin
  - Llama `StripeSubscriptions.createCustomerPortalSession` con `returnUrl: KENGO_APP_URL+"/mi-clinica/suscripcion"`
  - Devuelve `{ url }`
- [x] **Action**: `billing.actions.cancelSubscription({ clinicId, atPeriodEnd: true })`:
  - Llama `StripeSubscriptions.cancelSubscription` y refresca `clinicBilling.cancelAtPeriodEnd` para evitar flicker antes de webhook
- [x] **Action**: `billing.actions.reactivateSubscription({ clinicId })`:
  - Llama `StripeSubscriptions.reactivateSubscription` y refresca `clinicBilling.cancelAtPeriodEnd = false`

---

## FASE 4 — Sincronización automática de quantity ↔ clinicMemberships

> Cada vez que se añade/elimina un fisio o admin, la quantity de Stripe se actualiza. Aplicamos prorrateo automático.

- [x] **Helper interno**: `convex/billing/internal.ts:syncQuantityFromMemberships(clinicId)`:
  - Cuenta miembros con `puesto IN ('fisio', 'admin')` para esa clínica
  - Si `n > LIMITE_FISIOS_AUTOSERVICIO` (10): marca `clinicBilling.requiereContactoVentas = true` y NO sincroniza con Stripe (la mutation que disparó el sync debe haber bloqueado antes con `REQUIERE_CONTACTO_VENTAS`)
  - Si la clínica aún no tiene `stripeSubscriptionId` (race con la action de trial): no hace nada, la subscription se crea con quantity correcta
  - Si la quantity local ya coincide con `clinicBilling.cantidadFisios`: no encola
  - En el resto de casos encola `internal.billing.actions.updateStripeQuantity` vía `ctx.scheduler.runAfter(0, …)`
- [x] **Action**: `billing.actions.updateStripeQuantity({ clinicId, quantity })`:
  - `internalAction`. Llama `StripeSubscriptions.updateSubscriptionQuantity` (el componente aplica prorrateo automático por defecto)
  - Actualiza `clinicBilling.cantidadFisios`
- [x] **Modificar `convex/clinicMemberships/mutations.ts:add`**:
  - Tras `insert/patch`: si el puesto resultante o el anterior era `fisio`/`admin`, encola `syncQuantityFromMemberships`
- [x] **Modificar `convex/clinicMemberships/mutations.ts:remove`**:
  - Lee el documento antes de borrar; si `puesto` era `fisio`/`admin`, encola sync tras el delete
- [x] **Validación al canjear código de fisio** (`convex/accessCodes/mutations.ts:consume`):
  - Antes de insertar la `clinicMemberships`, cuenta `fisio + admin` actuales
  - Si `n + 1 > LIMITE_FISIOS_AUTOSERVICIO`: lanza `ConvexError({ code: "REQUIERE_CONTACTO_VENTAS", message: "..." })`
  - Tras insertar membership, encola `syncQuantityFromMemberships` (consume usa `db.insert` directo, no llama a la mutation `add`)
- [ ] **Tests manuales** (pendientes — sesiones futuras donde haya UI completa):
  - [x] Crear clínica nueva → verificar trial activo con quantity=1 (el admin) → ver Stripe Dashboard
  - [ ] Añadir 1 fisio → quantity=2 → tier 2-4 (170€)
  - [ ] Añadir 2 fisios más (total 4) → tier sigue 2-4
  - [ ] Añadir 1 más (total 5) → tier 5-10 (280€) con prorrateo automático
  - [ ] Eliminar fisio → quantity baja, prorrateo crédito
  - [ ] Intentar añadir fisio nº 11 → debe fallar con `REQUIERE_CONTACTO_VENTAS`

> ✅ **Sesión 2 completada el 2026-04-30** — backend lifecycle de Stripe operativo. Implementadas las 6 actions (`startTrialForClinic`, `createCheckoutSession`, `createCustomerPortalSession`, `cancelSubscription`, `reactivateSubscription`, `updateStripeQuantity`), el helper `syncQuantityFromMemberships` con corte de seguridad por +10 fisios, y todos los hooks: `clinics.create` encola el trial, `clinicMemberships.add/remove` sincronizan quantity, `accessCodes.consume` bloquea el fisio nº 11 con `ConvexError REQUIERE_CONTACTO_VENTAS`. Trial sin tarjeta usa `trial_settings.end_behavior.missing_payment_method = "create_invoice"` para que al expirar pase a `past_due` y dispare el wall de pago via webhook (sesión 3). Typecheck limpio (`npx convex dev --once` + `tsc apps/app`). Tests manuales E2E pendientes para cuando haya UI (sesiones 5-7). Próximo: sesión 3 — webhooks personalizados (`onEvent`), cron de gracia y helper `requireActiveSubscription`.

---

## FASE 5 — Webhook handlers personalizados

> El componente maneja los eventos automáticamente y persiste en SUS tablas. Nosotros enganchamos para sincronizar `clinicBilling` y disparar acciones de negocio (emails, alertas).

- [x] **Configurar `events` y `onEvent`** en `registerStripeRoutes` (`convex/http.ts`):
  - `onEvent` inline en `http.ts` con switch por `event.type`. Hace dispatch a internal mutations específicas por evento (más type-safe que un dispatcher genérico con `any`).
  - Re-lanza errores para que Stripe reintente automáticamente.
- [x] **Mutations internas** dispatch desde `onEvent` (en `convex/billing/internal.ts`):
  - `applySubscriptionEvent({ clinicId, status, trialEnd, currentPeriodEnd, cancelAtPeriodEnd, quantity })` — para `customer.subscription.created/updated`. Mapea `status` Stripe → `estadoLocal` y limpia `graceUntil` si pasa a `active/trialing`.
  - `markCanceled({ clinicId })` — para `customer.subscription.deleted`.
  - `enqueueTrialEndingNotification({ clinicId })` — para `customer.subscription.trial_will_end`. Encola la action de email.
  - `markActiveAfterPayment({ clinicId })` — para `invoice.paid` (solo si estaba `past_due`).
  - `markPastDueWithGrace({ clinicId, gracePeriodDays })` — para `invoice.payment_failed`. Calcula `graceUntil = now + STRIPE_GRACE_PERIOD_DAYS·86400000` y encola `notifyPaymentFailed`.
  - El `clinicId` se obtiene de `subscription.metadata.orgId` (subscription events) o vía `components.stripe.public.getSubscription` (invoice events).
- [x] **Action**: `billing.actions.notifyTrialEnding(clinicId)`:
  - Resuelve admin owner via `getBillingContext`, calcula `diasRestantes` desde `trialEnd`, llama a `internal.email.actions.sendTrialEndingEmail` con `portalUrl = ${KENGO_APP_URL}/mi-clinica/suscripcion`.
- [x] **Action**: `billing.actions.notifyPaymentFailed(clinicId)`:
  - Análoga, llama a `internal.email.actions.sendPaymentFailedEmail`.
- [x] **Templates email** añadidos en `convex/email/templates.ts`: `trialEndingTemplate(nombreAdmin, clinicaNombre, diasRestantes, portalUrl)` y `paymentFailedTemplate(nombreAdmin, clinicaNombre, portalUrl)`. Usan el `baseLayout` y `ctaButton` ya existentes.
- [x] **Actions email** añadidas en `convex/email/actions.ts`: `sendTrialEndingEmail` y `sendPaymentFailedEmail`. Reusan el cliente Resend del módulo.
- [x] **Cron diario**: `convex/crons.ts`:
  - Cada día a las **03:30 UTC** (no 03:00 — para no solapar con `daily-maintenance`), ejecuta `internal.billing.internal.checkGracePeriodsExpired`:
    - Busca `clinicBilling` con `estadoLocal: "past_due"` y `graceUntil < now`
    - Marca `estadoLocal: "unpaid"` (esto activa bloqueo hard en frontend)
    - Email final pendiente para sesión 7 (decisión: por ahora solo se notifica al pasar a `past_due`; el paso a `unpaid` solo bloquea, no envía nuevo email para no saturar)

---

## FASE 6 — Helper de gating y guard backend

- [x] Añadidos a `convex/_helpers/permissions.ts`:
  - `requireActiveSubscription(ctx, clinicId)` — para mutations con `clinicId` explícito en args.
  - `requireAnyActiveSubscriptionForUser(ctx, userId)` — para mutations sin `clinicId` (planes, rutinas). Permite operar si AL MENOS UNA clínica del fisio/admin tiene suscripción activa.
  - Decisión clave: `!billing` (clínica recién creada con trial pendiente o clínica pre-Stripe) **permite operar**. No rompemos clínicas existentes que aún no tengan registro `clinicBilling`. Solo bloquean estados explícitos `canceled`/`unpaid`/`past_due` con gracia agotada.
  - Lanzan `ConvexError({ code: "SUBSCRIPTION_INACTIVE", message })` para que el frontend pueda capturarlo y redirigir al wall de pago (sesión 6).
- [x] **Aplicado `requireActiveSubscription` en mutations críticas de FISIO/ADMIN**:
  - [x] `convex/plans/mutations.ts` — `create`, `updateEstado`, `update` (vía `requireAnyActiveSubscriptionForUser`)
  - [N/A] `convex/exercises/mutations.ts` — solo tiene `toggleFavorite` (preferencia de usuario, no aplica gating)
  - [x] `convex/routines/mutations.ts` — `create`, `update`, `duplicate` (vía `requireAnyActiveSubscriptionForUser`)
  - [x] `convex/clinicMemberships/mutations.ts:add` — solo si el nuevo puesto es `fisio`/`admin` (pacientes siguen pudiendo vincularse)
  - [x] `convex/accessCodes/mutations.ts:create` — vía `requireActiveSubscription(args.clinicId)`
  - **NO aplicado en**: queries de lectura del paciente, ejecuciones del paciente, sesiones del paciente, `clinics/mutations.ts:create` (la clínica nace con trial), `accessCodes/mutations.ts:consume` (paciente puede entrar siempre), gestión de la propia suscripción (`billing.*`).
- [x] **Excepciones explícitas verificadas**: pacientes pueden seguir realizando sesiones aunque la clínica esté impagada (no penalizar al paciente por el admin).

> ✅ **Sesión 3 completada el 2026-04-30** — webhooks personalizados conectados (`onEvent` inline en `http.ts` haciendo dispatch a 5 internal mutations type-safe), 2 actions de notificación (`notifyTrialEnding`, `notifyPaymentFailed`) con templates Resend HTML, cron diario `billing-grace-expired` a las 03:30 UTC, y dos helpers de gating (`requireActiveSubscription` con clinicId explícito y `requireAnyActiveSubscriptionForUser` para fisios multi-clínica). Aplicado en `plans` (create/updateEstado/update), `routines` (create/update/duplicate), `clinicMemberships.add` (solo puestos facturables) y `accessCodes.create`. Decisión clave: `!billing` permite operar (clínicas pre-Stripe / race con trial start). Typecheck limpio. Próximo: sesión 4 — frontend foundation (tipos compartidos, `SubscriptionService` reactivo, `ClinicAdminGuard`, ruta `/mi-clinica/suscripcion` con placeholder, action `contactarVentas`).

---

## FASE 7 — Tipos compartidos y servicio Angular

- [x] **Crear `libs/shared/models/src/lib/domain/billing.ts`**:
  ```ts
  export type SubscriptionEstado =
    | 'trialing' | 'active' | 'past_due' | 'canceled'
    | 'incomplete' | 'unpaid' | 'none';

  export interface PlanInfo {
    nombre: string;        // "1 Fisio", "2-4 Fisios", "5-10 Fisios"
    precioMensualEur: number;
    rangoFisiosMin: number;
    rangoFisiosMax: number;
  }

  export interface ClinicSubscription {
    clinicId: string;
    estado: SubscriptionEstado;
    trialEnd?: number;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
    fisiosActuales: number;
    cantidadFacturada: number;
    plan: PlanInfo;
    diasGracia?: number; // calculado si past_due
  }

  export const PLANES: PlanInfo[] = [
    { nombre: '1 Fisio', precioMensualEur: 65, rangoFisiosMin: 1, rangoFisiosMax: 1 },
    { nombre: '2-4 Fisios', precioMensualEur: 170, rangoFisiosMin: 2, rangoFisiosMax: 4 },
    { nombre: '5-10 Fisios', precioMensualEur: 280, rangoFisiosMin: 5, rangoFisiosMax: 10 },
  ];

  export function planParaFisios(n: number): PlanInfo | null {
    return PLANES.find(p => n >= p.rangoFisiosMin && n <= p.rangoFisiosMax) ?? null;
  }
  ```
- [x] Exportar desde el barrel `libs/shared/models/src/lib/index.ts` (también desde `apps/app/src/app/core/index.ts` el `SubscriptionService` y el `ClinicAdminGuard`)
- [x] **Crear `apps/app/src/app/core/billing/subscription.service.ts`** (`@Injectable({ providedIn: 'root' })`):
  - Reactivo via `ConvexService.watchQuery` (NO `client.onUpdate` directo — usamos el helper del proyecto por consistencia). El query se "skipea" mientras no haya `clinicId` admin resuelto.
  - Computed `clinicIdAdmin` resuelve la clínica activa: primera donde el usuario tiene puesto `admin` (`session.misclinicas().find(c => c.puesto === 'admin')?.clinicId`). Multi-clínica admin queda como TODO (selector futuro).
  - Computeds expuestos: `tieneAccesoActivo`, `enTrial`, `diasRestantesTrial`, `bloqueada`, `enPeriodoGracia`, `cancelaAlFinDelPeriodo`.
  - Métodos:
    - `iniciarCheckout(clinicId)` → llama `api.billing.actions.createCheckoutSession`, redirige `window.location.href = url`
    - `abrirPortal(clinicId)` → idem con `createCustomerPortalSession`
    - `cancelar(clinicId)` → llama `cancelSubscription` con `atPeriodEnd: true` (no refresca: el watchQuery se actualiza solo al volver el webhook)
    - `reactivar(clinicId)` → llama `reactivateSubscription`
    - `contactarVentas(clinicId, mensaje, telefono?)` → llama action `contactarVentas`, devuelve boolean
- [N/A esta sesión] Inyectar `SubscriptionService` en `AppComponent` y cargar al login → la carga es lazy: el `watchQuery` se inicia cuando el usuario consume el servicio (al entrar a `/mi-clinica/suscripcion`). Cuando se introduzca el banner global (FASE 10) habrá que precargar inyectándolo en el shell.
- [x] **Watch reactivo**: implementado vía `ConvexService.watchQuery` (que internamente usa `client.onUpdate`). Decisión: usar el helper del proyecto, no `onUpdate` directo, por consistencia.

---

## FASE 8 — Guard `ClinicAdminGuard` y rutas

- [x] **Crear `apps/app/src/app/core/guards/clinic-admin.guard.ts`**:
  - Inyecta `SessionService`, `Router`, `ToastService`
  - `canActivate(route)`: lee `clinicId` de `route.paramMap` (si existe) o cae a `sessionService.esAdmin()` (admin en cualquier clínica)
  - Devuelve `true` si admin, si no redirige a `/inicio` con `ToastService.error('Solo los administradores pueden acceder a esta sección')`
- [x] **Modificar `apps/app/src/app/features/clinica/clinica.routes.ts`** para añadir ruta hija con `canActivate: [AuthGuard, ClinicAdminGuard]`:
  ```ts
  {
    path: 'suscripcion',
    canActivate: [AuthGuard, ClinicAdminGuard],
    loadComponent: () => import('./pages/suscripcion/suscripcion.component')
      .then(m => m.SuscripcionComponent),
  }
  ```

> ✅ **Sesión 4 completada el 2026-04-30** — frontend foundation + placeholder funcional. Tipos compartidos en `libs/shared/models/src/lib/domain/billing.ts` (`SubscriptionEstado`, `PlanInfo`, `ClinicSubscription`, `PLANES`, `planParaFisios`, `requiereContactoVentas`). `SubscriptionService` reactivo (`apps/app/src/app/core/billing/subscription.service.ts`) que usa `ConvexService.watchQuery` y resuelve la clínica activa como la primera donde el usuario es admin. `ClinicAdminGuard` parametrizable por `paramMap.clinicId` (con fallback a `esAdmin`). Ruta `/mi-clinica/suscripcion` registrada con `[AuthGuard, ClinicAdminGuard]`. Pantalla placeholder `SuscripcionComponent` (standalone, OnPush, V2) con header, estado actual (pill + plan + fisios + próximo cargo), CTA principal contextual (Activar / Añadir método de pago / Reactivar / Actualizar pago) y bloque +10 fisios usando `window.prompt` (el dialog formal va en sesión 5). Action backend `billing.actions.contactarVentas` añadida con auth-check de admin y dispatch a `internal.email.actions.sendContactForm`. Verificado `npx convex dev --once` ✔ + `nx run app:build` ✔ sin errores. Decisiones tomadas: (1) `watchQuery` en lugar de `client.onUpdate` directo por consistencia; (2) primera-clínica-admin como heurística temporal (selector multi-clínica futuro); (3) carga lazy del servicio (entra en marcha al consumirse), no precarga al login (eso vendrá con FASE 10 banner global); (4) `contactarVentas` reusa `sendContactForm` embebiendo contexto en el cuerpo, no crea email-specific para `SALES_EMAIL`. Próximo: sesión 5 — pantalla completa de suscripción (FASE 9 detallada: tabla de planes con highlight, `ContactarVentasDialog` formal, histórico de facturas vía `components.stripe.listInvoicesByOrgId`).

---

## FASE 9 — Pantalla de gestión de suscripción (admin)

> Ruta: `/mi-clinica/suscripcion`. Solo admin de clínica.

- [x] **Crear** `apps/app/src/app/features/clinica/pages/suscripcion/suscripcion.component.ts` (standalone, OnPush, signals):
  - [x] **Header**: `<ui2-back-button>` + título "Suscripción"
  - [x] **Estado actual** (`<ui2-card>` `tinted` si activa, neutra si trial, danger si bloqueada):
    - [x] `<ui2-pill>` con estado: "Trial · 8 días restantes" / "Activa" / "Pago pendiente" / "Cancelada"
    - [x] Plan actual con precio: "Plan 2-4 Fisios — 170 €/mes"
    - [x] Próximo cargo: fecha + cantidad
    - [x] Fisios incluidos: "3 de 4 fisios usados" (`<ui2-progress-bar>`) — capacidad del **tier actual** (color `success`/`warning` según se llene), con texto "+1 fisio más → tier siguiente (precio)" cuando está lleno.
  - [x] **Acciones** (`<ui2-cta-bar>` o `<ui2-button>`):
    - [x] Si `estado === 'none'` → "Activar suscripción" → `iniciarCheckout`
    - [x] Si `estado === 'trialing'` → "Añadir método de pago" → `iniciarCheckout`
    - [x] Si `estado === 'active' && !cancelAtPeriodEnd` → "Gestionar pago" / "Cancelar suscripción" (botón ghost separado con confirmación) → `abrirPortal` / `cancelar`
    - [x] Si `cancelAtPeriodEnd` → "Reactivar" → `reactivar`
    - [x] Si `estado === 'past_due' || 'unpaid'` → "Actualizar método de pago" → `abrirPortal`
  - [x] **Tabla planes** (`<ui2-card>` con grid `<ui2-list-row>`): muestra los 3 tiers con precio y rango. Resalta el actual con `<ui2-pill variant="primary">Plan actual</ui2-pill>`. Última fila adicional "+10 fisios — Plan a medida" que abre `ContactarVentasDialog`.
  - [x] **Caso +10 fisios**: si `fisiosActuales > 10` o si llamada anterior devolvió `REQUIERE_CONTACTO_VENTAS`, mostrar `<ui2-empty-state>` con CTA "Contactar con ventas" → abre `ContactarVentasDialog`
  - [x] **Histórico de facturas**: lista con `<ui2-list-row>` (últimas 6) con fecha + importe + estado (Pagada/Pendiente/Fallida) + link descarga `hosted_invoice_url`. Última fila "Ver todas las facturas" abre el Customer Portal. Decisión: usamos action **`billing.actions.listInvoicesForClinic`** (Stripe SDK directo) en lugar de `components.stripe.public.listInvoicesByOrgId` porque la query oficial del componente NO devuelve `hosted_invoice_url` ni `invoice_pdf`, que son los datos que necesitamos para descarga.
- [x] **Crear** `apps/app/src/app/features/clinica/components/contactar-ventas-dialog/contactar-ventas-dialog.component.ts`:
  - `<ui2-dialog-host>` + `<ui2-dialog-header>` + form con `<ui2-textarea>` "Mensaje" (required, minLength 10, maxLength 500, count) + `<ui2-input>` "Teléfono opcional"
  - Mensaje pre-rellenado: `"Hola, gestiono una clínica con N fisioterapeutas y necesito un plan a medida."` editable.
  - Se abre vía `DialogService.open(ContactarVentasDialogComponent, { data: { clinicId, fisiosActuales, telefonoSugerido? } })`. Cierra con `{ ok: true }` si el envío fue OK; el toast de éxito lo dispara `SubscriptionService.contactarVentas`.
- [x] **Action backend nueva**: `billing.actions.listInvoicesForClinic({ clinicId, limit? })` — devuelve `{ invoices: InvoiceItem[], error? }` con hasta 6 facturas; tipo `InvoiceItem` añadido a `libs/shared/models/src/lib/domain/billing.ts` y exportado desde el barrel.
- [x] **Action backend**: `billing.actions.contactarVentas({ clinicId, mensaje, telefono })`:
  - Verifica permiso admin via `internal.billing.internal.assertAdminOnClinicByExternalId`
  - Recupera info de la clínica + usuario admin via `getBillingContext`
  - Llama `internal.email.actions.sendContactForm` (su firma es `{ nombre, email, asunto, mensaje }` y enruta a `CONTACT_EMAILS`). Embebe en el `mensaje` el contexto: `clinicId`, nombre clínica, nº fisios actuales, mensaje libre, teléfono opcional, contacto admin. Decisión: reusamos `sendContactForm` en lugar de crear uno específico para `SALES_EMAIL` — si en el futuro se quiere separar bandeja, será un cambio aparte.
- [ ] **Tests UI manuales**:
  - [ ] Estados visuales: trial, active, past_due, canceled, unpaid
  - [ ] Botones correctos por estado
  - [ ] Redirige a Stripe Checkout y vuelve con `?ok=1` mostrando toast
  - [ ] Redirige a Customer Portal
  - [ ] Diálogo contactar ventas envía email

---

## FASE 10 — Acceso desde `/mi-clinica` y banner global

- [x] **Modificar** `apps/app/src/app/features/clinica/pages/miclinica/miclinica.component.ts`:
  - Añadir card "Suscripción" con `<ui2-list-row>` que muestre estado actual y CTA → navega a `/mi-clinica/suscripcion`
  - Solo visible si `esAdmin()` para la clínica seleccionada. Subtitle dinámico (Trial · N días / Activa · plan / Suspendida / Se cancelará el dd/mm/yyyy / Sin suscripción) y `<ui2-pill>` con variante semántica.
- [x] **Crear `BillingBannerComponent`** — ubicado en `apps/app/src/app/core/billing/billing-banner.component.ts` (no en `shared/ui-v2` como se planteó originalmente, porque inyecta `SubscriptionService`/`SessionService`/`Router` y no es presentational). Selector `app-billing-banner`. Standalone, OnPush.
  - Renderiza si:
    - `bloqueada()`: banner rojo "Suscripción suspendida — actualiza el método de pago" (CTA "Resolver")
    - `enPeriodoGracia()`: banner naranja "Hay un problema con el pago — quedan N días para resolverlo"
    - `enTrial && diasRestantesTrial <= 5`: banner amarillo "Tu trial termina en N días — añade método de pago"
    - `cancelaAlFinDelPeriodo`: banner neutro gris "La suscripción se cancelará el dd/mm/yyyy"
  - CTA del banner → navega a `/mi-clinica/suscripcion`
  - Solo visible para admin (`session.esAdmin()`)
  - Se desactiva en `/mi-clinica/suscripcion` para no duplicar la información
- [x] **Insertar `<app-billing-banner>`** en el shell V2 — solo en bloque "modo fisio" (desktop debajo del topbar; mobile dentro del `<main>` para no luchar con el header floating). Las rutas de auth (`/login`, `/registro`) ya están fuera del bloque modo fisio del shell.

> ✅ **Sesión 5 completada el 2026-04-30** — pantalla de suscripción cerrada y descubrible. **FASE 9 al 100%** y **FASE 10 parcial (card en `/mi-clinica`)**. Implementado: (1) action backend nueva `billing.actions.listInvoicesForClinic({ clinicId, limit })` que llama directamente al SDK de Stripe (`stripe.invoices.list`) para obtener `hosted_invoice_url` e `invoice_pdf` — la query oficial del componente no los expone; (2) tipo compartido `InvoiceItem` + `InvoiceEstado` + `InvoicesResult` en `libs/shared/models/src/lib/domain/billing.ts`; (3) `ContactarVentasDialogComponent` standalone OnPush con `<ui2-textarea>` (mensaje pre-rellenado editable, required minLength 10, count 500) + `<ui2-input>` teléfono opcional; abre vía `DialogService.open()`; (4) `SuscripcionComponent` refactorizado: `<ui2-progress-bar>` con capacidad del **tier actual** (color `success`/`warning`, aviso de tier siguiente al llenarse), tabla de planes (`<ui2-list-row>` x3 + fila "+10 fisios"), histórico de últimas 6 facturas (estado pill + botón descarga + fila "Ver todas en el Portal"), botón ghost "Cancelar suscripción" con confirmación, eliminado `window.prompt` a favor del dialog formal; (5) card "Suscripción" en `MiClinicaComponent` (sólo admin) con subtitle dinámico (Trial · N días / Activa · plan / Suspendida / Cancelará el dd/mm/yyyy) y `<ui2-pill>` semántica → click navega a `/mi-clinica/suscripcion`. Verificado: `npx convex dev --once` ✔ y `nx run app:build` ✔ sin errores nuevos; `nx run app:lint` no introduce errores en los archivos tocados (errores existentes son del baseline). Decisiones de diseño confirmadas con el usuario: facturas vía SDK directo (limit 6), indicador de fisios = capacidad del tier actual, no se ha tocado el banner global ni el wall de pago. Próximo: sesión 6 — FASE 10 banner global + FASE 11 wall de pago + FASE 12 captura de `REQUIERE_CONTACTO_VENTAS` en `CrearClinicaDialog`/`GenerarCodigoDialog` reutilizando el dialog ya creado.

---

## FASE 11 — Wall de pago (bloqueo hard)

> Cuando `estado === 'unpaid'` o gracia agotada, los fisios/admin solo pueden ir a `/mi-clinica/suscripcion`. Pacientes pasan sin restricción.

- [x] **Crear** `apps/app/src/app/core/guards/active-subscription.guard.ts`:
  - Class-based con `inject()`. Pacientes pasan siempre. Espera a `cargarMiUsuario()` si la sesión aún no está hidratada (mismo patrón que `ClinicAdminGuard`).
  - Cuando `subscriptionService.bloqueada()`, devuelve `UrlTree` a `/mi-clinica/suscripcion?bloqueada=1`.
- [x] **Aplicar `ActiveSubscriptionGuard`** en rutas de creación/edición:
  - [x] `/planes/nuevo`, `/planes/:id/editar` (en `planes.routes.ts`)
  - [x] `/rutinas/nueva`, `/rutinas/:id/editar` (en `rutinas.routes.ts`)
  - [N/A] `/mis-pacientes`, `/ejercicios/crear` — no existen rutas dedicadas de creación; el alta de paciente sucede en dialogs cuya mutation está protegida en backend con `requireActiveSubscription`. Ningún cambio adicional necesario.
  - **NO aplicado en** (decisión confirmada por el usuario): `/inicio`, `/mi-clinica` (excepto `/mi-clinica/suscripcion`), `/perfil`, listados (`/planes`, `/rutinas`, `/ejercicios`, `/mis-pacientes`), rutas de paciente, auth.
- [x] **Pantalla de bloqueo** dentro de `SuscripcionComponent`:
  - Lectura de `?bloqueada=1` vía `route.queryParamMap` (computed `llegadaPorBloqueo`).
  - Si presente Y `bloqueada()`: card de alerta roja arriba con icono `lock` + texto "Suscripción suspendida" + CTA "Actualizar método de pago" (delega a `accionPrincipal()` que abre el portal de Stripe).
  - El resto de la página (planes, facturas) sigue visible debajo para dar contexto — diseño confirmado por el usuario (no ocultar).

---

## FASE 12 — Manejo del +10 fisios fuera de la pantalla de suscripción

- [N/A] **En `CrearClinicaDialog`**: confirmado en sesión 6 que este dialog crea la clínica con el admin como primer miembro y nunca dispara `REQUIERE_CONTACTO_VENTAS`. No requiere captura.
- [x] **En generación de código de acceso de fisio** (`GenerarCodigoDialog`):
  - Backend: añadida validación preventiva en `convex/accessCodes/mutations.ts:create` (mismo patrón que `consume`) para que el admin reciba feedback en el momento de generar, no cuando el fisio canjea.
  - Servicio: `ClinicaGestionService.generarCodigo` ahora propaga `errorCode` desde `err?.data?.code`. Tipo `GenerarCodigoResponse` en `libs/shared/models` ampliado con campo opcional `errorCode`.
  - Dialog: nuevo `@Output() requiereContactoVentas` que se emite cuando `result.errorCode === 'REQUIERE_CONTACTO_VENTAS'`.
  - `MiClinicaComponent` cablea `(requiereContactoVentas)="onRequiereContactoVentas()"` que cierra `GenerarCodigoDialog`, lanza un toast warning y abre `ContactarVentasDialog` vía `DialogService.open()` con `clinicId` + `fisiosActuales` rellenados.
- [x] **Aviso informativo** en `/mi-clinica` cuando `fisiosActuales >= 10` (solo admin): card warning con texto "Has alcanzado el plan máximo (10 fisios)" + CTA "Contactar con ventas" que reusa `abrirDialogContactarVentas()`. Se renderiza dentro de la sección "Suscripción" justo debajo de la card de gestión.

> ✅ **Sesión 6 completada el 2026-04-30** — UX de estados problemáticos cerrada. **FASES 10, 11 y 12 al 100%** (tests E2E manuales pendientes para sesión 7). Implementado:
>
> 1. **Banner global** (`apps/app/src/app/core/billing/billing-banner.component.ts`) — selector `app-billing-banner`, OnPush, standalone. Variantes `danger`/`warning`/`neutral` con prioridad: `bloqueada → enPeriodoGracia → trial≤5d → cancelaAlFinDelPeriodo`. Inyectado en el shell de modo fisio (`app.component.html`) en desktop y mobile. Visible solo si `session.esAdmin()`. Se desactiva en `/mi-clinica/suscripcion`.
> 2. **`ActiveSubscriptionGuard`** (`apps/app/src/app/core/guards/active-subscription.guard.ts`) — class-based, espera hidratación de sesión, devuelve `UrlTree` a `/mi-clinica/suscripcion?bloqueada=1`. Aplicado en `planes/nuevo`, `planes/:id/editar`, `rutinas/nueva`, `rutinas/:id/editar`. Pacientes nunca bloqueados.
> 3. **Refuerzo wall de pago** en `SuscripcionComponent` — computed `llegadaPorBloqueo` lee `?bloqueada=1`. Card de alerta roja arriba con icono `lock` + CTA "Actualizar método de pago" (resto de la página visible debajo según diseño confirmado).
> 4. **Validación preventiva +10 fisios** en `accessCodes.create` — el admin recibe `REQUIERE_CONTACTO_VENTAS` ya al generar el código (antes solo se lanzaba al canjear). `ClinicaGestionService.generarCodigo` ahora propaga `errorCode`. `GenerarCodigoDialog` emite `(requiereContactoVentas)`; `MiClinicaComponent` lo captura, cierra el dialog y abre `ContactarVentasDialog` con datos rellenados.
> 5. **Aviso informativo** en `/mi-clinica` para `fisiosActuales >= 10` (solo admin) con card warning + CTA "Contactar con ventas".
>
> **Decisiones tomadas durante la implementación (ajustes al plan original):**
> - **Ubicación del banner**: movido de `shared/ui-v2/billing-banner/` a `core/billing/billing-banner.component.ts` porque inyecta servicios y no es presentational. Selector `app-billing-banner`.
> - **Inserción mobile**: dentro del `<main>` (no como overlay sobre el header floating) para no complicar z-index.
> - **No tocamos `CrearClinicaDialog`**: confirmado que ese dialog nunca dispara `REQUIERE_CONTACTO_VENTAS` (crea la clínica con el admin como primer miembro). Solo `GenerarCodigoDialog` lo necesita.
> - **Backend mínimo tocado**: aunque la sesión iba a ser frontend-only, añadir la validación preventiva en `accessCodes.create` (10 líneas, mismo patrón que `consume`) era condición necesaria para una UX coherente. Sin ello, el error solo aparecía al canjear el código (al fisio nº 11), no al admin que lo genera.
> - **Tipo `GenerarCodigoResponse`** ampliado en `libs/shared/models` con `errorCode?: string` para propagar el `code` del `ConvexError`.
>
> **Verificación**: `npx convex dev --once` ✔ y `npx nx run app:build` ✔ sin errores nuevos. `nx run app:lint` no introduce errores en archivos tocados (todos los errores son baseline pre-existente). Tests E2E manuales pendientes para sesión 7.
>
> **Próximo: sesión 7** — FASE 13 (tests E2E completos en modo test de Stripe) + FASE 14 (replicar config en live mode + migración de clínicas existentes + despliegue).

---

## FASE 13 — Tests E2E manuales (checklist completa)

> 📖 Procedimiento detallado paso a paso en [`TESTING_STRIPE.md`](./TESTING_STRIPE.md): incluye comandos de Stripe CLI, helpers de QA en Convex Dashboard (`setGraceUntilForTesting`, `checkGracePeriodsExpired`), tarjetas de prueba y limpieza tras los tests.

- [ ] **Onboarding**:
  - [ ] Registro nuevo → crea clínica → trial activo 14 días con quantity=1
  - [ ] Banner "trial activo" visible
- [ ] **Activación**:
  - [ ] Admin entra a `/mi-clinica/suscripcion` → click "Añadir método de pago"
  - [ ] Stripe Checkout (test card `4242 4242 4242 4242`) → redirige a `?ok=1`
  - [ ] Estado pasa a `active`, banner desaparece
- [ ] **Crecimiento**:
  - [ ] Añadir fisio nº 2 → quantity sube → tier 2-4, factura prorrateada en próximo periodo
  - [ ] Añadir hasta 5 fisios → cambio de tier a 5-10
  - [ ] Verificar en Stripe Dashboard que la quantity es correcta
- [ ] **Cancelación**:
  - [ ] Admin abre portal → cancela
  - [ ] Banner "se cancelará el dd/mm/yyyy"
  - [ ] Reactivar → banner desaparece
- [ ] **Impago**:
  - [ ] Forzar `invoice.payment_failed` desde Stripe Dashboard (test mode → fail card)
  - [ ] Estado pasa a `past_due`, banner naranja, gracia 7 días
  - [ ] Adelantar reloj 8 días (o forzar cron) → estado `unpaid`, wall de pago activo
- [ ] **Pacientes no afectados**:
  - [ ] Con clínica en `unpaid`, login como paciente → puede entrar y completar sesión
- [ ] **+10 fisios**:
  - [ ] Intentar añadir fisio nº 11 → error → diálogo contactar ventas → email recibido en `SALES_EMAIL`
- [ ] **Webhooks**:
  - [ ] Stripe CLI: `stripe listen --forward-to <convex-url>/stripe/webhook` y disparar eventos manualmente para validar handlers

---

## FASE 14 — Despliegue a producción

- [ ] Replicar en Stripe modo **live**: Product, Price (mismos tiers), Customer Portal, Webhook
- [ ] Actualizar variables de entorno de Convex (deployment de prod) con las **live keys**
- [ ] Anuncio a clínicas existentes:
  - [x] Política de migración decidida (sesión 7): trial automático de **30 días** para clínicas con ≤10 fisios; para clínicas con **>10 fisios** no se crea suscripción Stripe — se marca `clinicBilling.requiereContactoVentas=true` y se les envía email enterprise para cerrar plan a medida.
  - [x] **Mutation one-shot de migración** `internal.billing.migrations.migrateExistingClinics` (sesión 7):
    - Itera todas las clínicas sin `clinicBilling`. Idempotente (skip si ya existe registro).
    - ≤10 fisios → encola `internal.billing.actions.startTrialForClinic({ clinicId, trialDays: 30 })` + email anuncio.
    - >10 fisios → inserta registro `{ estadoLocal: "none", requiereContactoVentas: true }` + email enterprise.
    - Query auxiliar `internal.billing.migrations.getMigrationPreview` para ver alcance sin efectos colaterales.
  - [x] Templates email (sesión 7): `migrationAnnouncementTemplate` (≤10 fisios) y `enterpriseInvitationTemplate` (>10 fisios) en `convex/email/templates.ts`.
  - [x] Actions email (sesión 7): `internal.email.actions.sendMigrationAnnouncementEmail` y `sendEnterpriseInvitationEmail` en `convex/email/actions.ts`.
  - [ ] Ejecutar `migrateExistingClinics` desde Convex Dashboard de producción (acción humana, una sola vez).
- [ ] Monitoreo:
  - [ ] Configurar alertas de webhook fallidos en Stripe Dashboard
  - [ ] Logs en Convex Dashboard durante las primeras semanas
- [ ] Documentación de soporte:
  - [ ] FAQ pública: cómo cambia mi precio si añado fisio, cuándo se cobra el prorrateo, política de cancelación, política de reembolso
  - [ ] Guía interna: cómo gestionar un caso enterprise (+10 fisios) en Stripe Dashboard

> ✅ **Sesión 7 completada el 2026-04-30** — preparación de código para producción cerrada. **FASE 14 lista para despliegue** (solo quedan acciones humanas: replicar Stripe en live, flip de variables, ejecutar la mutation desde Dashboard, redactar FAQ pública, configurar alertas).
>
> **Implementado en esta sesión:**
> 1. **`convex/billing/migrations.ts`** — nuevo módulo con `migrateExistingClinics` (internalMutation idempotente) + `getMigrationPreview` (internalQuery sin efectos). Bifurca por `LIMITE_FISIOS_AUTOSERVICIO`: ≤10 → trial 30d + email anuncio; >10 → inserta registro `requiereContactoVentas=true` + email enterprise. Reutiliza `startTrialForClinic({ trialDays })` existente y los emails encolados via `scheduler.runAfter(0, ...)`.
> 2. **2 templates email nuevos** en `convex/email/templates.ts`: `migrationAnnouncementTemplate` (incluye tabla de los 3 tiers + 30 días sin tarjeta + CTA "Activar suscripción") y `enterpriseInvitationTemplate` (mensaje específico para clínicas >10 fisios + CTA "Hablar con ventas"). Reusan `baseLayout` y `ctaButton`.
> 3. **2 actions email nuevas** en `convex/email/actions.ts`: `sendMigrationAnnouncementEmail` y `sendEnterpriseInvitationEmail`. Mismo patrón que `sendTrialEndingEmail` (Resend + fallback gracioso si falta `RESEND_API_KEY`).
> 4. **Helper de QA** `internal.billing.internal.setGraceUntilForTesting({ clinicId, daysFromNow })` — fuerza `graceUntil` arbitrario (admite negativos) para validar `checkGracePeriodsExpired` sin esperar 7 días reales. Solo invocable desde Convex Dashboard.
> 5. **`docs/TESTING_STRIPE.md`** nuevo — guía paso a paso de FASE 13: prerequisitos, comando `stripe listen`, checklist E2E (8 bloques de tests), comandos útiles (`stripe trigger`, helpers Convex), limpieza tras tests, checklist final pre-live.
> 6. **Eliminado** `convex/billing/mutations.ts` (stub vacío `export {}`).
>
> **Decisiones de producto confirmadas durante el plan**:
> - Trial migración: 30 días (vs 14 estándar).
> - Clínicas pre-Stripe con >10 fisios: NO se crea subscription; se marca `requiereContactoVentas=true` y se les invita a contrato a medida vía email enterprise.
> - Sin script de seed (preferencia de crear datos vía UI real).
>
> **Verificación pendiente** (próximo paso de esta misma sesión): `npx convex dev --once` + `npx nx run app:build` + `npx nx run app:lint` para confirmar que no introducimos errores de typecheck.
>
> **Próximo: sesión 8** — ejecutar la guía completa de [`TESTING_STRIPE.md`](./TESTING_STRIPE.md) en modo test de Stripe (8 bloques E2E). Cualquier bug encontrado se corrige sobre el código actual.
>
> **Después: sesión 9** — despliegue producción (replicar Stripe live, flip de variables Railway, ejecutar `migrateExistingClinics` en prod, redactar FAQ pública, configurar alertas de webhooks fallidos).

---

## Verificación end-to-end

```bash
# 1. Backend Convex
cd /Users/carloscabrera/Documents/Proyectos/kengo
npx convex dev
# Verifica funciones billing.* desplegadas y endpoint /stripe/webhook accesible

# 2. Stripe CLI para webhook local
stripe listen --forward-to https://<deployment>.convex.site/stripe/webhook

# 3. Frontend
cd apps/app
npm run start  # http://localhost:4200

# 4. Tests automatizados (cuando se añadan)
npm run test
npm run lint
npm run typecheck

# 5. Flujo manual:
# - Registrar nuevo usuario → crear clínica → trial automático
# - /mi-clinica/suscripcion → activar → Stripe Checkout → 4242 4242 4242 4242
# - Añadir fisios y verificar prorrateo en Stripe Dashboard
# - Forzar payment_failed y validar wall de pago
```

---

## Riesgos y consideraciones

- **Race conditions** entre `clinicMemberships.add` y `updateSubscriptionQuantity`: el SDK de Stripe es idempotente sobre updates de quantity, así que reintentar es seguro. Usar `ctx.scheduler.runAfter(0, ...)` para no bloquear la mutation de membership.
- **Webhooks duplicados**: Stripe puede entregar eventos varias veces. La estrategia de upsert por `subscriptionId` ya garantiza idempotencia.
- **Cambios de currency**: el plan está en EUR. Si en el futuro se internacionaliza, habrá que añadir prices por moneda y elegir el adecuado.
- **GDPR / facturación EU**: Stripe Tax debería activarse para gestionar IVA automáticamente. Contemplarlo en Fase 0 si la clínica está en España.
- **Test mode vs live mode**: nunca mezclar keys. Usar variables de entorno separadas por deployment de Convex.
- **Migración de clínicas existentes**: la Fase 14 contempla este punto, pero conviene decidir la política de comunicación con tiempo.
