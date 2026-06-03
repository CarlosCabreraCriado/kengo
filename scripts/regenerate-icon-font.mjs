#!/usr/bin/env node
// Regenera el subset auto-hosteado de Material Symbols Outlined.
// Escanea apps/app/src/ buscando todos los iconos usados, los fusiona con
// scripts/icon-allowlist.txt, descarga el subset desde Google Fonts y lo
// convierte a WOFF2 via `woff2_compress`.
//
// Uso:   node scripts/regenerate-icon-font.mjs
//        (o `npm run icons:regenerate`)
//
// Requiere `brew install woff2` una vez (provee `woff2_compress`).

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = join(ROOT, 'apps/app/src');
const FONT_PATH = join(ROOT, 'apps/app/src/assets/fonts/material-symbols-subset.woff2');
const ALLOWLIST_PATH = join(__dirname, 'icon-allowlist.txt');
const SNAPSHOT_PATH = join(__dirname, '.icon-snapshot.txt');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const EXTENSIONS = new Set(['.html', '.ts']);
const SKIP_DIRS = new Set(['node_modules', '.angular', '.nx', 'dist', 'coverage', '__snapshots__']);

// Atributos/propiedades que reciben un nombre de icono Material en componentes UI2.
const ICON_PROPS = ['icon', 'iconLeft', 'iconRight', 'trailingIcon', 'leadingIcon'];

// El nombre de un icono Material es snake_case ascii, p.ej. task_alt, change_circle, sentiment_very_satisfied, qr_code_2.
const ICON_NAME = '[a-z][a-z0-9_]*';

function makePatterns() {
  const propAlt = ICON_PROPS.join('|');
  return [
    // Ligadura directa: <span class="material-symbols-outlined">task_alt</span>
    new RegExp(`class\\s*=\\s*"[^"]*material-symbols-outlined[^"]*"[^>]*>\\s*(${ICON_NAME})\\s*<`, 'g'),
    new RegExp(`class\\s*=\\s*'[^']*material-symbols-outlined[^']*'[^>]*>\\s*(${ICON_NAME})\\s*<`, 'g'),
    // Atributo HTML estatico:  iconLeft="task_alt"
    new RegExp(`\\b(?:${propAlt})\\s*=\\s*"(${ICON_NAME})"`, 'g'),
    new RegExp(`\\b(?:${propAlt})\\s*=\\s*'(${ICON_NAME})'`, 'g'),
    // Binding Angular con literal:  [iconLeft]="'task_alt'"
    new RegExp(`\\[(?:${propAlt})\\]\\s*=\\s*"\\s*'(${ICON_NAME})'\\s*"`, 'g'),
    new RegExp(`\\[(?:${propAlt})\\]\\s*=\\s*'\\s*"(${ICON_NAME})"\\s*'`, 'g'),
    // Propiedad de objeto TS:  { icon: 'task_alt', iconLeft: "bedtime" }
    new RegExp(`\\b(?:${propAlt})\\s*:\\s*'(${ICON_NAME})'`, 'g'),
    new RegExp(`\\b(?:${propAlt})\\s*:\\s*"(${ICON_NAME})"`, 'g'),
    // Valores de mapas tipo Record<string,string> de iconos:  completado: 'check_circle'
    // Solo se capturan dentro de archivos *-icon*.ts / icon-*.ts (filtrado abajo).
  ];
}

// Patrones extra que solo se aplican a archivos relacionados con iconos
// (filtra falsos positivos: cualquier string en código TS general).
function makeIconFilePatterns() {
  return [
    // Mapas: completado: 'check_circle',  o  'completado': "bedtime"
    new RegExp(`['"]?[a-zA-Z0-9_]+['"]?\\s*:\\s*['"](${ICON_NAME})['"]`, 'g'),
    // Returns: return 'task_alt';
    new RegExp(`return\\s+['"](${ICON_NAME})['"]`, 'g'),
  ];
}

const STANDARD_PATTERNS = makePatterns();
const ICON_FILE_PATTERNS = makeIconFilePatterns();

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, files);
    else {
      const dot = entry.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = entry.slice(dot);
      if (EXTENSIONS.has(ext)) files.push(full);
    }
  }
  return files;
}

function isIconRelatedFile(path) {
  const name = path.toLowerCase();
  return (
    name.includes('/icons/') ||
    name.includes('-icon.') ||
    name.includes('icon-map') ||
    name.includes('icon-config') ||
    name.endsWith('format-helpers.ts') ||
    /\b(icon|status|estado|tipo|sentiment|kpi|activity|urgencia|visibilidad|rol)[\w-]*\.(ts|html)$/.test(name)
  );
}

function extractIconsFromFile(path) {
  const found = new Set();
  let content;
  try { content = readFileSync(path, 'utf8'); }
  catch { return found; }

  for (const re of STANDARD_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      found.add(m[1]);
    }
  }

  if (isIconRelatedFile(path)) {
    for (const re of ICON_FILE_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        found.add(m[1]);
      }
    }
  }
  return found;
}

// Falsos positivos comunes que cazan los regex amplios pero no son iconos.
const STOPLIST = new Set([
  'true', 'false', 'null', 'undefined', 'void', 'never', 'unknown', 'any',
  'string', 'number', 'boolean', 'object', 'array', 'function',
  'self', 'this', 'super', 'new', 'class', 'const', 'let', 'var',
  'on', 'off', 'yes', 'no', 'ok', 'cancel_outlined',
  'pacientes', 'paciente', 'plan', 'planes', 'rutina', 'rutinas',
  'sesion', 'sesiones', 'ejercicio', 'ejercicios', 'fisio', 'admin',
  'es', 'en', 'eu', 'ca', 'gl',
  'completado', 'parcial', 'fallido', 'descanso', 'sin_plan', 'activo', 'inactivo',
  'small', 'medium', 'large', 'xs', 'sm', 'md', 'lg', 'xl',
  'primary', 'secondary', 'success', 'danger', 'warning_color',
  'left', 'right', 'center', 'top', 'bottom',
  'horizontal', 'vertical',
  'border', 'box', 'flex', 'grid', 'block', // 'block' SI es un icono Material — se reañade vía allowlist si hace falta
  'log', 'warn', 'info_log',
  'get', 'set', 'has', 'add', // 'add' SI es icono — reañadido vía allowlist
  'login', 'logout_ok',
]);

// Iconos del subset oficial que sí deben pasar incluso si chocan con palabras comunes.
// Se aplican DESPUES del stoplist para revertir falsos descartes.
const FORCE_KEEP = new Set([
  'add', 'block', 'check', 'cancel', 'close', 'delete', 'done', 'edit',
  'home', 'info', 'lock', 'logout', 'login', 'mail', 'menu', 'more_horiz',
  'more_vert', 'person', 'phone', 'play', 'print', 'public', 'refresh',
  'search', 'send', 'share', 'star', 'tune', 'warning',
]);

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  const text = readFileSync(ALLOWLIST_PATH, 'utf8');
  const out = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (/^[a-z][a-z0-9_]*$/.test(line)) out.add(line);
  }
  return out;
}

function loadSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return new Set();
  return new Set(
    readFileSync(SNAPSHOT_PATH, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function ensureWoff2Compress() {
  const res = spawnSync('which', ['woff2_compress'], { encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout.trim()) {
    console.error('\nERROR: `woff2_compress` no esta disponible en PATH.');
    console.error('Instalalo con:  brew install woff2');
    process.exit(1);
  }
}

async function fetchFontUrl(iconNames) {
  // La API CSS devuelve un @font-face con la URL al WOFF2/TTF segun el User-Agent.
  // Con UA moderno -> woff2. Pero `woff2_compress` requiere TTF de entrada, asi que
  // usamos un UA viejo (compatible con TTF) o lo dejamos al UA por defecto y leemos lo que devuelva.
  // Estrategia: pedimos con UA moderno y, si vuelve woff2, lo guardamos directo.
  // Pedimos con un UA antiguo para forzar TTF y poder pasarlo por woff2_compress -> mejor compresion (mismo glifos pero re-subseteados estricto).
  // En la practica Google Fonts ya devuelve un subset minimo correcto; reconvertir a WOFF2 es opcional.
  // Simplificacion: pedimos con UA moderno (devuelve WOFF2 ya optimo) y lo escribimos directo.

  const names = [...iconNames].sort().join(',');
  const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${encodeURIComponent(names)}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`Fetch CSS fallo (${res.status}): ${url}`);
  }
  const css = await res.text();
  const m = css.match(/url\((https?:[^)]+)\)\s+format\(['"]woff2['"]\)/);
  if (!m) {
    throw new Error(`No se encontro URL WOFF2 en el CSS devuelto:\n${css.slice(0, 400)}`);
  }
  return m[1];
}

async function downloadFont(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Descarga del WOFF2 fallo (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function bytesHuman(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(2)} kB`;
}

function diffSets(prev, next) {
  const added = [...next].filter((x) => !prev.has(x)).sort();
  const removed = [...prev].filter((x) => !next.has(x)).sort();
  return { added, removed };
}

async function main() {
  console.log(`> Escaneando ${relative(ROOT, SRC_DIR)}...`);
  const files = walk(SRC_DIR);
  console.log(`  ${files.length} archivos (.html/.ts)`);

  const scanned = new Set();
  for (const f of files) {
    for (const name of extractIconsFromFile(f)) {
      if (STOPLIST.has(name) && !FORCE_KEEP.has(name)) continue;
      scanned.add(name);
    }
  }

  const allowlist = loadAllowlist();
  for (const n of allowlist) scanned.add(n);

  // Garantizamos un set minimo: si por error el escaneo no encuentra nada, no rompemos la app.
  const MINIMUM = ['home', 'close', 'check', 'warning', 'error', 'info'];
  for (const n of MINIMUM) scanned.add(n);

  const finalList = [...scanned].sort();
  console.log(`  ${finalList.length} iconos en total (escaneo + allowlist)`);

  const prev = loadSnapshot();
  const { added, removed } = diffSets(prev, scanned);
  if (added.length) console.log(`  + ${added.length} nuevos:`, added.join(', '));
  if (removed.length) console.log(`  - ${removed.length} eliminados:`, removed.join(', '));
  if (!added.length && !removed.length && prev.size > 0) console.log('  (sin cambios respecto al snapshot)');

  ensureWoff2Compress();

  console.log('> Resolviendo URL del WOFF2 en Google Fonts...');
  const woff2Url = await fetchFontUrl(finalList);
  console.log(`  ${woff2Url}`);

  console.log('> Descargando WOFF2...');
  const buf = await downloadFont(woff2Url);
  console.log(`  ${bytesHuman(buf.length)} descargados`);

  writeFileSync(FONT_PATH, buf);
  console.log(`> Escrito ${relative(ROOT, FONT_PATH)} (${bytesHuman(buf.length)})`);

  writeFileSync(SNAPSHOT_PATH, finalList.join('\n') + '\n');
  console.log(`> Snapshot actualizado: ${relative(ROOT, SNAPSHOT_PATH)}`);

  console.log('\nListo. Verifica visualmente las paginas afectadas y commitea los cambios.');
}

main().catch((err) => {
  console.error('\nFallo la regeneracion:', err.message);
  process.exit(1);
});
