/**
 * Templates HTML para emails de Kengo.
 * Funciones puras que devuelven strings HTML.
 */

const BRAND_COLOR = "#e75c3e";
const BRAND_COLOR_DARK = "#d4503a";

function baseLayout(content: string, footerText: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Kengo</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Tu plataforma de fisioterapia</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px 30px; border-top: 1px solid #eaeaea;">
              <p style="margin: 0; color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
                ${footerText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(href: string, text: string): string {
  return `
<table role="presentation" style="width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center">
      <a href="${href}"
         style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

function codeBlock(codigo: string, label: string): string {
  return `
<div style="background-color: #f8f8f8; border: 2px dashed ${BRAND_COLOR}; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
  <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;">${label}</p>
  <p style="margin: 0; font-family: ui-monospace, monospace; font-size: 40px; font-weight: 700; letter-spacing: 0.2em; color: #1a1a1a;">${codigo}</p>
</div>`;
}

// ─── TEMPLATES ───

export function welcomeEmailTemplate(
  nombre: string,
  tipo: "fisioterapeuta" | "paciente",
  appUrl: string,
): string {
  const rolText =
    tipo === "fisioterapeuta"
      ? "Como fisioterapeuta, ahora puedes gestionar tus pacientes, crear planes de tratamiento personalizados y hacer seguimiento de su progreso."
      : "Como paciente, ahora puedes acceder a tus ejercicios asignados, registrar tu progreso y comunicarte con tu fisioterapeuta.";

  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ¡Hola ${nombre}!
</h2>
<p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Bienvenido a <strong style="color: ${BRAND_COLOR};">Kengo</strong>. Tu cuenta ha sido creada exitosamente.
</p>
<p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  ${rolText}
</p>
${ctaButton(`${appUrl}/login`, "Iniciar sesion")}`;

  return baseLayout(
    content,
    "Este email fue enviado por Kengo.<br>Si no creaste esta cuenta, puedes ignorar este mensaje.",
  );
}

export function passwordResetEmailTemplate(
  codigo: string,
  nombre?: string,
): string {
  const greeting = nombre ? `¡Hola ${nombre}!` : "¡Hola!";

  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ${greeting}
</h2>
<p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Hemos recibido una solicitud para restablecer tu contraseña en <strong style="color: ${BRAND_COLOR};">Kengo</strong>.
</p>
${codeBlock(codigo, "Tu código de verificación:")}
<p style="margin: 0 0 12px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
  Introduce este código en la aplicación para crear una nueva contraseña.
</p>
<p style="margin: 0 0 24px 0; color: ${BRAND_COLOR}; font-size: 14px; font-weight: 500; line-height: 1.6;">
  Este código expira en 15 minutos.
</p>
<p style="margin: 24px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5;">
  Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu cuenta está segura.
</p>`;

  return baseLayout(
    content,
    "Este email fue enviado por Kengo.<br>Por seguridad, nunca compartas este código con nadie.",
  );
}

export function emailVerificationTemplate(
  codigo: string,
  nombre?: string,
): string {
  const greeting = nombre ? `¡Hola ${nombre}!` : "¡Hola!";

  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ${greeting}
</h2>
<p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Utiliza el siguiente código para verificar tu dirección de email en <strong style="color: ${BRAND_COLOR};">Kengo</strong>.
</p>
${codeBlock(codigo, "Tu código de verificación:")}
<p style="margin: 0 0 12px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
  Introduce este código en la aplicación para completar la verificación de tu email.
</p>
<p style="margin: 0 0 24px 0; color: ${BRAND_COLOR}; font-size: 14px; font-weight: 500; line-height: 1.6;">
  Este código expira en 15 minutos.
</p>
<p style="margin: 24px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5;">
  Si no solicitaste verificar tu email, puedes ignorar este mensaje.
</p>`;

  return baseLayout(
    content,
    "Este email fue enviado por Kengo.<br>Por seguridad, nunca compartas este código con nadie.",
  );
}

export function planPdfEmailTemplate(
  nombrePaciente: string,
  nombreFisio: string,
  tituloPlan: string,
  nombreClinica: string,
  appUrl: string,
): string {
  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ¡Hola ${nombrePaciente}!
</h2>
<p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Tu fisioterapeuta <strong style="color: ${BRAND_COLOR};">${nombreFisio}</strong> de <strong>${nombreClinica}</strong> te ha enviado tu plan de tratamiento.
</p>
<div style="background-color: #f8f8f8; border-left: 4px solid ${BRAND_COLOR}; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
  <p style="margin: 0 0 4px 0; color: #666666; font-size: 13px;">Plan de tratamiento:</p>
  <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">${tituloPlan}</p>
</div>
<p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Encontraras el PDF adjunto en este correo con todos los detalles de tus ejercicios.
</p>
${ctaButton(`${appUrl}/login`, "Acceder a Kengo")}`;

  return baseLayout(
    content,
    "Este email fue enviado por Kengo.<br>Si no esperabas este mensaje, puedes ignorarlo.",
  );
}

export function contactFormTemplate(
  nombre: string,
  email: string,
  asunto: string,
  mensaje: string,
): string {
  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ${asunto}
</h2>
<div style="background-color: #f8f8f8; border-left: 4px solid ${BRAND_COLOR}; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
  <p style="margin: 0 0 4px 0; color: #666666; font-size: 13px;">De:</p>
  <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${nombre}</p>
  <p style="margin: 4px 0 0 0; font-size: 14px; color: #4a4a4a;">
    <a href="mailto:${email}" style="color: ${BRAND_COLOR}; text-decoration: none;">${email}</a>
  </p>
</div>
<div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <p style="margin: 0; color: #4a4a4a; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${mensaje}</p>
</div>
${ctaButton(`mailto:${email}?subject=Re: ${asunto}`, "Responder")}`;

  return baseLayout(
    content,
    "Este mensaje fue enviado desde el formulario de contacto de kengoapp.com.",
  );
}

export function accessLinkEmailTemplate(
  nombre: string,
  accessUrl: string,
): string {
  const content = `
<h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
  ¡Hola ${nombre}!
</h2>
<p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Tu fisioterapeuta te ha enviado un enlace para acceder a tus ejercicios y planes de tratamiento en <strong style="color: ${BRAND_COLOR};">Kengo</strong>.
</p>
<p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
  Pulsa el botón de abajo para acceder directamente a tu cuenta. No necesitas recordar ninguna contraseña.
</p>
${ctaButton(accessUrl, "Acceder a mis ejercicios")}
<p style="margin: 24px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5; text-align: center;">
  Este enlace es personal y te permitirá acceder a tu cuenta de forma segura.
</p>`;

  return baseLayout(
    content,
    "Este email fue enviado por Kengo.<br>Si no esperabas este enlace, puedes ignorar este mensaje.",
  );
}
