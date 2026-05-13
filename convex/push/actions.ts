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
 */
export const sendPushToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const sa = parseServiceAccount();
    if (!sa) {
      console.warn(
        "[Push] FCM_SERVICE_ACCOUNT no configurada, omitiendo envío",
      );
      return false;
    }

    const tokens = await ctx.runQuery(internal.push.queries.getTokensForUser, {
      userId: args.userId,
    });
    if (tokens.length === 0) {
      return false;
    }

    const jwt = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: [FCM_SCOPE],
    });
    const { access_token: accessToken } = await jwt.authorize();
    if (!accessToken) {
      console.error("[Push] No se pudo obtener access token de Google");
      return false;
    }

    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    await Promise.all(
      tokens.map(async (t: Doc<"pushTokens">) => {
        const payload = {
          message: {
            token: t.token,
            notification: { title: args.title, body: args.body },
            ...(args.data ? { data: args.data } : {}),
          },
        };

        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.error(
            `[Push] Error de red enviando a token ${t._id}:`,
            err,
          );
          return;
        }

        if (res.ok) return;

        const errBody = await res.text();
        const isStale =
          res.status === 404 ||
          errBody.includes("UNREGISTERED") ||
          errBody.includes("registration-token-not-registered") ||
          (res.status === 400 && errBody.includes("INVALID_ARGUMENT"));

        console.error(
          `[Push] FCM ${res.status} para token ${t._id}${
            isStale ? " (stale, borrando)" : ""
          }: ${errBody}`,
        );

        if (isStale) {
          await ctx.runMutation(
            internal.push.mutations.deletePushTokenById,
            { tokenId: t._id },
          );
        }
      }),
    );

    return true;
  },
});
