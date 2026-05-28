import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { registerRoutes as registerStripeRoutes } from "@convex-dev/stripe";
import {
  authComponent,
  createAuth,
  getPendingResetToken,
  clearPendingResetToken,
  getPendingMagicLink,
  clearPendingMagicLink,
} from "./auth";

const http = httpRouter();

// Better-Auth standard routes (login, signup, signout, etc.)
authComponent.registerRoutes(http, createAuth, { cors: true });

// Stripe webhook handler (eventos auto-persistidos por el componente).
// `onEvent` corre tras el procesamiento por defecto del componente y nosotros
// sincronizamos `clinicBilling` + disparamos emails al admin.
registerStripeRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  onEvent: async (ctx, event) => {
    // Resolución de `clinicId` para el evento (cuando aplica). Se usa tanto
    // para los tipos `customer.subscription.*` (lectura directa de
    // `metadata.orgId`) como para los `invoice.*` (resolución vía componente
    // a partir de `subscription`).
    const resolveClinicId = async (): Promise<Id<"clinics"> | undefined> => {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
        case "customer.subscription.trial_will_end":
        case "checkout.session.completed": {
          const orgId = (event.data.object as { metadata?: Record<string, string> })
            .metadata?.["orgId"];
          return orgId ? (orgId as Id<"clinics">) : undefined;
        }
        case "invoice.paid":
        case "invoice.payment_failed": {
          const invoice = event.data.object as {
            subscription?: string;
          };
          if (!invoice.subscription) return undefined;
          const sub = await ctx.runQuery(
            components.stripe.public.getSubscription,
            { stripeSubscriptionId: invoice.subscription },
          );
          return sub?.orgId ? (sub.orgId as Id<"clinics">) : undefined;
        }
        default:
          return undefined;
      }
    };

    const eventCreatedMs = event.created * 1000;
    const clinicId = await resolveClinicId();

    // Dedup global por `event.id`. Si ya procesamos este evento (caso típico:
    // Stripe reentrega por timeout), abortamos sin ejecutar efectos
    // colaterales. El componente Stripe ya hace upserts idempotentes en sus
    // tablas internas, pero nuestro `onEvent` no estaría protegido sin esto.
    const { skip } = await ctx.runMutation(
      internal.billing.internal.recordWebhookEvent,
      {
        eventId: event.id,
        eventType: event.type,
        createdMs: eventCreatedMs,
        clinicId,
      },
    );
    if (skip) {
      console.log(
        `[stripe webhook] evento duplicado ${event.id} (${event.type}) — ignorado`,
      );
      return;
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          if (!clinicId) return;
          const sub = event.data.object;
          const item = sub.items.data[0];
          await ctx.runMutation(internal.billing.internal.applySubscriptionEvent, {
            clinicId,
            status: sub.status,
            trialEnd: sub.trial_end ? sub.trial_end * 1000 : undefined,
            currentPeriodEnd: item?.current_period_end
              ? item.current_period_end * 1000
              : undefined,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            quantity: item?.quantity,
            eventCreatedMs,
          });
          break;
        }
        case "customer.subscription.deleted": {
          if (!clinicId) return;
          await ctx.runMutation(internal.billing.internal.markCanceled, {
            clinicId,
          });
          // Email de cancelación al propietario (referencia: Bloque G del
          // plan production-ready). El destinatario es determinista gracias
          // a `clinics.ownerUserId`.
          await ctx.scheduler.runAfter(
            0,
            internal.billing.actions.notifySubscriptionCanceled,
            { clinicId },
          );
          break;
        }
        case "customer.subscription.trial_will_end": {
          if (!clinicId) return;
          await ctx.runMutation(
            internal.billing.internal.enqueueTrialEndingNotification,
            { clinicId },
          );
          break;
        }
        case "invoice.paid": {
          if (!clinicId) return;
          await ctx.runMutation(
            internal.billing.internal.markActiveAfterPayment,
            { clinicId },
          );
          break;
        }
        case "invoice.payment_failed": {
          if (!clinicId) return;
          const days = Number(process.env["STRIPE_GRACE_PERIOD_DAYS"] ?? 7);
          await ctx.runMutation(
            internal.billing.internal.markPastDueWithGrace,
            { clinicId, gracePeriodDays: days },
          );
          break;
        }
        case "checkout.session.completed": {
          if (!clinicId) return;
          const session = event.data.object;
          // Bifurcación según el modo de la session:
          //   - `setup`: el customer acaba de añadir su método de pago para
          //     terminar el trial. `finalizeSetupCheckout` adjunta el PM a la
          //     sub existente y pone `trial_end: 'now'` → Stripe cobra y la
          //     sub pasa a `active` vía webhooks posteriores.
          //   - `subscription`: el customer reactiva tras un `canceled`. Stripe
          //     ha creado una nueva subscription S2; `finalizeSubscriptionCheckout`
          //     persiste su ID en `clinicBilling.stripeSubscriptionId` para que
          //     futuras acciones operen contra S2 y no contra la S1 huérfana.
          // En ambos casos, además, encolamos el welcome email (idempotente).
          if (session.mode === "setup") {
            await ctx.scheduler.runAfter(
              0,
              internal.billing.actions.finalizeSetupCheckout,
              { clinicId, sessionId: session.id },
            );
          } else if (session.mode === "subscription") {
            await ctx.scheduler.runAfter(
              0,
              internal.billing.actions.finalizeSubscriptionCheckout,
              { clinicId, sessionId: session.id },
            );
          }
          await ctx.scheduler.runAfter(
            0,
            internal.billing.actions.notifyCheckoutCompleted,
            { clinicId },
          );
          break;
        }
        default:
          // Otros eventos (customer.created/updated, payment_intent.*,
          // checkout.session.completed, invoice.created/finalized) ya los
          // persiste el componente Stripe en sus tablas; no requieren acción.
          break;
      }
    } catch (err) {
      console.error("[stripe webhook] Error procesando evento", event.type, err);
      // Re-lanzamos para que Stripe reintente el webhook automáticamente.
      throw err;
    }
  },
});

// ─── CORS helpers ───

const ALLOWED_ORIGINS = [
  "https://kengoapp.com",
  "https://www.kengoapp.com",
  "http://localhost:4200",
  "http://localhost:4210",
  // App nativa (Capacitor): origin estable definido en `apps/app/capacitor.config.ts`
  // (`server.hostname`) — usado tanto en iOS como en Android.
  "https://app.kengoapp.local",
  // iOS WKWebView puede enviar el Origin con el esquema interno aunque la SPA
  // se cargue por https. Lo permitimos explícitamente.
  "capacitor://app.kengoapp.local",
  // Esquemas por defecto del WebView Capacitor cuando no se sobreescriben.
  "capacitor://localhost",
  "https://localhost",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function optionsHandler() {
  return httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  });
}

// ─── RESET PASSWORD ───
// Flujo completo: validar código propio + actualizar password en Better-Auth.
// Llamado directamente desde Angular (no desde un Convex action).

http.route({
  path: "/api/auth/convex-reset-password",
  method: "OPTIONS",
  handler: optionsHandler(),
});

http.route({
  path: "/api/auth/convex-reset-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);

    let body: { email?: string; codigo?: string; nuevaPassword?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON", code: "DATOS_INVALIDOS" }),
        { status: 400, headers },
      );
    }

    const email = body.email?.toLowerCase().trim();
    const codigo = body.codigo;
    const nuevaPassword = body.nuevaPassword;

    // Validaciones
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, message: "Email no válido", code: "CODIGO_INVALIDO" }),
        { status: 400, headers },
      );
    }
    if (!codigo || codigo.length !== 6) {
      return new Response(
        JSON.stringify({ success: false, message: "Código no válido", code: "CODIGO_INVALIDO" }),
        { status: 400, headers },
      );
    }
    if (!nuevaPassword || nuevaPassword.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "La contraseña debe tener al menos 6 caracteres",
          code: "PASSWORD_MUY_CORTA",
        }),
        { status: 400, headers },
      );
    }

    // Paso 1: Validar y consumir código de recuperación
    const codeResult = await ctx.runMutation(
      internal.auth.mutations.validateAndConsumeRecoveryCode,
      { email, codigo },
    );

    if (!codeResult.valid) {
      const messages: Record<string, string> = {
        CODIGO_INVALIDO: "Código no válido",
        CODIGO_EXPIRADO: "El código ha expirado",
        INTENTOS_AGOTADOS: "Has agotado los intentos para este código",
      };
      return new Response(
        JSON.stringify({
          success: false,
          message: messages[codeResult.error!] ?? "Código no válido",
          code: codeResult.error,
        }),
        { status: 400, headers },
      );
    }

    // Paso 2: Actualizar password en Better-Auth
    const auth = createAuth(ctx);

    try {
      clearPendingResetToken(email);
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: "https://kengoapp.com/reset" },
      });

      const resetToken = getPendingResetToken(email);
      if (resetToken) {
        await auth.api.resetPassword({
          body: { newPassword: nuevaPassword, token: resetToken },
        });
      } else {
        // No hay BA user para este email. Solo es un caso legítimo si la fila
        // en `users` aún está en pre-registro (`externalId: pending-…`):
        // paciente creado por el fisio que pidió reset antes de consumir el
        // magic link. En ese caso creamos el BA user con la nueva password.
        // En cualquier otro caso devolvemos 500 — antes había un "fallback
        // silencioso" que delegaba la sincronización al siguiente login vía
        // signUpAndSignIn, lo que generaba la vulnerabilidad de takeover.
        const convexUser = await ctx.runQuery(
          internal.auth.queries.findUserByEmail,
          { email },
        );
        const isPending =
          convexUser?.externalId?.startsWith("pending-") ?? false;

        if (!convexUser || !isPending) {
          console.error("[HTTP reset-password] BA user no existe y no es pending", {
            email,
            hasConvexUser: !!convexUser,
            externalId: convexUser?.externalId,
          });
          return new Response(
            JSON.stringify({
              success: false,
              message: "No se pudo actualizar la contraseña. Vuelve a solicitar un código.",
              code: "RESET_FAILED",
            }),
            { status: 500, headers },
          );
        }

        const name = `${convexUser.firstName} ${convexUser.lastName}`.trim() || email;
        await auth.api.signUpEmail({
          body: { email, password: nuevaPassword, name },
        });
      }
    } catch (err) {
      console.error("[HTTP reset-password] Better-Auth password update failed:", err);
      return new Response(
        JSON.stringify({
          success: false,
          message: "No se pudo actualizar la contraseña. Vuelve a solicitar un código.",
          code: "RESET_FAILED",
        }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Tu contraseña ha sido actualizada correctamente",
      }),
      { status: 200, headers },
    );
  }),
});

// ─── ESTABLECER PASSWORD ───
// Para usuarios que accedieron via magic link y necesitan crear su contraseña.

http.route({
  path: "/api/auth/convex-set-password",
  method: "OPTIONS",
  handler: optionsHandler(),
});

http.route({
  path: "/api/auth/convex-set-password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);

    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON" }),
        { status: 400, headers },
      );
    }

    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password || password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: "Datos inválidos" }),
        { status: 400, headers },
      );
    }

    const auth = createAuth(ctx);

    try {
      clearPendingResetToken(email);
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: "https://kengoapp.com/reset" },
      });

      const resetToken = getPendingResetToken(email);
      if (!resetToken) {
        // En el flujo legítimo (magic link → /establecer-password) el BA user
        // ya existe (lo crea `auth.api.signInMagicLink` en
        // `consume-access-token`). Llegar aquí sin BA user indica un bug
        // aguas arriba — no enmascararlo creando uno nuevo.
        console.error("[HTTP set-password] BA user no existe para email autenticado", { email });
        return new Response(
          JSON.stringify({ success: false, message: "Error al establecer la contraseña" }),
          { status: 500, headers },
        );
      }

      await auth.api.resetPassword({
        body: { newPassword: password, token: resetToken },
      });
    } catch (err) {
      console.error("[HTTP set-password] Error:", err);
      return new Response(
        JSON.stringify({ success: false, message: "Error al establecer la contraseña" }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Contraseña establecida correctamente" }),
      { status: 200, headers },
    );
  }),
});

// ─── CONSUMIR ACCESS TOKEN (magic link del QR) ───
// Valida el token QR, genera un magic link Better-Auth y devuelve la URL
// que el cliente visita para establecer sesión Convex.

http.route({
  path: "/api/auth/consume-access-token",
  method: "OPTIONS",
  handler: optionsHandler(),
});

http.route({
  path: "/api/auth/consume-access-token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);

    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "DATOS_INVALIDOS" }),
        { status: 400, headers },
      );
    }

    const token = body.token?.trim();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "TOKEN_NO_PROPORCIONADO" }),
        { status: 400, headers },
      );
    }

    // Paso 1: validar y consumir el access token propio
    const result = await ctx.runMutation(
      internal.accessTokens.mutations.validateAndConsume,
      { token },
    );
    if (!result.valid) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers },
      );
    }

    const email = result.email as string;

    // Paso 2: generar magic link Better-Auth para el email del paciente
    const auth = createAuth(ctx);
    clearPendingMagicLink(email);

    try {
      await auth.api.signInMagicLink({
        body: { email, callbackURL: "/" },
        headers: request.headers,
      });
    } catch (err) {
      console.error("[HTTP] signInMagicLink falló:", err);
      return new Response(
        JSON.stringify({ success: false, error: "ERROR_GENERANDO_MAGIC_LINK" }),
        { status: 500, headers },
      );
    }

    const magicLinkToken = getPendingMagicLink(email);
    if (!magicLinkToken) {
      return new Response(
        JSON.stringify({ success: false, error: "MAGIC_LINK_NO_GENERADO" }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        magicLinkToken,
        email,
      }),
      { status: 200, headers },
    );
  }),
});

// ─── CONTACT FORM ───
// Landing envía el formulario de contacto desde kengoapp.com.

http.route({
  path: "/api/contact/send",
  method: "OPTIONS",
  handler: optionsHandler(),
});

http.route({
  path: "/api/contact/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);

    let body: {
      nombre?: string;
      email?: string;
      asunto?: string;
      mensaje?: string;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON" }),
        { status: 400, headers },
      );
    }

    const nombre = body.nombre?.trim();
    const email = body.email?.trim();
    const mensaje = body.mensaje?.trim();
    const asunto = (body.asunto?.trim() || "Mensaje de contacto");

    if (!nombre || !email || !mensaje) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Los campos nombre, email y mensaje son obligatorios",
        }),
        { status: 400, headers },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "El email proporcionado no es válido",
        }),
        { status: 400, headers },
      );
    }

    const sent = await ctx.runAction(
      internal.email.actions.sendContactForm,
      { nombre, email, asunto, mensaje },
    );

    if (!sent) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No se pudo enviar el mensaje. Inténtalo más tarde.",
        }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Mensaje enviado correctamente" }),
      { status: 200, headers },
    );
  }),
});

export default http;
