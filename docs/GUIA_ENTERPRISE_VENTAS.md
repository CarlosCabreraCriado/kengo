# Contratos a medida (>9 fisioterapeutas) — referencia técnica

> **El procedimiento para el equipo de gestión está en `docs/Guia-Gestores-Kengo.docx`**
> (se regenera con `npm run guia:gestores`; el contenido vive en
> `scripts/generar-guia-gestores.js`). Ese documento cubre además descuentos,
> trials, impagos, cancelaciones y las operaciones que requieren desarrollo.
>
> Este fichero es la contraparte técnica: qué hay debajo y dónde tocarlo.

## El mecanismo

La `quantity` de una suscripción de Stripe cuyo price **no** sea de autoservicio
son las **plazas contratadas**, y pasan a ser el techo de asientos facturables
(`fisio` + `admin`) de la clínica.

- **Discriminador**: `esPriceAMedida(priceId, conocidos)` en
  `convex/billing/_webhookHelpers.ts`. Los `conocidos` son
  `STRIPE_PRICE_ID_BASE`, `STRIPE_PRICE_ID_ILIMITADO` y el legacy
  `STRIPE_PRICE_ID`. Devuelve `false` ante cualquier duda (sin `priceId`, o sin
  ningún price conocido configurado): un falso positivo sustituiría el tope de 9
  por la quantity en toda la base de clínicas.
- **Campo persistido**: `clinicBilling.limiteFisios` (`convex/schema.ts`).
  Presente ⟺ contrato a medida. Solo lo escriben el webhook
  (`applySubscriptionEvent`, invocado desde `convex/http.ts`) y la
  reconciliación diaria. Ningún flujo de la app lo toca.
- **Lectura**: `limiteFisiosDeClinica` en `convex/_helpers/capacity.ts`, base de
  `assertCapacidadFisios` / `excedeCapacidadFisios`. Ausente ⟹ rige
  `LIMITE_FISIOS_AUTOSERVICIO` (9).
- **Errores**: `REQUIERE_CONTACTO_VENTAS` (autoservicio al tope) frente a
  `PLAZAS_AGOTADAS` (contrato agotado). Llevan al usuario a sitios distintos.

## Consecuencias en una clínica a medida

- `syncQuantityFromMemberships` y `updateStripeQuantity` **no tocan Stripe**:
  la quantity la manda ventas.
- `setPlanVariante` lanza `SUSCRIPCION_A_MEDIDA` (haría swap de price y
  borraría el negociado). `createCheckoutSession` solo lo lanza en la rama
  `create_subscription` (sin sub viva crearía una S2 con price de
  autoservicio); **en trial el Checkout sí se permite**: es `mode: setup`,
  adjunta la tarjeta y fija el régimen fiscal sin tocar el price, y
  `finalizeCheckout` **respeta el `trial_end` pactado** (no envía
  `trial_end: 'now'` como en autoservicio). Con la sub viva el owner gestiona la
  tarjeta desde el Portal, que no tiene gate a medida.
- Sin cap de pacientes (`checkCapacidadPacientes`), igual que
  `enterprise_pending`.
- La query `getMyClinicSubscription` devuelve `esAMedida: true`, `plan: null` y
  `precioMensualActualEur: 0`. El importe lo lee la pantalla de Stripe en vivo
  con `billing.actions.getProximaFacturaForClinic` (preview de la próxima
  factura: neto, impuestos, total y fecha; owner-only).
- Etiqueta de factura "Plan a medida" vía `syncStripeCustomerTierLabel`; el
  webhook `customer.subscription.*` encola `syncTierLabelAMedida` para que un
  cambio de price hecho en el Dashboard no deje el tramo anterior en la
  factura siguiente.
- **Impuestos: no fijar `tax_rates` en el item de la suscripción.** La app
  pone `default_tax_rates` (IGIC) o `tax_exempt: reverse` según el CP que
  recoge el Checkout (`docs/SETUP_STRIPE_CONVEX.md` §Impuestos). Un tax rate a
  nivel de item prevalece sobre el default de la sub y cobraría IGIC aunque la
  dirección fiscal resulte peninsular. Si ventas lo añadió a mano, quitarlo
  del item; el régimen correcto llega al completar el owner su Checkout.

## Vinculación con la clínica

El webhook resuelve la clínica leyendo `subscription.metadata.orgId`
(`convex/http.ts`). Una suscripción creada a mano sin ese metadato no propaga
nada. Si la clínica no tenía `stripeSubscriptionId` local, `applySubscriptionEvent`
lo adopta del evento; si ya tenía otro, `isForeignSubscriptionEvent` descarta el
evento (protección anti-zombi).

## Red de seguridad

`billing.actions.reconcileLimitesAMedida` — cron `billing-reconcile-limites-a-medida`
a las 04:15 UTC (`convex/crons.ts`). Relee price y quantity de cada suscripción
viva y refresca `limiteFisios`. Idempotente; salta las `canceled` /
`incomplete_expired`; un fallo por clínica no aborta el barrido.

## Cuidado al crear prices

Un price nuevo que no se registre como conocido convierte en enterprise a toda
clínica que lo use. No crear prices para promociones de autoservicio: usar
cupones. Documentado también en `docs/SETUP_STRIPE_CONVEX.md`.

## Titularidad del método de pago

El customer de Stripe es de la **clínica**, pero cada tarjeta la aporta una
persona: el owner del momento, único que puede abrir Checkout/Portal. Al
transferir la propiedad, esa tarjeta seguiría cobrándose sin que su titular
pudiera tocarla (pierde el Portal con la propiedad). Para evitarlo:

- **Tabla `clinicPaymentMethods`** (`convex/schema.ts`): un PM por fila con
  `aportadaPorUserId`, marca/últimos 4/caducidad, `attachedAt` y, si procede,
  `detachedAt` + `detachedVia` (`titular` | `transfer` | `stripe`). Nunca se
  borra: es historial. La escriben `convex/billing/paymentMethods.ts`
  (mutations internas), el webhook `payment_method.attached|detached|
  automatically_updated` y `customer.updated` en `convex/http.ts`,
  `finalizeSetupCheckout` y la reconciliación.
- **Atribución**: fila nueva → owner actual de la clínica. En el backfill /
  reconciliación, `ownerEnFecha(audits, ownerActual, pm.created)`
  (`_helpers.ts`) reconstruye quién era owner cuando se adjuntó a partir de
  `clinicOwnershipAudit`. El PM lleva además `metadata.orgId`,
  `aportadaPorUserId` y `aportadaPorEmail` en Stripe
  (`stampPaymentMethodMetadata`) para que soporte lo vea en el Dashboard.
- **Default que cobra**: `clinicBilling.stripeSubscriptionDefaultPaymentMethodId`
  y `stripeCustomerDefaultPaymentMethodId` en crudo; el activo se deriva con
  `defaultPaymentMethodDe` (la subscription manda). Se espejan desde
  `customer.subscription.*` y `customer.updated`.
- **Retirada por el titular**: `billing.actions.retirarMiMetodoDePago` exige
  `aportadaPorUserId === yo` (`getForContributor`), no ser owner ni miembro.
  Hace `detach` + `markDetached`. Si era la activa y la suscripción sigue viva
  (`debeMarcarPendiente`), sella `clinicBilling.metodoPagoPendienteDesde` y
  programa `notifyMetodoPagoRetirado` al owner (idempotente por
  `avisoRetiradaEnviadoAt`; se descarta si entre tanto llegó otra tarjeta o si
  quien retiró es el owner). No corta el servicio: la clínica sigue hasta la
  siguiente renovación y entonces aplica la gracia habitual.
- **Transferencia**: `transferOwnership` acepta `retirarMiMetodoDePago`
  (opcional → los clientes nativos antiguos equivalen a "mantener"). Con
  `true`, `retirarMetodosDePagoDeUsuarioEnClinica` desvincula las tarjetas
  vivas del saliente (`detachedVia: "transfer"`) y encadena los emails
  (`notifyOwnershipTransferred`, a ambos owners).
- **UI web**: `/perfil` → "Tarjetas aportadas a clínicas" (lista + Retirar);
  `/mi-clinica/suscripcion` → banner ámbar de pendiente y nota "se cobra en la
  tarjeta de X"; diálogo de transferencia con la elección. La app nativa
  1.2.0 no tiene estas pantallas: los emails cubren el hueco.
- **Reconciliación**: `billing.actions.reconcilePaymentMethods({ apply })`,
  dry-run por defecto; cron `billing-reconcile-metodos-pago` a las 05:00 UTC
  con `apply: true`. Altas que perdió el webhook, bajas hechas desde el
  Dashboard y refresco de defaults; errores por clínica en `fallidas`.

Huecos: una tarjeta de empresa aportada por el gerente saliente puede
retirarla ese gerente (se acepta: podía cancelar la suscripción entera cuando
era owner, no interrumpe el servicio y el owner queda avisado con la gracia
por delante). Un `customer.updated` que llegue antes que el
`payment_method.attached` deja el default apuntando a un PM sin fila hasta
que llega el alta: `limpiarPendienteSiHayDefaultVivo` lo resuelve entonces.

## Huecos conocidos

- `pause_collection` no se lee: una suscripción pausada que Stripe mantiene en
  `active` deja a la clínica operando sin facturación. Si el status llega a
  `paused`, cae en el `default` de `mapStripeStatusToEstadoLocal` → `none` →
  bloqueo inmediato sin gracia ni email.
- Reactivar una cancelada creando una suscripción nueva no funciona: el evento
  se descarta por `isForeignSubscriptionEvent`. La vía soportada es el Checkout
  desde la app.
