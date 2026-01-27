import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  createTokenAccesoUsuario,
  validarTokenAcceso,
  registrarUsoToken,
  getTokensUsuario,
  revocarToken,
  createDirectusSessionForUser,
  getUserById,
  TokenValidationError,
} from "../models/directus";
import { sendAccessLinkEmail } from "../services/email.service";
import "dotenv/config";

export class tokenAccesoController {
  /**
   * POST /usuario/token-acceso (protegido)
   * Crea un token de acceso para un usuario
   */
  static async crearToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { idUsuario, usosMaximos, diasExpiracion } = req.body ?? {};

      if (!idUsuario) {
        res.status(400).json({ error: "idUsuario requerido" });
        return;
      }

      // Verificar que el usuario existe
      const usuario = await getUserById(idUsuario);
      if (!usuario) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      const creadoPor = req.user!.id;

      const result = await createTokenAccesoUsuario(idUsuario, creadoPor, {
        usosMaximos: usosMaximos ?? null,
        diasExpiracion: diasExpiracion ?? null,
      });

      res.json({
        id: result.id,
        url: result.url,
      });
    } catch (e: any) {
      console.error("Error creando token de acceso:", e);
      res.status(500).json({ error: "error_creando_token", message: e.message });
    }
  }

  /**
   * POST /auth/token-acceso (público)
   * Valida un token y crea una sesión de Directus
   */
  static async consumirToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body ?? {};

      if (!token) {
        res.status(400).json({ error: "TOKEN_NO_PROPORCIONADO" });
        return;
      }

      // Validar token
      const validation = await validarTokenAcceso(token);

      if (!validation.valido) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const tokenData = validation.tokenData!;

      // Registrar uso del token
      await registrarUsoToken(tokenData.id);

      // Crear sesión de Directus para el usuario
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const session = await createDirectusSessionForUser(
        tokenData.id_usuario,
        clientIp,
        userAgent
      );

      // Establecer cookie de sesión de Directus
      // El nombre de la cookie debe coincidir con lo que espera Directus
      res.cookie("directus_session_token", session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: session.expires,
        path: "/",
      });

      res.json({ ok: true, userId: tokenData.id_usuario });
    } catch (e: any) {
      console.error("Error consumiendo token de acceso:", e);
      res.status(500).json({ error: "ERROR_CONSUMIENDO_TOKEN", message: e.message });
    }
  }

  /**
   * GET /usuario/:id/tokens-acceso (protegido)
   * Lista los tokens de un usuario
   */
  static async listarTokens(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(400).json({ error: "id de usuario requerido" });
        return;
      }

      const tokens = await getTokensUsuario(id);

      // No devolver el token completo por seguridad, solo últimos 8 caracteres
      const tokensSanitizados = tokens.map((t) => ({
        id: t.id,
        tokenPreview: `...${t.token.slice(-8)}`,
        usos_actuales: t.usos_actuales,
        usos_maximos: t.usos_maximos,
        fecha_expiracion: t.fecha_expiracion,
        date_created: t.date_created,
        ultimo_uso: t.ultimo_uso,
        activo: t.activo,
      }));

      res.json({ data: tokensSanitizados });
    } catch (e: any) {
      console.error("Error listando tokens:", e);
      res.status(500).json({ error: "error_listando_tokens", message: e.message });
    }
  }

  /**
   * DELETE /usuario/token-acceso/:id (protegido)
   * Revoca un token de acceso
   */
  static async revocarToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(400).json({ error: "id de token requerido" });
        return;
      }

      await revocarToken(id);

      res.json({ ok: true });
    } catch (e: any) {
      console.error("Error revocando token:", e);
      res.status(500).json({ error: "error_revocando_token", message: e.message });
    }
  }

  /**
   * POST /usuario/:id/token-acceso/enviar-email (protegido)
   * Envía el enlace de acceso activo al email del usuario
   */
  static async enviarPorEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id as string;

      if (!userId) {
        res.status(400).json({ error: "id de usuario requerido" });
        return;
      }

      // Obtener información del usuario
      const usuario = await getUserById(userId);
      if (!usuario) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      if (!usuario.email) {
        res.status(400).json({ error: "El usuario no tiene email registrado" });
        return;
      }

      // Obtener tokens activos del usuario
      const tokens = await getTokensUsuario(userId);
      const tokenActivo = tokens.find((t) => t.activo);

      let accessUrl: string;

      if (tokenActivo) {
        // Reconstruir URL del token activo
        accessUrl = `${process.env.APP_URL}/magic?t=${tokenActivo.token}`;
      } else {
        // Crear nuevo token si no hay uno activo
        const creadoPor = req.user!.id;
        const nuevoToken = await createTokenAccesoUsuario(userId, creadoPor);
        accessUrl = nuevoToken.url;
      }

      // Enviar email
      const nombre = usuario.first_name || usuario.email.split("@")[0];
      const emailEnviado = await sendAccessLinkEmail({
        email: usuario.email,
        nombre,
        accessUrl,
      });

      if (!emailEnviado) {
        res.status(500).json({ error: "Error al enviar el email" });
        return;
      }

      res.json({ ok: true, emailEnviado: true });
    } catch (e: any) {
      console.error("Error enviando email de acceso:", e);
      res.status(500).json({ error: "error_enviando_email", message: e.message });
    }
  }
}
