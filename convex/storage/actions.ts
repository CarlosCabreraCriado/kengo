"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, r2Bucket, r2PublicUrl } from "./r2Client";

const ALLOWED_PREFIXES = new Set(["avatars", "logos", "clinic-files"]);

/**
 * Extrae la extensión del nombre de archivo o, en su defecto, la deriva del
 * Content-Type. Devuelve un valor seguro de fallback (`bin`) si no hay pista.
 */
function pickExtension(filename: string, contentType: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot > -1) {
    const ext = filename.slice(dot + 1).toLowerCase();
    if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  }
  if (contentType.startsWith("image/")) {
    const sub = contentType.split("/")[1] ?? "";
    if (sub === "jpeg") return "jpg";
    return sub || "bin";
  }
  if (contentType.startsWith("video/")) {
    return contentType.split("/")[1] || "mp4";
  }
  return "bin";
}

/**
 * Genera una presigned URL de Cloudflare R2 para subir un archivo nuevo.
 * El cliente recibe `uploadUrl` (PUT, expira en 5 min) + `key` (la ruta R2 que
 * debe guardar en BD) + `publicUrl` (servible inmediatamente desde
 * `assets.kengoapp.com`).
 *
 * El UUID se genera server-side para evitar colisiones y prevenir que el
 * cliente fabrique keys arbitrarias.
 */
export const generateUploadUrl = action({
  args: {
    filename: v.string(),
    contentType: v.string(),
    prefix: v.union(
      v.literal("avatars"),
      v.literal("logos"),
      v.literal("clinic-files"),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    if (!ALLOWED_PREFIXES.has(args.prefix)) {
      throw new Error("Prefijo no permitido");
    }

    const ext = pickExtension(args.filename, args.contentType);
    const uuid = crypto.randomUUID();
    const key = `${args.prefix}/${uuid}.${ext}`;

    const client = r2Client();
    const command = new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: args.contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    return {
      uploadUrl,
      key,
      publicUrl: r2PublicUrl(key),
    };
  },
});

/**
 * Borra objetos huérfanos de R2. Es `internalAction`: NO es invocable desde el
 * cliente. La autorización vive en el llamador, que ya validó el acceso y
 * conoce que las keys pertenecen al recurso — p.ej. `clinics.update` (admin-only)
 * calcula las keys huérfanas a partir de los datos de su propia clínica y la
 * programa vía `ctx.scheduler`. Exponerlo como acción pública permitía a
 * cualquier usuario autenticado borrar objetos arbitrarios de R2 conociendo su
 * key (las URLs públicas de logos/avatares revelan la key).
 */
export const deleteOrphanedObjects = internalAction({
  args: { keys: v.array(v.string()) },
  handler: async (_ctx, args): Promise<{ deleted: number }> => {
    if (args.keys.length === 0) return { deleted: 0 };

    const client = r2Client();
    let deleted = 0;
    for (const key of args.keys) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }),
        );
        deleted++;
      } catch (err) {
        // Best-effort: un fallo al borrar una key no debe abortar el resto.
        console.error(`[storage] Error borrando key huérfana ${key}:`, err);
      }
    }
    return { deleted };
  },
});
