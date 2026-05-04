import { select, Separator } from '@inquirer/prompts';
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { styleText } from 'node:util';

// ── Registro de puertos ──────────────────────────────────────────────

const REGISTRY_PATH = join(homedir(), '.dev-ports.json');
const BLOCK_SIZE = 10;
const FIRST_BASE = 4200;
const MAX_SLOT = 9;

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, blockSize: BLOCK_SIZE, projects: {} };
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
}

function writeRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

function nextFreeBase(registry) {
  const usedBases = Object.values(registry.projects).map((p) => p.base);
  let candidate = FIRST_BASE;
  while (usedBases.includes(candidate)) {
    candidate += BLOCK_SIZE;
  }
  return candidate;
}

function getOrRegisterPuertos() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  const projectName = pkg.name;
  const registry = readRegistry();

  if (!registry.projects[projectName]) {
    const base = nextFreeBase(registry);
    registry.projects[projectName] = { base, registered: new Date().toISOString().slice(0, 10) };
    writeRegistry(registry);
    console.log(styleText('green', `  ✓ Proyecto registrado: ${projectName} → base ${base} (rango ${base}-${base + BLOCK_SIZE - 1})`));
  }

  const base = registry.projects[projectName].base;
  return { app: base, api: base + 1, landingpage: base + 2, projectName, version: pkg.version };
}

function changePortSlot(projectName, slot) {
  const base = FIRST_BASE + (slot - 1) * BLOCK_SIZE;
  const registry = readRegistry();
  registry.projects[projectName] = {
    base,
    registered: registry.projects[projectName]?.registered || new Date().toISOString().slice(0, 10),
  };
  writeRegistry(registry);
  return { app: base, api: base + 1, landingpage: base + 2 };
}

// ── Helpers de UI ────────────────────────────────────────────────────

function buildBanner(ports) {
  const W = 39; // ancho interior del recuadro

  const lineas = [
    '',
    `   KENGO  v${ports.version}`,
    '   Plataforma de fisioterapia',
    `   Puertos: ${ports.app}-${ports.app + BLOCK_SIZE - 1}`,
    '',
    '   Desarrollado por Nodus Development',
    '',
  ];

  const styled = lineas.map((l, i) => {
    if (i === 1) return `   ${styleText('bold', 'KENGO')}  ${styleText('dim', `v${ports.version}`)}`;
    if (i === 2) return `   ${styleText('dim', 'Plataforma de fisioterapia')}`;
    if (i === 3) return `   ${styleText('dim', `Puertos: ${ports.app}-${ports.app + BLOCK_SIZE - 1}`)}`;
    if (i === 5) return `   ${styleText('dim', 'Desarrollado por')} ${styleText('bold', 'Nodus Development')}`;
    return l;
  });

  const top = `  ╔${'═'.repeat(W)}╗`;
  const bot = `  ╚${'═'.repeat(W)}╝`;
  const rows = lineas.map((plain, i) => {
    const trailing = ' '.repeat(Math.max(0, W - plain.length));
    return `  ║${styled[i]}${trailing}║`;
  });

  return '\n' + top + '\n' + rows.join('\n') + '\n' + bot + '\n';
}

function buildProyectos(ports) {
  return [
    { name: `App   ${styleText('dim', `(Angular Frontend :${ports.app} → kengo.localhost)`)}`, value: 'app' },
    { name: `Landing ${styleText('dim', `(Angular Landing :${ports.landingpage} → kengo-landingpage.localhost)`)}`, value: 'landingpage' },
    { name: `Backend ${styleText('dim', `(Node.js API   :${ports.api} → kengo-api.localhost)`)}`, value: 'backend' },
    { name: `App + Backend ${styleText('dim', `(Full Stack :${ports.app} + :${ports.api} → kengo.localhost + kengo-api.localhost)`)}`, value: 'fullstack' },
    new Separator(styleText('dim', '  ── iOS ──')),
    { name: `Build de aplicación (iOS) ${styleText('dim', '(build native + iconos + sync + Xcode)')}`, value: 'ios:build' },
    { name: `Sincronizar y abrir Xcode (iOS) ${styleText('dim', '(sync + open, sin rebuild)')}`, value: 'ios:sync-open' },
    { name: `Run en simulador iOS ${styleText('dim', '(cap run ios)')}`, value: 'ios:run' },
    new Separator(styleText('dim', '  ── Configuración ──')),
    { name: styleText('dim', 'Cambiar rango de puertos'), value: 'change-ports' },
  ];
}

function buildComandos(ports) {
  return {
    app: {
      development: [['npx', ['nx', 'serve', 'app', `--port=${ports.app}`]]],
      production: [['npx', ['nx', 'serve', 'app', '--configuration=production', `--port=${ports.app}`]]],
    },
    landingpage: {
      development: [['npx', ['nx', 'serve', 'landingpage', `--port=${ports.landingpage}`]]],
      production: [['npx', ['nx', 'serve', 'landingpage', '--configuration=production', `--port=${ports.landingpage}`]]],
    },
    backend: {
      development: [['npx', ['nx', 'dev', 'backend']]],
      production: [['npx', ['nx', 'serve', 'backend']]],
    },
    fullstack: {
      development: [
        ['npx', ['nx', 'serve', 'app', `--port=${ports.app}`]],
        ['npx', ['nx', 'dev', 'backend']],
      ],
      production: [
        ['npx', ['nx', 'serve', 'app', '--configuration=production', `--port=${ports.app}`]],
        ['npx', ['nx', 'serve', 'backend']],
      ],
    },
  };
}

function buildSlotChoices(currentBase) {
  const registry = readRegistry();
  const usedBases = new Map(
    Object.entries(registry.projects).map(([name, p]) => [p.base, name]),
  );

  return Array.from({ length: MAX_SLOT }, (_, i) => {
    const slot = i + 1;
    const base = FIRST_BASE + i * BLOCK_SIZE;
    const owner = usedBases.get(base);
    const isCurrent = base === currentBase;
    const rango = `${base}-${base + BLOCK_SIZE - 1}`;

    let label = `${slot}  →  ${rango}`;
    if (isCurrent) label += styleText('green', '  (actual)');
    else if (owner) label += styleText('dim', `  (${owner})`);

    return { name: label, value: slot };
  });
}

const MODOS = [
  { name: `Desarrollo ${styleText('dim', '(hot-reload, sourcemaps)')}`, value: 'development' },
  { name: `Produccion ${styleText('dim', '(build optimizado)')}`, value: 'production' },
];

// ── Pipeline secuencial (iOS) ────────────────────────────────────────

async function runSequential(steps) {
  for (const step of steps) {
    const { label, cmd, args, cwd, optional } = step;
    const cwdHint = cwd ? styleText('dim', `  (${cwd})`) : '';
    console.log(`\n${styleText('cyan', '▶')} ${styleText('bold', label)}`);
    console.log(`  ${styleText('dim', `${cmd} ${args.join(' ')}`)}${cwdHint}\n`);

    const exitCode = await new Promise((resolve) => {
      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
        cwd: cwd || undefined,
        env: { ...process.env },
      });
      child.on('close', (code) => resolve(code ?? 0));
      child.on('error', (err) => {
        console.error(styleText('red', `Error: ${err.message}`));
        resolve(1);
      });
    });

    if (exitCode !== 0) {
      if (optional) {
        console.log(styleText('yellow', `\n  ⚠ Paso opcional falló (exit ${exitCode}). Continuando.`));
        continue;
      }
      console.log(styleText('red', `\n  ✗ Paso falló (exit ${exitCode}). Pipeline abortado.\n`));
      return exitCode;
    }
  }
  console.log(styleText('green', '\n  ✓ Pipeline completado.\n'));
  return 0;
}

const IOS_ICON_SOURCE = 'apps/app/assets/icon-only.png';

async function runIosBuildCompleto() {
  const hasIconSource = existsSync(IOS_ICON_SOURCE);
  if (!hasIconSource) {
    console.log(styleText('yellow', `\n  ⚠ No se encontró ${IOS_ICON_SOURCE}.`));
    console.log(styleText('dim', '    Saltando regeneración de iconos. Ver docs/CAPACITOR_NATIVE_APP.md §6.6.'));
  }

  const steps = [
    { label: 'Build native (Angular bundle)', cmd: 'npm', args: ['run', 'build:native'] },
    ...(hasIconSource
      ? [{
          label: 'Regenerar iconos y splash',
          cmd: 'npx',
          args: ['capacitor-assets', 'generate'],
          cwd: 'apps/app',
          optional: true,
        }]
      : []),
    { label: 'Sincronizar proyecto iOS', cmd: 'npx', args: ['cap', 'sync', 'ios'], cwd: 'apps/app' },
    { label: 'Abrir proyecto en Xcode', cmd: 'npx', args: ['cap', 'open', 'ios'], cwd: 'apps/app' },
  ];

  return runSequential(steps);
}

async function runIosSyncOpen() {
  return runSequential([
    { label: 'Sincronizar proyecto iOS', cmd: 'npx', args: ['cap', 'sync', 'ios'], cwd: 'apps/app' },
    { label: 'Abrir proyecto en Xcode', cmd: 'npx', args: ['cap', 'open', 'ios'], cwd: 'apps/app' },
  ]);
}

async function runIosSimulator() {
  return runSequential([
    { label: 'Run en simulador iOS', cmd: 'npx', args: ['cap', 'run', 'ios'], cwd: 'apps/app' },
  ]);
}

// ── Caddy ─────────────────────────────────────────────────────────────

function checkCaddy() {
  try {
    execSync('which caddy', { stdio: 'ignore' });
  } catch {
    console.log(styleText('yellow', '\n  ⚠ Caddy no está instalado. Los dominios .localhost no funcionarán.'));
    console.log(styleText('yellow', '    Instala con: brew install caddy'));
    console.log(styleText('yellow', '    Después ejecuta: bash scripts/setup-caddy.sh\n'));
    return;
  }

  try {
    execSync('bash scripts/setup-caddy.sh', { stdio: 'inherit' });
  } catch {
    // Setup failed — continue anyway
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  let ports = getOrRegisterPuertos();
  checkCaddy();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log(buildBanner(ports));

    let proyecto;
    let modo;

    try {
      proyecto = await select({
        message: 'Selecciona el proyecto',
        choices: buildProyectos(ports),
      });

      if (proyecto === 'change-ports') {
        const slot = await select({
          message: 'Selecciona el rango de puertos',
          choices: buildSlotChoices(ports.app),
        });

        const newPorts = changePortSlot(ports.projectName, slot);
        ports = { ...ports, ...newPorts };
        const base = newPorts.app;
        console.log(styleText('green', `\n  ✓ Puertos actualizados: ${base}-${base + BLOCK_SIZE - 1}\n`));
        continue;
      }

      if (proyecto === 'ios:build') {
        await runIosBuildCompleto();
        continue;
      }

      if (proyecto === 'ios:sync-open') {
        await runIosSyncOpen();
        continue;
      }

      if (proyecto === 'ios:run') {
        await runIosSimulator();
        continue;
      }

      modo = await select({
        message: 'Selecciona el modo',
        choices: MODOS,
      });
    } catch (error) {
      if (error.name === 'ExitPromptError') {
        console.log(styleText('dim', '\nSaliendo...'));
        process.exit(0);
      }
      throw error;
    }

    const comandos = buildComandos(ports)[proyecto][modo];
    const etiqueta = proyecto === 'fullstack' ? 'App + Backend' : proyecto;
    console.log(`\n${styleText('bold', 'Iniciando')} ${etiqueta} en modo ${modo}\n`);

    const portEnv = {
      KENGO_PORT_APP: String(ports.app),
      KENGO_PORT_API: String(ports.api),
      KENGO_PORT_LANDINGPAGE: String(ports.landingpage),
    };

    const procesos = comandos.map(([cmd, args]) => {
      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, ...portEnv },
      });
      child.on('error', (err) => {
        console.error(`Error ejecutando ${cmd} ${args.join(' ')}:`, err.message);
      });
      return child;
    });

    const cleanup = () => {
      for (const child of procesos) {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Esperar a que todos los procesos terminen
    const codigos = await Promise.all(
      procesos.map(
        (child) =>
          new Promise((resolve) => {
            child.on('close', (code) => resolve(code ?? 0));
          }),
      ),
    );

    const codigoSalida = Math.max(...codigos);
    process.exit(codigoSalida);
  }
}

main();
