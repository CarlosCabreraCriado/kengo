/**
 * Pipeline de imágenes de la landing page.
 *
 * Lee los PNG fuente de apps/landingpage/assets-src/ y genera en
 * apps/landingpage/public/assets/ las variantes optimizadas que consumen
 * los componentes (AVIF/WebP responsive + PNG fallback), además de
 * og-image.jpg (1200×630) y apple-touch-icon.png (180×180).
 *
 * Se ejecuta en local (sharp usa binarios nativos; no entra en el build
 * de Railway) y las salidas se commitean:
 *
 *   npm run images:landingpage
 *
 * Es idempotente: se salta las salidas más nuevas que su fuente.
 */
import { readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC_DIR = path.join(ROOT, 'apps/landingpage/assets-src');
const OUT_ASSETS = path.join(ROOT, 'apps/landingpage/public/assets');
const OUT_SHOTS = path.join(OUT_ASSETS, 'shots');
const OUT_PUBLIC = path.join(ROOT, 'apps/landingpage/public');

const WIDTHS = [640, 960, 1280];
// La imagen del hero (LCP) se muestra hasta ~1088px CSS → añade el ancho nativo.
const EXTRA_WIDTHS = { 'Multidevice.png': [1500] };
const PNG_FALLBACK_WIDTH = 960;

const AVIF_OPTS = { quality: 55, effort: 6 };
const WEBP_OPTS = { quality: 78 };
const PNG_OPTS = { palette: true, compressionLevel: 9 };

async function isFresh(outFile, srcMtime) {
  try {
    return (await stat(outFile)).mtimeMs > srcMtime;
  } catch {
    return false;
  }
}

async function generate(srcFile, outFile, transform) {
  const srcMtime = (await stat(srcFile)).mtimeMs;
  if (await isFresh(outFile, srcMtime)) return false;
  await transform(sharp(srcFile)).toFile(outFile);
  const kb = ((await stat(outFile)).size / 1024).toFixed(0);
  console.log(`  ${path.relative(ROOT, outFile)} (${kb} KB)`);
  return true;
}

async function processShot(name) {
  const srcFile = path.join(SRC_DIR, 'shots', name);
  const base = path.parse(name).name;
  const { width: srcWidth } = await sharp(srcFile).metadata();
  const widths = [...WIDTHS, ...(EXTRA_WIDTHS[name] ?? [])].filter(
    (w) => w <= srcWidth,
  );

  for (const w of widths) {
    await generate(srcFile, path.join(OUT_SHOTS, `${base}-${w}w.avif`), (img) =>
      img.resize(w).avif(AVIF_OPTS),
    );
    await generate(srcFile, path.join(OUT_SHOTS, `${base}-${w}w.webp`), (img) =>
      img.resize(w).webp(WEBP_OPTS),
    );
  }

  await generate(
    srcFile,
    path.join(OUT_SHOTS, `${base}-${PNG_FALLBACK_WIDTH}w.png`),
    (img) => img.resize(PNG_FALLBACK_WIDTH).png(PNG_OPTS),
  );
}

async function main() {
  await mkdir(OUT_SHOTS, { recursive: true });

  console.log('Shots:');
  const shots = (await readdir(path.join(SRC_DIR, 'shots'))).filter((f) =>
    f.endsWith('.png'),
  );
  for (const name of shots) await processShot(name);

  console.log('Derivados:');
  // Crawlers sociales no soportan AVIF/WebP → JPEG 1200×630.
  await generate(
    path.join(SRC_DIR, 'og-image.png'),
    path.join(OUT_ASSETS, 'og-image.jpg'),
    (img) =>
      img
        .resize(1200, 630, { fit: 'cover' })
        .flatten({ background: '#fff0e4' })
        .jpeg({ quality: 82, mozjpeg: true }),
  );
  await generate(
    path.join(SRC_DIR, 'shots/icono-app.png'),
    path.join(OUT_PUBLIC, 'apple-touch-icon.png'),
    (img) =>
      img
        .resize(180, 180, { fit: 'cover' })
        .flatten({ background: '#fff0e4' })
        .png({ compressionLevel: 9 }),
  );

  console.log('Hecho.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
