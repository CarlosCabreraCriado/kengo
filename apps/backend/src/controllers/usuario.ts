import { Request, Response } from "express";
import Usuarios from "../models/usuarios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { directusLogin, patchUserMagicFields } from "../models/directus";

const SECRET = process.env.MAGIC_JWT_SECRET!;
const TTL_MIN = +(process.env.MAGIC_JWT_TTL_MIN || 10);

export class usuarioController {
  static async getUsuarioById(req: Request, res: Response) {
    const idSolicitado = req.body.id_usuario;
    const usuario = await Usuarios.getUsuarioById(idSolicitado);
    res.send(usuario[0]);
  }

  //GESTION DE MAGIC LINK:
  static async crearMagicLink(req: Request, res: Response) {
    try {
      const { email, password, userId } = req.body ?? {};
      if (!email || !password)
        res.status(400).json({ error: "email/password required" });

      const jti = crypto.randomUUID();
      const token = jwt.sign({ sub: email, pw: password, jti }, SECRET, {
        algorithm: "HS256",
      });

      // 2) Guardar magic link en el usuario
      const url = `${process.env.APP_URL}/magic?token=${encodeURIComponent(token)}`;

      await patchUserMagicFields(userId, { url });

      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: "issue_failed", message: e.message });
    }
  }

  static async consumirMagicLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body ?? {};

      if (!token) {
        res.status(400).json({ error: "token required" });
        return;
      }

      const payload = jwt.verify(token, SECRET) as {
        sub: string;
        pw: string;
        jti: string;
      };

      const { data, setCookieHeader } = await directusLogin(payload.sub, payload.pw);

      // Reenviar cookies de Directus al cliente
      if (setCookieHeader) {
        const cookies = Array.isArray(setCookieHeader)
          ? setCookieHeader
          : [setCookieHeader];

        cookies.forEach(cookie => {
          res.append('Set-Cookie', cookie);
        });
      }

      res.json({ ok: true, email: payload.sub });
    } catch (e: any) {
      console.error("Error consuming magic link:", e);
      res.status(400).json({ error: "invalid_or_expired", message: e.message });
    }
  }
}
