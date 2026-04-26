import { internalQuery } from "../_generated/server";

/**
 * Devuelve todas las keys de R2 referenciadas en la base de datos.
 * Usada por el cron de limpieza para detectar huérfanas.
 */
export const getReferencedR2Keys = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const [users, clinics, files] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("clinics").collect(),
      ctx.db.query("clinicFiles").collect(),
    ]);

    const keys = new Set<string>();
    for (const u of users) if (u.avatar) keys.add(u.avatar);
    for (const c of clinics) if (c.logo) keys.add(c.logo);
    for (const f of files) if (f.fileId) keys.add(f.fileId);
    return Array.from(keys);
  },
});
