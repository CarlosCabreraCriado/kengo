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

### 3.2 Activación (añadir tarjeta y salir del trial)

- [ ] Entrar en `/mi-clinica/suscripcion` como admin.
- [ ] Click "Añadir método de pago".
- [ ] En Stripe Checkout, usar tarjeta `4242 4242 4242 4242`, fecha cualquiera futura, CVC cualquiera.
- [ ] Volver a la app con `?ok=1`.
- [ ] Verificar `clinicBilling.estadoLocal = "active"` (Convex Dashboard → tabla).
- [ ] El banner de trial desaparece.

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

### 3.7 +10 fisios (corte enterprise)

- [ ] Llevar a una clínica de prueba a 10 fisios facturables.
- [ ] Como admin, generar código para el fisio nº 11 desde `/mi-clinica`:
  - Backend lanza `REQUIERE_CONTACTO_VENTAS`.
  - El dialog `GenerarCodigoDialog` se cierra automáticamente.
  - Se abre `ContactarVentasDialog` con el mensaje pre-rellenado.
- [ ] Enviar el formulario.
  - Verificar email recibido en `CONTACT_EMAILS` (Resend Dashboard).
  - Toast "Mensaje enviado" en la UI.
- [ ] Caso alternativo: si un fisio intenta canjear un código existente y la clínica ya está al límite, debe fallar con el mismo `REQUIERE_CONTACTO_VENTAS` al canjear.

### 3.8 Webhooks idempotentes

- [ ] Reenviar un evento ya procesado desde Stripe Dashboard → Webhooks → Resend.
- [ ] Verificar que no hay efectos secundarios duplicados (emails repetidos, estados volátiles).

---

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
