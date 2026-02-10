import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { renewSessionJWT } from "../models/directus";

function expirarCookie(res: Response): void {
  res.cookie("directus_session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
}

export const sessionRefreshController = {
  /**
   * POST /auth/refrescar-sesion
   * Renueva el JWT de sesión cuando el JWT expiró pero la sesión en BD sigue vigente.
   * No requiere authMiddleware — lee directamente la cookie.
   */
  async refrescarSesion(req: Request, res: Response): Promise<void> {
    try {
      const secret = process.env.DIRECTUS_SECRET;
      if (!secret) {
        res.status(500).json({ ok: false, error: "Configuración inválida" });
        return;
      }

      const cookieValue = req.cookies?.directus_session_token;
      if (!cookieValue) {
        res.status(401).json({ ok: false, error: "Sin cookie de sesión" });
        return;
      }

      // Verificar firma del JWT ignorando expiración
      let decoded: any;
      try {
        decoded = jwt.verify(cookieValue, secret, { ignoreExpiration: true });
      } catch {
        expirarCookie(res);
        res.status(401).json({ ok: false, error: "Cookie inválida" });
        return;
      }

      const sessionToken = decoded.session;
      if (!sessionToken) {
        expirarCookie(res);
        res.status(401).json({ ok: false, error: "JWT sin claim de sesión" });
        return;
      }

      // Renovar JWT si la sesión en BD sigue vigente
      const result = await renewSessionJWT(sessionToken);
      if (!result) {
        expirarCookie(res);
        res.status(401).json({ ok: false, error: "Sesión expirada en BD" });
        return;
      }

      // Establecer nueva cookie con JWT fresco
      res.cookie("directus_session_token", result.sessionCookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: result.expires,
        path: "/",
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("[refrescarSesion] Error:", error);
      res.status(500).json({ ok: false, error: "Error interno" });
    }
  },
};
