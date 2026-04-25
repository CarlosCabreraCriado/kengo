"use node";

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente S3-compatible para Cloudflare R2.
 * Las credenciales se leen de las env vars del deployment de Convex:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT
 *
 * Solo se puede invocar desde actions con `"use node"`.
 */
export function r2Client(): S3Client {
  const endpoint = process.env["R2_ENDPOINT"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 no configurado. Faltan env vars: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function r2Bucket(): string {
  const bucket = process.env["R2_BUCKET"];
  if (!bucket) throw new Error("R2_BUCKET no configurada");
  return bucket;
}

/**
 * URL pública servida por el dominio custom configurado para R2 (`assets.kengoapp.com`).
 */
export function r2PublicUrl(key: string): string {
  const base = (process.env["R2_PUBLIC_URL"] ?? "").replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL no configurada");
  return `${base}/${key}`;
}
