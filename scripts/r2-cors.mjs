#!/usr/bin/env node
/**
 * Aplica o muestra la política CORS del bucket R2 `kengo-assets`.
 *
 *   npm run r2:cors        → PUT scripts/r2-cors.json al bucket
 *   npm run r2:cors:show   → GET de la política actualmente aplicada
 *
 * Requiere `CLOUDFLARE_API_TOKEN` (permiso "Workers R2 Storage: Edit") y,
 * opcionalmente, `CLOUDFLARE_ACCOUNT_ID` y `R2_BUCKET` (por defecto los de Kengo).
 * Sin dependencias: usa el `fetch` nativo de Node ≥ 18.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? '3b01d142b4509398b975fd082ebc9fda';
const BUCKET = process.env.R2_BUCKET ?? 'kengo-assets';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const show = process.argv.includes('--show');

if (!TOKEN) {
  console.error('Falta CLOUDFLARE_API_TOKEN en el entorno.');
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/cors`;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function call(method, body) {
  const res = await fetch(url, { method, headers, body });
  const json = await res.json();
  if (!json.success) {
    console.error(`Cloudflare API ${method} ${url} → ${res.status}`, JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.result;
}

if (show) {
  console.log(JSON.stringify(await call('GET'), null, 2));
} else {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'r2-cors.json');
  const policy = JSON.parse(await readFile(file, 'utf8'));
  delete policy.$comment;
  await call('PUT', JSON.stringify(policy));
  console.log(`Política CORS aplicada a ${BUCKET}:`);
  console.log(JSON.stringify(await call('GET'), null, 2));
}
