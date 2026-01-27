import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface WelcomeEmailParams {
  email: string;
  nombre: string;
  tipo: 'fisioterapeuta' | 'paciente';
}

/**
 * Genera el template HTML para el email de bienvenida
 */
function getWelcomeEmailTemplate(nombre: string, tipo: 'fisioterapeuta' | 'paciente'): string {
  const rolText = tipo === 'fisioterapeuta'
    ? 'Como fisioterapeuta, ahora puedes gestionar tus pacientes, crear planes de tratamiento personalizados y hacer seguimiento de su progreso.'
    : 'Como paciente, ahora puedes acceder a tus ejercicios asignados, registrar tu progreso y comunicarte con tu fisioterapeuta.';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Kengo</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e75c3e 0%, #d4503a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Kengo</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Tu plataforma de fisioterapia</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                ¡Hola ${nombre}!
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Bienvenido a <strong style="color: #e75c3e;">Kengo</strong>. Tu cuenta ha sido creada exitosamente.
              </p>
              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                ${rolText}
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${process.env.APP_URL || 'https://kengoapp.com'}/login"
                       style="display: inline-block; background-color: #e75c3e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; transition: background-color 0.2s;">
                      Iniciar sesion
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px 30px; border-top: 1px solid #eaeaea;">
              <p style="margin: 0; color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
                Este email fue enviado por Kengo.<br>
                Si no creaste esta cuenta, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

interface CodigoAccesoEmailParams {
  email: string;
  codigo: string;
  nombreClinica: string;
  tipo: 'fisioterapeuta' | 'paciente';
}

/**
 * Genera el template HTML para el email de código de acceso
 */
function getCodigoAccesoEmailTemplate(codigo: string, nombreClinica: string, tipo: 'fisioterapeuta' | 'paciente'): string {
  const rolText = tipo === 'fisioterapeuta'
    ? 'Has sido invitado a unirte como <strong>fisioterapeuta</strong>. Podrás gestionar pacientes, crear planes de tratamiento y hacer seguimiento de su progreso.'
    : 'Has sido invitado a unirte como <strong>paciente</strong>. Podrás acceder a tus ejercicios asignados y registrar tu progreso.';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a ${nombreClinica}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e75c3e 0%, #d4503a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Kengo</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Tu plataforma de fisioterapia</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                Invitación a ${nombreClinica}
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                ${rolText}
              </p>

              <!-- Código de acceso -->
              <div style="background-color: #f8f8f8; border: 2px dashed #e75c3e; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; color: #666666; font-size: 14px;">Tu código de acceso:</p>
                <p style="margin: 0; font-family: ui-monospace, monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #1a1a1a;">${codigo}</p>
              </div>

              <p style="margin: 0 0 24px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                Este código está vinculado a tu email y solo podrás usarlo tú.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${process.env.APP_URL || 'https://kengoapp.com'}/login"
                       style="display: inline-block; background-color: #e75c3e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Ir a Kengo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5;">
                Una vez en la app, ve a <strong>Mi Clínica</strong> e introduce el código para vincularte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px 30px; border-top: 1px solid #eaeaea;">
              <p style="margin: 0; color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
                Este email fue enviado por Kengo.<br>
                Si no esperabas esta invitación, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Envía un email con el código de acceso al destinatario
 */
export async function sendCodigoAccesoEmail({ email, codigo, nombreClinica, tipo }: CodigoAccesoEmailParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY no configurada, omitiendo envío de email');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Kengo <noreply@kengoapp.com>',
      to: email,
      subject: `Invitación a ${nombreClinica} - Kengo`,
      html: getCodigoAccesoEmailTemplate(codigo, nombreClinica, tipo),
    });

    if (error) {
      console.error('[Email] Error enviando email de código de acceso:', error);
      return false;
    }

    console.log(`[Email] Email de código de acceso enviado a ${email}`);
    return true;
  } catch (err) {
    console.error('[Email] Error inesperado enviando email:', err);
    return false;
  }
}

interface AccessLinkEmailParams {
  email: string;
  nombre: string;
  accessUrl: string;
}

/**
 * Genera el template HTML para el email de enlace de acceso
 */
function getAccessLinkEmailTemplate(nombre: string, accessUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu enlace de acceso - Kengo</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e75c3e 0%, #d4503a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Kengo</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Tu plataforma de fisioterapia</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                ¡Hola ${nombre}!
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Tu fisioterapeuta te ha enviado un enlace para acceder a tus ejercicios y planes de tratamiento en <strong style="color: #e75c3e;">Kengo</strong>.
              </p>
              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Pulsa el botón de abajo para acceder directamente a tu cuenta. No necesitas recordar ninguna contraseña.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${accessUrl}"
                       style="display: inline-block; background-color: #e75c3e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Acceder a mis ejercicios
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; color: #888888; font-size: 13px; line-height: 1.5; text-align: center;">
                Este enlace es personal y te permitirá acceder a tu cuenta de forma segura.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 24px 30px; border-top: 1px solid #eaeaea;">
              <p style="margin: 0; color: #888888; font-size: 12px; text-align: center; line-height: 1.5;">
                Este email fue enviado por Kengo.<br>
                Si no esperabas este enlace, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Envía un email con el enlace de acceso al paciente
 */
export async function sendAccessLinkEmail({ email, nombre, accessUrl }: AccessLinkEmailParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY no configurada, omitiendo envío de email');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Kengo <noreply@kengoapp.com>',
      to: email,
      subject: `Tu enlace de acceso a Kengo`,
      html: getAccessLinkEmailTemplate(nombre, accessUrl),
    });

    if (error) {
      console.error('[Email] Error enviando email de enlace de acceso:', error);
      return false;
    }

    console.log(`[Email] Email de enlace de acceso enviado a ${email}`);
    return true;
  } catch (err) {
    console.error('[Email] Error inesperado enviando email:', err);
    return false;
  }
}

/**
 * Envia un email de bienvenida al nuevo usuario
 * No bloquea el registro si falla el envio
 */
export async function sendWelcomeEmail({ email, nombre, tipo }: WelcomeEmailParams): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY no configurada, omitiendo envio de email');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Kengo <noreply@kengoapp.com>',
      to: email,
      subject: `Bienvenido a Kengo, ${nombre}!`,
      html: getWelcomeEmailTemplate(nombre, tipo),
    });

    if (error) {
      console.error('[Email] Error enviando email de bienvenida:', error);
      return false;
    }

    console.log(`[Email] Email de bienvenida enviado a ${email}`);
    return true;
  } catch (err) {
    console.error('[Email] Error inesperado enviando email:', err);
    return false;
  }
}
