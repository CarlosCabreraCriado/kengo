import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendContactMessage = action({
  args: {
    nombre: v.string(),
    email: v.string(),
    asunto: v.optional(v.string()),
    mensaje: v.string(),
  },
  handler: async (ctx, args) => {
    const nombre = args.nombre.trim();
    const email = args.email.trim();
    const mensaje = args.mensaje.trim();
    const asunto = (args.asunto ?? "Mensaje de contacto").trim();

    if (!nombre || !email || !mensaje) {
      throw new Error("Los campos nombre, email y mensaje son obligatorios");
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new Error("El email proporcionado no es válido");
    }

    const sent: boolean = await ctx.runAction(
      internal.email.actions.sendContactForm,
      { nombre, email, asunto, mensaje },
    );

    if (!sent) {
      throw new Error("No se pudo enviar el mensaje. Inténtalo más tarde.");
    }

    return { ok: true };
  },
});
