import { Request, Response } from 'express';
import { sendContactEmail } from '../services/email.service';

export class contactoController {
  /**
   * POST /contacto
   * Recibe un mensaje de contacto y lo envía por email
   */
  static async enviarMensaje(req: Request, res: Response): Promise<void> {
    const { nombre, email, asunto, mensaje } = req.body;

    if (!nombre || !email || !mensaje) {
      res.status(400).json({
        success: false,
        message: 'Los campos nombre, email y mensaje son obligatorios',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'El email proporcionado no es válido',
      });
      return;
    }

    try {
      const enviado = await sendContactEmail({
        nombre,
        email,
        asunto: asunto || 'Mensaje de contacto',
        mensaje,
      });

      if (!enviado) {
        res.status(500).json({
          success: false,
          message: 'No se pudo enviar el mensaje. Inténtalo más tarde.',
        });
        return;
      }

      res.json({ success: true, message: 'Mensaje enviado correctamente' });
    } catch (err) {
      console.error('[Contacto] Error inesperado:', err);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }
}
