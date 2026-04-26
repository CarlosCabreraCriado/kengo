import { internalMutation } from "../_generated/server";
import { normalizarPuesto } from "../_helpers/permissions";

function buildSearchableText(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  return [firstName ?? "", lastName ?? "", email ?? ""]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Migración one-shot: copia los datos de la tabla deprecada `userDetails`
 * a la tabla `users` y elimina los registros migrados.
 *
 * Ejecutar manualmente desde el dashboard de Convex tras desplegar el schema
 * con los nuevos campos en `users`. Tras ejecutarla con éxito, la tabla
 * `userDetails` puede eliminarse del schema en una fase posterior.
 *
 * Idempotente: si vuelve a ejecutarse, omite registros ya migrados.
 */
export const migrateUserDetailsToUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allDetails = await ctx.db.query("userDetails").collect();

    let migrated = 0;
    let skipped = 0;
    let orphans = 0;

    for (const detail of allDetails) {
      const user = await ctx.db.get(detail.userId);
      if (!user) {
        await ctx.db.delete(detail._id);
        orphans += 1;
        continue;
      }

      const alreadyHas =
        user.dni !== undefined ||
        user.fechaNacimiento !== undefined ||
        user.sexo !== undefined ||
        user.telefono !== undefined ||
        user.direccion !== undefined ||
        user.postal !== undefined;

      if (alreadyHas) {
        await ctx.db.delete(detail._id);
        skipped += 1;
        continue;
      }

      await ctx.db.patch(user._id, {
        dni: detail.dni,
        fechaNacimiento: detail.fechaNacimiento,
        sexo: detail.sexo,
        direccion: detail.direccion,
        postal: detail.postal,
        telefono: detail.telefono,
      });
      await ctx.db.delete(detail._id);
      migrated += 1;
    }

    console.log(
      `[migration] userDetails → users: migrated=${migrated} skipped=${skipped} orphans=${orphans}`,
    );
    return { migrated, skipped, orphans };
  },
});

/**
 * Convierte clinicMemberships.puesto numérico (1/2/4) a literal
 * ("fisio"/"paciente"/"admin"). Idempotente: omite los que ya son literal.
 *
 * Tras ejecutarse con éxito, en un PR posterior se puede endurecer el schema
 * a sólo `v.union(v.literal("fisio"), v.literal("paciente"), v.literal("admin"))`.
 */
export const migrateRolesToLiterals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db.query("clinicMemberships").collect();
    let updated = 0;
    let unknown = 0;

    for (const m of memberships) {
      if (typeof m.puesto === "string") continue;
      const literal = normalizarPuesto(m.puesto);
      if (literal === null) {
        unknown += 1;
        continue;
      }
      await ctx.db.patch(m._id, { puesto: literal });
      updated += 1;
    }

    console.log(
      `[migration] roles → literal: updated=${updated} unknown=${unknown}`,
    );
    return { updated, unknown };
  },
});

/**
 * Rellena el campo `searchableText` en todos los usuarios que aún no lo tienen.
 * Idempotente: omite los que ya lo tienen.
 */
export const backfillSearchableText = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    for (const user of users) {
      if (user.searchableText) continue;
      await ctx.db.patch(user._id, {
        searchableText: buildSearchableText(
          user.firstName,
          user.lastName,
          user.email,
        ),
      });
      updated += 1;
    }
    console.log(`[migration] backfillSearchableText: ${updated} usuarios`);
    return { updated };
  },
});
