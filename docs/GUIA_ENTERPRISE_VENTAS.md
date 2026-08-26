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
- `createCheckoutSession` y `setPlanVariante` lanzan `SUSCRIPCION_A_MEDIDA`
  (harían swap de price y borrarían el negociado).
- Sin cap de pacientes (`checkCapacidadPacientes`), igual que
  `enterprise_pending`.
- La query `getMyClinicSubscription` devuelve `esAMedida: true`, `plan: null` y
  `precioMensualActualEur: 0`; el importe real vive en las facturas.
- Etiqueta de factura "Plan a medida" vía `syncStripeCustomerTierLabel`.

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

## Huecos conocidos

- `pause_collection` no se lee: una suscripción pausada que Stripe mantiene en
  `active` deja a la clínica operando sin facturación. Si el status llega a
  `paused`, cae en el `default` de `mapStripeStatusToEstadoLocal` → `none` →
  bloqueo inmediato sin gracia ni email.
- Reactivar una cancelada creando una suscripción nueva no funciona: el evento
  se descarta por `isForeignSubscriptionEvent`. La vía soportada es el Checkout
  desde la app.
