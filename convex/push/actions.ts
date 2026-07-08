"use node";

import { v } from "convex/values";
import { JWT } from "google-auth-library";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env["FCM_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key || !sa.project_id) {
      console.error(
        "[Push] FCM_SERVICE_ACCOUNT mal formada (faltan campos client_email / private_key / project_id)",
      );
      return null;
    }
    return sa;
  } catch (err) {
    console.error("[Push] FCM_SERVICE_ACCOUNT no es JSON válido:", err);
    return null;
  }
}

/**
 * Caché del access token OAuth a nivel de módulo. Los tokens de Google duran
 * ~1 h; sin caché se pedía uno nuevo por cada paciente del cron diario. El
 * estado de módulo sobrevive entre invocaciones en entornos calientes de
 * Convex; en frío simplemente se re-autoriza.
 */
let cachedToken: { accessToken: string; expiryMs: number } | null = null;
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiryMs - TOKEN_SAFETY_MARGIN_MS > now) {
    return cachedToken.accessToken;
  }
  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [FCM_SCOPE],
  });
  const { access_token: accessToken, expiry_date: expiryDate } =
    await jwt.authorize();
  if (!accessToken) return null;
  // `expiry_date` viene en epoch ms; si falta, asumir 55 min.
  cachedToken = {
    accessToken,
    expiryMs: expiryDate ?? now + 55 * 60 * 1000,
  };
  return accessToken;
}

const MAX_TRANSIENT_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ¿El status/cuerpo de FCM indican token muerto (borrar del registro)? */
function isTokenStale(status: number, body: string): boolean {
  return (
    status === 404 ||
    body.includes("UNREGISTERED") ||
    body.includes("registration-token-not-registered")
  );
}

/** ¿Es un error transitorio que merece reintento? (429 o 5xx) */
function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

const NOTIFICATION_KEY = v.union(
  v.literal("chat"),
  v.literal("dailyReminder"),
  v.literal("newPlan"),
);

/**
 * Envía una push notification a todos los dispositivos del usuario indicado.
 *
 * Internal: se invoca vía `ctx.scheduler.runAfter(0, ...)` desde mutations
 * (chat) o desde el cron diario de recordatorios.
 *
 * Comportamiento de errores FCM:
 *  - 404 UNREGISTERED / 400 INVALID_ARGUMENT con detalle de token → borra el
 *    registro de `pushTokens` para que no se reintente.
 *  - Otros errores: log y continúa con el resto.
 *
 * Si `FCM_SERVICE_ACCOUNT` no está configurada, devuelve false (no rompe el
 * flujo de la mutation que lo encoló).
 *
 * Args opcionales:
 *  - `notificationKey`: si se proporciona, lee las prefs del receptor y aborta
 *    (devuelve `false`) cuando esa clave está en `false`. Si se omite, siempre
 *    se envía (caso reservado a notificaciones críticas o tests).
 *  - `badge`: número que aparece como contador de la app en iOS. Android lo
 *    ignora. Pasar `0` para limpiar el badge.
 */
export const sendPushToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
    notificationKey: v.optional(NOTIFICATION_KEY),
    badge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const log = (
      resultado:
        | "ok"
        | "sin_token"
        | "prefs_off"
        | "error"
        | "stale"
        | "sin_service_account",
      detalle?: string,
    ) =>
      ctx
        .runMutation(internal.push.mutations.logPushResult, {
          userId: args.userId,
          notificationKey: args.notificationKey,
          resultado,
          detalle,
          createdAt: Date.now(),
        })
        .catch((err) => console.error("[Push] logPushResult falló:", err));

    const sa = parseServiceAccount();
    if (!sa) {
      console.warn(
        "[Push] FCM_SERVICE_ACCOUNT no configurada, omitiendo envío",
      );
      await log("sin_service_account");
      return false;
    }

    if (args.notificationKey) {
      const prefs = await ctx.runQuery(
        internal.notificationPreferences.queries.getPreferencesForUser,
        { userId: args.userId },
      );
      if (!prefs[args.notificationKey]) {
        await log("prefs_off");
        return false;
      }
    }

    const tokens = await ctx.runQuery(internal.push.queries.getTokensForUser, {
      userId: args.userId,
    });
    if (tokens.length === 0) {
      await log("sin_token");
      return false;
    }

    const accessToken = await getAccessToken(sa);
    if (!accessToken) {
      console.error("[Push] No se pudo obtener access token de Google");
      await log("error", "sin_access_token");
      return false;
    }

    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const apnsBlock =
      args.badge !== undefined
        ? { apns: { payload: { aps: { badge: args.badge } } } }
        : {};

    // Resultado por token: "ok" | "stale" | "error".
    const results = await Promise.all(
      tokens.map(async (t: Doc<"pushTokens">) => {
        const body = JSON.stringify({
          message: {
            token: t.token,
            notification: { title: args.title, body: args.body },
            ...(args.data ? { data: args.data } : {}),
            ...apnsBlock,
          },
        });

        for (let intento = 0; ; intento++) {
          let res: Response;
          try {
            res = await fetch(url, { method: "POST", headers, body });
          } catch (err) {
            console.error(
              `[Push] Error de red enviando a token ${t._id}:`,
              err,
            );
            return "error" as const;
          }

          if (res.ok) return "ok" as const;

          const errBody = await res.text();

          if (isTransient(res.status) && intento < MAX_TRANSIENT_RETRIES) {
            await sleep(1000 * 2 ** intento);
            continue;
          }

          const stale = isTokenStale(res.status, errBody);
          console.error(
            `[Push] FCM ${res.status} para token ${t._id}${
              stale ? " (stale, borrando)" : ""
            }: ${errBody}`,
          );

          if (stale) {
            await ctx.runMutation(internal.push.mutations.deletePushTokenById, {
              tokenId: t._id,
            });
            return "stale" as const;
          }
          return "error" as const;
        }
      }),
    );

    const okCount = results.filter((r) => r === "ok").length;
    const staleCount = results.filter((r) => r === "stale").length;
    const errCount = results.filter((r) => r === "error").length;
    const detalle = `ok=${okCount} stale=${staleCount} error=${errCount} de ${tokens.length}`;

    if (okCount > 0) {
      await log("ok", detalle);
      return true;
    }
    await log(staleCount > 0 && errCount === 0 ? "stale" : "error", detalle);
    return false;
  },
});
