"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, r2Bucket } from "./r2Client";

const PREFIXES = ["avatars", "logos", "clinic-files"] as const;
const SAFETY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cron semanal: borra de R2 las keys que ya no están referenciadas en BD
 * y tienen más de 7 días (margen de seguridad para uploads que aún no se
 * persistieron en BD).
 */
export const cleanupOrphanR2Keys = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; checked: number }> => {
    const referenced: string[] = await ctx.runQuery(
      internal.storage.internal.getReferencedR2Keys,
      {},
    );
    const referencedSet = new Set(referenced);

    const client = r2Client();
    const bucket = r2Bucket();
    const cutoff = Date.now() - SAFETY_WINDOW_MS;

    let deleted = 0;
    let checked = 0;

    for (const prefix of PREFIXES) {
      let continuationToken: string | undefined;
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${prefix}/`,
            ContinuationToken: continuationToken,
          }),
        );

        for (const obj of result.Contents ?? []) {
          checked += 1;
          if (!obj.Key) continue;
          if (referencedSet.has(obj.Key)) continue;
          const lastModifiedMs = obj.LastModified?.getTime() ?? Date.now();
          if (lastModifiedMs > cutoff) continue;

          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }),
          );
          deleted += 1;
        }

        continuationToken = result.IsTruncated
          ? result.NextContinuationToken
          : undefined;
      } while (continuationToken);
    }

    console.log(`[r2-gc] checked=${checked} deleted=${deleted}`);
    return { deleted, checked };
  },
});
