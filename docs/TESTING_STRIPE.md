# Tests E2E manuales — Suscripciones Stripe

> Guía paso a paso para validar el sistema de suscripciones en modo **test** antes de pasar a live. Mapea 1:1 con la **FASE 13** del plan en [`PLAN_STRIPE_SUSCRIPCIONES.md`](./PLAN_STRIPE_SUSCRIPCIONES.md).

---

## 1. Prerequisitos

### Cuenta y herramientas

- Cuenta de Stripe en **modo test** (mismo proyecto que producción, distinto modo).
- [Stripe CLI](https://stripe.com/docs/stripe-cli) instalado (`brew install stripe/stripe-cli/stripe` en macOS).
- Login en la CLI: `stripe login` y autorizar la cuenta de test.
- Convex en local levantado con `npx convex dev` (escucha por defecto en `http://localhost:8000`).
- App Angular en local: `cd apps/app && npm start` (`http://localhost:4200`).

### Variables de entorno (Convex deployment)

Confirmar que el deployment de Convex tiene cargadas las **claves test**:

| Variable | Valor test | Notas |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Secret key de la cuenta test |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (de `stripe listen`) | Ver siguiente sección |
| `STRIPE_PRICE_ID` | `price_...` | El price tiered creado en FASE 0 |
| `STRIPE_TRIAL_DAYS` | `14` | Trial estándar al crear clínica |
| `STRIPE_GRACE_PERIOD_DAYS` | `7` | Gracia tras `payment_failed` |
| `KENGO_APP_URL` | `http://localhost:4200` | Para redirecciones de checkout/portal |
| `RESEND_API_KEY` | (opcional) | Si falta, los emails se loguean sin enviarse |

---

## 2. Forwarding del webhook a local

```bash
stripe listen \
  --forward-to http://localhost:8000/stripe/webhook \
  --events invoice.payment_failed,invoice.paid,invoice.finalized,customer.subscription.trial_will_end,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,checkout.session.completed
```

La CLI imprime un `whsec_...` temporal. Usa ese valor como `STRIPE_WEBHOOK_SECRET` en Convex local mientras dura la sesión de testing.

> **Nota self-hosted**: si tu Convex está en Railway, usa el endpoint público (`https://backend.kengoapp.com/stripe/webhook`) y dispara los eventos desde el Stripe Dashboard test directamente.

---

## 3. Checklist E2E

Marca cada bloque tras superarlo. Si encuentras un bug, anótalo y arréglalo antes de continuar.

### 3.1 Onboarding (clínica nueva, trial de 14 días)

- [ ] Registrarse como nuevo fisio en `/registro`.
- [ ] Crear nueva clínica en `/mi-clinica`.
- [ ] Verificar que aparece banner amarillo de trial (si quedan ≤5 días) o que la card "Suscripción" muestra "Trial · 14 días" en `/mi-clinica`.
- [ ] En Stripe Dashboard test:
  - Customer creado con `metadata.orgId = <clinicId>`.
  - Subscription en estado `trialing`, `quantity = 1`, `trial_settings.end_behavior.missing_payment_method = "create_invoice"`.

### 3.2 Activación (añadir tarjeta durante el trial)

Desde 2026-09 añadir la tarjeta **no termina el trial**: la prueba sigue hasta
su fecha y el primer cargo sale entonces (antes se enviaba `trial_end: 'now'`).

- [ ] Entrar en `/mi-clinica/suscripcion` como owner.
- [ ] Click "Añadir método de pago" → se abre el resumen previo (sheet) con plan,
      importe base, los dos regímenes fiscales (IGIC / inversión del sujeto
      pasivo), la fecha del primer cargo y qué pedirá Stripe. "Cancelar" no navega.
- [ ] "Continuar a Stripe" → Checkout `mode: setup`. Bajo el botón aparece el
      texto (`custom_text.submit`) con el importe, el total con IGIC y "Tu
      periodo de prueba continúa hasta el {fecha}".
- [ ] Usar tarjeta `4242 4242 4242 4242`, fecha futura, CVC cualquiera, dirección con CP.
- [ ] Volver a la app con `?ok=1` → banner "Método de pago guardado" con la fecha del primer cargo.
- [ ] Verificar `clinicBilling.estadoLocal` sigue `"trialing"`; la sub en Stripe conserva
      `trial_end` y tiene `default_payment_method` y los `default_tax_rates` del régimen.
- [ ] El CTA pasa a "Gestionar pago" (abre el Portal). Email "Método de pago guardado" con la fecha.
- [ ] Acelerar `trial_end` desde el Dashboard (o test clock) → factura emitida y cobrada
      con el impuesto correcto → `invoice.paid` → `estadoLocal = "active"` y el banner de trial desaparece.

### 3.3 Crecimiento (escalado de tier por nº de fisios)

- [ ] Como admin, generar código de fisio en `/mi-clinica` y canjearlo con un usuario nuevo.
  - Tras canjear: `quantity = 2` en Stripe, tier `2-4` (170 €/mes).
- [ ] Repetir hasta llegar a 5 fisios totales.
  - `quantity = 5`, tier `5-10` (280 €/mes).
- [ ] Verificar **prorrateo**: en Stripe Dashboard → Subscription → "Upcoming invoice" debe mostrar líneas de prorrateo positivas y negativas.
- [ ] Eliminar 1 fisio (`/mi-clinica` → eliminar miembro). `quantity` baja, prorrateo crédito.

### 3.4 Cancelación y reactivación

- [ ] En `/mi-clinica/suscripcion`, click "Gestionar pago" → Customer Portal.
- [ ] Cancelar la suscripción.
- [ ] Volver a la app: card debe mostrar "Se cancelará el dd/mm/yyyy" + banner gris.
- [ ] Click "Reactivar" en la pantalla de suscripción → estado vuelve a `active`, banner desaparece.

### 3.5 Impago, gracia, wall de pago

- [ ] Forzar `payment_failed` desde la CLI:
  ```bash
  stripe trigger invoice.payment_failed
  ```
  > Ojo: `stripe trigger` crea un customer/subscription nuevo. Para probarlo sobre la clínica real: en Stripe Dashboard → Subscription → "Update" → cambiar tarjeta a `4000 0000 0000 0341` (rejected) y forzar el siguiente cobro desde "Actions → Charge subscription now".
- [ ] Verificar:
  - `clinicBilling.estadoLocal = "past_due"`.
  - `clinicBilling.graceUntil ≈ now + 7 días`.
  - Banner naranja "Hay un problema con el pago — quedan N días para resolverlo".
  - Email "payment_failed" enviado al admin (Resend Dashboard o logs si no hay key).
- [ ] Adelantar la gracia con el helper de QA:
  ```
  Convex Dashboard → Run Function → internal.billing.internal.setGraceUntilForTesting
  Args: { "clinicId": "<id>", "daysFromNow": -1 }
  ```
- [ ] Forzar el cron manualmente:
  ```
  Convex Dashboard → Run Function → internal.billing.internal.checkGracePeriodsExpired
  Args: {}
  ```
- [ ] Verificar `estadoLocal = "unpaid"`.
- [ ] Como admin, intentar entrar a `/planes/nuevo`: debe redirigir a `/mi-clinica/suscripcion?bloqueada=1` con card roja "Suscripción suspendida".
- [ ] Click "Actualizar método de pago" → Customer Portal → cambiar tarjeta a `4242 4242 4242 4242` y reintentar pago. Estado vuelve a `active`, gracia limpiada.

### 3.6 Pacientes no afectados por el bloqueo

- [ ] Con la clínica en estado `unpaid` (forzar antes), iniciar sesión como **paciente** de esa clínica.
- [ ] Verificar que puede:
  - Ver sus planes asignados.
  - Iniciar y completar una sesión de ejercicios.
  - Acceder a `/inicio`, `/perfil`.
- [ ] Confirmar que **no aparece** banner de billing al paciente.

### 3.7 +9 fisios (corte enterprise)

- [ ] Llevar a una clínica de prueba a 9 fisios facturables.
- [ ] Como admin, generar código para el fisio nº 10 desde `/mi-clinica`:
  - Backend lanza `REQUIERE_CONTACTO_VENTAS`.
  - El dialog `GenerarCodigoDialog` se cierra automáticamente.
  - Se abre `ContactarVentasDialog` con el mensaje pre-rellenado.
- [ ] Enviar el formulario.
  - Verificar email recibido en `CONTACT_EMAILS` (Resend Dashboard).
  - Toast "Mensaje enviado" en la UI.
- [ ] Caso alternativo: si un fisio intenta canjear un código existente y la clínica ya está al límite, debe fallar con el mismo `REQUIERE_CONTACTO_VENTAS` al canjear.

### 3.7b Contrato a medida (plazas gestionadas desde Stripe)

Procedimiento para el equipo de gestión en `docs/Guia-Gestores-Kengo.docx`;
referencia técnica en `docs/GUIA_ENTERPRISE_VENTAS.md`.

- [ ] Sobre la clínica anterior (9 fisios, bloqueada), en Stripe Dashboard:
      cambiar la suscripción a un price a medida y poner `quantity = 15`.
- [ ] Verificar en Convex que `clinicBilling.limiteFisios === 15`.
- [ ] En `/mi-clinica/suscripcion`: el plan se muestra como "A medida" y la barra
      dice "9 / 15". No aparecen ni las pricing cards, ni el CTA de contratar,
      ni el toggle de pacientes ilimitados.
- [ ] Invitar fisios hasta el nº 15 → todas las altas deben pasar.
- [ ] Intentar el nº 16 → `PLAZAS_AGOTADAS` con el mensaje de ampliar contrato.
- [ ] Añadir y eliminar un fisio → comprobar en Stripe que la quantity **sigue
      en 15**: Convex ya no la reescribe en clínicas a medida.
- [ ] Devolver la suscripción al price estándar → `limiteFisios` desaparece y el
      techo vuelve a 9.
- [ ] Ejecutar `billing.actions.reconcileLimitesAMedida` a mano dos veces:
      la segunda debe reportar `ajustadas: 0` (idempotente).

### 3.8 Webhooks idempotentes

- [ ] Reenviar un evento ya procesado desde Stripe Dashboard → Webhooks → Resend.
- [ ] Verificar que no hay efectos secundarios duplicados (emails repetidos, estados volátiles).

---

### 3.9 Régimen fiscal (IGIC vs inversión del sujeto pasivo)

Requiere `STRIPE_TAX_RATE_ID_IGIC` (Tax Rate IGIC 7 % de modo test) en el
deployment. Todo Checkout es `mode: setup`; el cobro lo hace `finalizeCheckout`.

- [ ] **A. Canarias, trial**: clínica nueva → sub `trialing` sin `automatic_tax`
      → la página de suscripción muestra "Pendiente de dirección fiscal" →
      Checkout con `4242…`, dirección ES y CP `35001` → tras el retorno:
      customer `tax_exempt: none`, sub `default_tax_rates = [txr IGIC]`,
      factura con línea IGIC 7 %, UI "IGIC 7 %".
- [ ] **B. Madrid, trial**: igual con CP `28001` → customer `tax_exempt:
      reverse` + footer legal, factura sin cuota con "Inversión del sujeto
      pasivo", UI "Inversión del sujeto pasivo".
- [ ] **C. Reactivación**: cancelar la sub en el Dashboard → estado `canceled`
      → Checkout (setup) con CP `38001` → `finalizeCheckout` crea la S2 en
      servidor con IGIC, `clinicBilling.stripeSubscriptionId` apunta a la S2,
      factura pagada, UI activa. La S1 `canceled` no se toca.
- [ ] **D. Cambio de dirección en el Portal**: pasar de `28001` a `35001` →
      `customer.updated` → `syncRegimenFiscal` añade IGIC a la sub, quita
      `reverse` y retira el footer. Volver a `28001` → inverso. En logs, el
      segundo `customer.updated` (el que provoca nuestro propio update) no
      escribe nada.
- [ ] **E. SCA en reactivación**: tarjeta `4000 0027 6000 3184` en el flujo C
      → S2 `incomplete` → UI bloqueada con CTA; caduca sola o se repite el
      Checkout.
- [ ] **F. Ceuta `51001` y Francia** → `inversion`.
- [ ] **G. Trial vencido sin tarjeta** (`missing_payment_method:
      create_invoice`, S1 `past_due`) → Checkout → `create_subscription`
      anula la factura abierta de la S1, la cancela y crea la S2 con el
      régimen correcto.
- [ ] **H. Backfill**: `backfillRegimenFiscal {"apply": false}` → revisar →
      `{"apply": true}` → repetir el dry-run devuelve 0 cambios.

## 4. Comandos útiles

```bash
# Forzar evento sin Dashboard (crea customer/subscription artificial)
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.paid

# Ver customers creados por esta cuenta
stripe customers list --limit 10

# Ver subscriptions
stripe subscriptions list --limit 10

# Ver eventos recientes (útil tras un test)
stripe events list --limit 20
```

### Helpers de QA (Convex Dashboard → Run Function)

| Función | Args | Propósito |
|---|---|---|
| `internal.billing.migrations.getMigrationPreview` | `{}` | Cuántas clínicas se migrarían y cómo |
| `internal.billing.migrations.migrateExistingClinics` | `{}` o `{ trialDaysOverride: 7 }` | Ejecuta la migración (one-shot) |
| `internal.billing.internal.setGraceUntilForTesting` | `{ clinicId, daysFromNow: -1 }` | Forzar gracia agotada |
| `internal.billing.internal.checkGracePeriodsExpired` | `{}` | Disparar manualmente el cron |
| `internal.billing.actions.startTrialForClinic` | `{ clinicId, trialDays?: 30 }` | Crear customer+subscription manualmente |

---

## 5. Limpieza tras los tests

1. **Stripe Dashboard test**: borrar customers de prueba (Settings → Customers → Delete). Las subscriptions y facturas asociadas se borran en cascada.
2. **Convex Dashboard**: vaciar la tabla `clinicBilling` desde el panel si quieres empezar limpio (Stripe component tiene sus propias tablas — borrar customers en Stripe es lo importante).
3. **Resend Dashboard**: revisar que no quedan emails encolados raros.

---

## 6. Antes de pasar a live (FASE 14)

- [ ] Ejecutar `getMigrationPreview` en producción (lectura, sin riesgo) para confirmar el alcance.
- [ ] Replicar Product/Price/Webhook en Stripe **live mode**.
- [ ] Cambiar las variables de entorno del deployment de Convex prod a las **live keys**.
- [ ] Ejecutar `migrateExistingClinics` desde Convex Dashboard prod **una sola vez**.
- [ ] Verificar en Stripe live que los customers/subscriptions se han creado.
- [ ] Comprobar que los emails de anuncio y enterprise han llegado (Resend Dashboard).
- [ ] Activar alertas de webhooks fallidos en Stripe live.
