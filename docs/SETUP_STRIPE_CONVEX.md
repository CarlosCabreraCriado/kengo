# Setup manual de Stripe + Convex (env vars)

Procedimiento para configurar Stripe Dashboard y las variables de entorno del backend Convex (self-hosted en Railway). Útil al alta inicial, al cambiar de cuenta Stripe, al replicar de test → live, o al provisionar un entorno nuevo.

> Este documento es complementario al plan de implementación en [`PLAN_STRIPE_SUSCRIPCIONES.md`](./PLAN_STRIPE_SUSCRIPCIONES.md). El plan describe el código; este documento describe el setup externo.

**Tiempo estimado**: 15-20 min.

---

## Prerrequisitos

- Cuenta en https://stripe.com creada (la verificación de identidad puede esperar al modo live).
- Acceso al proyecto Convex en Railway: https://railway.app/dashboard.
- Saber qué dominio HTTP sirve el backend Convex. En Kengo:
  - **Producción**: `https://backend.kengoapp.com`
  - **Local**: el `CONVEX_SITE_URL` que tengas en `.env.local` (en este repo apunta también a `backend.kengoapp.com` porque comparten Convex; si tuvieras un deployment separado, sería su URL).
  - El dominio es **el de HTTP/webhooks**, NO el de WebSockets (`convex.kengoapp.com`).

---

## 1. Stripe Dashboard — Modo correcto

Abre https://dashboard.stripe.com y mira el toggle superior derecho:

- 🟠 **Test mode** → para desarrollo y staging.
- ⚫ **Live mode** → para producción real.

**Todo este documento se hace primero en Test, y después se replica idénticamente en Live cuando se vaya a publicar.** Las claves, productos, prices y webhooks de cada modo son independientes.

---

## 2. Crear el Product

1. **Products** (sidebar) → **+ Add product**
2. Datos:
   - **Name**: `Kengo Suscripción Clínica`
   - **Description**: `Plataforma de gestión clínica de fisioterapia. Tarifa por número de fisioterapeutas.`
   - **Image** (opcional): logo de Kengo
3. **No guardes aún** — el price se configura en la misma pantalla.

---

## 3. Crear el Price tiered

Bajo el producto, sección **"Pricing"**:

1. **Pricing model**: **Tiered pricing** (puede estar oculto detrás de "More pricing models").
2. **Type**: `Recurring`
3. **Billing period**: `Monthly`
4. **Currency**: `EUR (€)`
5. **Tiering mode**: **Volume** (no "Graduated").
6. **Tiers** — exactamente 3 filas:

   | First unit | Last unit | Per unit | Flat fee |
   |---|---|---|---|
   | 1 | 1 | `0,00` | **`65,00`** |
   | 2 | 4 | `0,00` | **`170,00`** |
   | 5 | 10 | `0,00` | **`280,00`** |

   ⚠️ El "Per unit" siempre `0`. El precio total va en **"Flat fee"** porque queremos un precio fijo por banda.

   ⚠️ El último tier **debe terminar en 10**, no en `∞`. Los planes con >10 fisios siguen un flujo "Contactar ventas" — la lógica de la app lo gestiona, pero si dejas el último tier abierto Stripe cobraría 280 € también a clínicas grandes.

7. **Save product**.
8. Tras guardar, copia el `priceId`:
   - Producto → sección "Pricing" → clica el price → la URL muestra `price_1XxxxYyyyy...`.
   - 📝 Apúntalo. Va a `STRIPE_PRICE_ID`.

---

## 4. Configurar Customer Portal

1. **Settings** (engranaje, arriba derecha) → **Billing** → **Customer portal**
2. Activa:
   - ✅ **Invoices** → permitir descarga
   - ✅ **Payment methods** → add / update / remove
   - ✅ **Subscriptions** → marcar **"Cancel subscriptions"**, preferiblemente **"at the end of the billing period"**
   - ✅ **Customer information** → permitir actualizar email + dirección facturación
3. **Branding**: logo Kengo + color `#e75c3e` (coral).
4. **Save**.

---

## 5. Crear el Webhook endpoint

1. **Developers** (sidebar) → **Webhooks** → **+ Add endpoint**
2. **Endpoint URL**: la URL HTTP de tu backend Convex con sufijo `/stripe/webhook`.
   - Kengo: `https://backend.kengoapp.com/stripe/webhook`
3. **Description** (opcional): `Kengo Convex backend (test|live)`
4. **Events to send** — exactamente estos 13:
   - `checkout.session.completed`
   - `customer.created`
   - `customer.updated`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.created`
   - `invoice.finalized`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. **Add endpoint**.
6. En la página del endpoint, busca **"Signing secret"** → **Reveal** → copia `whsec_...`.
   - 📝 Apúntalo. Va a `STRIPE_WEBHOOK_SECRET`.

---

## 6. API key

1. **Developers** → **API keys**
2. Copia **Secret key** (`sk_test_...` o `sk_live_...` según modo).
   - 📝 Apúntala. Va a `STRIPE_SECRET_KEY`.
   - ⚠️ La secret key se muestra una sola vez al crearla. Si la pierdes, "Roll" para regenerar.

---

## 7. Variables de entorno (Railway)

El proyecto es Convex self-hosted en Railway, así que las env vars se gestionan en Railway directamente.

1. https://railway.app/dashboard → proyecto Kengo → servicio que corre Convex (suele llamarse `convex` o `backend`).
2. Pestaña **Variables** → **+ New Variable**.
3. Añade estas 7:

   | Variable | Valor | Notas |
   |---|---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_...` (o `sk_live_...`) | Paso 6 |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Paso 5 |
   | `STRIPE_PRICE_ID` | `price_1...` | Paso 3 |
   | `STRIPE_TRIAL_DAYS` | `14` | Días de trial gratuitos al crear clínica |
   | `STRIPE_GRACE_PERIOD_DAYS` | `7` | Días tras impago antes de bloquear el acceso |
   | `KENGO_APP_URL` | `https://kengoapp.com` (prod) o `http://localhost:4200` (dev) | URL base usada en `successUrl`/`cancelUrl` de Stripe Checkout |
   | `SALES_EMAIL` | email del equipo que atiende casos enterprise (+10 fisios) | Recibe el formulario "Contactar ventas" |

4. Railway redeploya automáticamente al guardar nuevas variables. Espera a que el servicio pase a "Active".

> Si más adelante separas `dev` y `prod` Convex, repite con un servicio Railway distinto (cada servicio tiene su set de variables).

---

## 8. Verificación

### 8.1 — Backend Convex despliega sin errores

```bash
npx convex dev --once
```

Esperado: `✔ Installed component stripe.` + `Convex functions ready!`. Si falla con un error de inicialización, suele ser `STRIPE_SECRET_KEY` mal formateada o falta.

### 8.2 — Webhook responde a Stripe

Stripe Dashboard → Developers → Webhooks → tu endpoint → **"Send test webhook"** → elige `customer.created` → **Send test event**.

Esperado: respuesta `200`. Si `400`/`500`:
- `400` con "Invalid signature" → `STRIPE_WEBHOOK_SECRET` mal copiado en Railway.
- `404` → la URL del endpoint no apunta al dominio HTTP correcto del backend Convex.
- `500` → mira logs de Railway.

### 8.3 — Recap de claves

Antes de cerrar la consola, verifica que tienes apuntadas/copiadas en gestor de contraseñas:

- `priceId` (paso 3)
- `whsec_...` (paso 5)
- `sk_test_...` o `sk_live_...` (paso 6)

---

## Replicación test → live

Cuando vayas a publicar en producción:

1. Toggle **Test → Live mode** en Stripe Dashboard.
2. Repite **pasos 2, 3, 4, 5, 6** en modo Live (productos/prices/webhooks/keys de test y live son independientes).
3. Sustituye en Railway las 4 variables relacionadas con Stripe por las versiones live:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → `whsec_...` del webhook live
   - `STRIPE_PRICE_ID` → priceId del producto live
   - (Las otras 3 se quedan iguales, salvo `KENGO_APP_URL` si tu URL prod cambia.)
4. Verifica con un pago real de prueba (puedes usar tu propia tarjeta y hacer refund inmediato desde el dashboard).

---

## Stripe Tax (opcional pero recomendado en EU)

Si vendes a clínicas en España u otros países EU:

1. Stripe Dashboard → **More → Tax** → **Activate**
2. Configura el **Origin address** (sede fiscal de la empresa)
3. En cada Price o subscription, Stripe Tax aplica IVA automáticamente según país del customer
4. Activarlo después no rompe suscripciones existentes; el IVA se añade en la siguiente factura

---

## Troubleshooting frecuente

| Síntoma | Causa probable | Fix |
|---|---|---|
| `Stripe error: No such price: price_xxx` | `STRIPE_PRICE_ID` apunta a un price de modo distinto al de la `STRIPE_SECRET_KEY` | Asegurar que ambos son test, o ambos live |
| `Invalid signature` en webhook | `STRIPE_WEBHOOK_SECRET` no actualizado tras crear/recrear el endpoint | Re-copiar el `whsec_...` actual del endpoint y re-deploy |
| Eventos llegan al webhook pero no se persisten | El componente `@convex-dev/stripe` maneja la persistencia automáticamente. Si la tabla `clinicBilling` (custom) no se actualiza, mira el handler `events`/`onEvent` en `convex/http.ts` (sesión 3 del plan) | Verificar que el handler está conectado y que el `subscription.metadata.orgId` contiene el `clinicId` |
| Customer Portal "Page not found" | URL portal no creada o branding incompleto | Volver a paso 4 y guardar |
| `KENGO_APP_URL` mal en redirects de checkout | Mezcla local/prod | Distinguir env vars por entorno; en local usar `http://localhost:4200` |

---

## Referencias

- Stripe Docs — Tiered pricing: https://docs.stripe.com/products-prices/pricing-models#tiered-pricing
- Stripe Docs — Customer Portal: https://docs.stripe.com/customer-management
- Stripe Docs — Webhooks: https://docs.stripe.com/webhooks
- Convex Stripe component: https://www.convex.dev/components/stripe
- Convex self-hosted env vars: depende del runner (en Railway, vía Variables del servicio)
