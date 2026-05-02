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
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object;
          const orgId = sub.metadata?.["orgId"];
          if (!orgId) return;
          const item = sub.items.data[0];
          await ctx.runMutation(internal.billing.internal.applySubscriptionEvent, {
            clinicId: orgId as Id<"clinics">,
            status: sub.status,
            trialEnd: sub.trial_end ? sub.trial_end * 1000 : undefined,
            currentPeriodEnd: item?.current_period_end
              ? item.current_period_end * 1000
              : undefined,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            quantity: item?.quantity,
          });
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const orgId = sub.metadata?.["orgId"];
          if (!orgId) return;
          await ctx.runMutation(internal.billing.internal.markCanceled, {
            clinicId: orgId as Id<"clinics">,
          });
          break;
        }
        case "customer.subscription.trial_will_end": {
          const sub = event.data.object;
          const orgId = sub.metadata?.["orgId"];
          if (!orgId) return;
          await ctx.runMutation(
            internal.billing.internal.enqueueTrialEndingNotification,
            { clinicId: orgId as Id<"clinics"> },
          );
          break;
        }
        case "invoice.paid": {
          const invoice = event.data.object;
          const subId =
            (invoice as unknown as { subscription?: string }).subscription;
          if (!subId) return;
          const sub = await ctx.runQuery(
            components.stripe.public.getSubscription,
            { stripeSubscriptionId: subId },
          );
          const orgId = sub?.orgId;
          if (!orgId) return;
          await ctx.runMutation(
            internal.billing.internal.markActiveAfterPayment,
            { clinicId: orgId as Id<"clinics"> },
          );
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const subId =
            (invoice as unknown as { subscription?: string }).subscription;
          if (!subId) return;
          const sub = await ctx.runQuery(
            components.stripe.public.getSubscription,
            { stripeSubscriptionId: subId },
          );
          const orgId = sub?.orgId;
          if (!orgId) return;
          const days = Number(process.env["STRIPE_GRACE_PERIOD_DAYS"] ?? 7);
          await ctx.runMutation(
            internal.billing.internal.markPastDueWithGrace,
            { clinicId: orgId as Id<"clinics">, gracePeriodDays: days },
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
      // 2a: Generar token de reset (el callback captura el token en memoria)
      clearPendingResetToken(email);
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: "https://kengoapp.com/reset" },
      });

      // 2b: Recuperar token capturado por el callback sendResetPassword
      const resetToken = getPendingResetToken(email);
      if (!resetToken) {
        // Usuario no existe en Better-Auth — no es error crítico
        console.warn("[HTTP] No se generó token de reset para:", email);
      } else {
        // 2c: Consumir token para actualizar el hash del password
        await auth.api.resetPassword({
          body: { newPassword: nuevaPassword, token: resetToken },
        });
      }
    } catch (err) {
      // Si Better-Auth falla, el código ya fue consumido y el password
      // se sincronizará en el próximo login via signUpAndSignIn
      console.warn("[HTTP] Better-Auth password update failed:", err);
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
        console.warn("[HTTP] No reset token for set-password:", email);
        return new Response(
          JSON.stringify({ success: false, message: "Usuario no encontrado en el sistema de auth" }),
          { status: 400, headers },
        );
      }

      await auth.api.resetPassword({
        body: { newPassword: password, token: resetToken },
      });
    } catch (err) {
      console.error("[HTTP] Error setting password:", err);
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
