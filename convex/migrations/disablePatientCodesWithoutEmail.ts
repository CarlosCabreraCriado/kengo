/**
 * Migración one-shot: desactiva los códigos de acceso de tipo "paciente"
 * que no tienen email vinculado.
 *
 * Tras la unificación del flujo de alta de pacientes en /mis-pacientes, los
 * códigos paciente pasan a ser invitaciones nominales (email obligatorio,
 * 1 uso). Los códigos legacy multiusuario sin email contradicen esa regla,
 * así que se desactivan para que no puedan canjearse.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/disablePatientCodesWithoutEmail:run
 *   npx convex run migrations/disablePatientCodesWithoutEmail:run --prod
 *
 * Eliminar este archivo en un commit posterior una vez confirmada la
 * ejecución, siguiendo el patrón del commit a97a382.
 */

import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const codes = await ctx.db.query("accessCodes").collect();
    let desactivados = 0;
    let yaInactivos = 0;
    let conEmail = 0;

    for (const code of codes) {
      if (code.tipo !== "paciente") continue;
      if (code.email && code.email.trim() !== "") {
        conEmail++;
        continue;
      }
      if (!code.activo) {
        yaInactivos++;
        continue;
      }
      await ctx.db.patch(code._id, { activo: false });
      desactivados++;
    }

    console.log(
      `[disablePatientCodesWithoutEmail] desactivados=${desactivados} yaInactivos=${yaInactivos} conEmail=${conEmail}`,
    );

    return { desactivados, yaInactivos, conEmail };
  },
});
