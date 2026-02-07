import { select } from '@inquirer/prompts';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { styleText } from 'node:util';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const BANNER = `
  ╔═══════════════════════════════════╗
  ║                                   ║
  ║   ${styleText('bold', 'KENGO')}  ${styleText('dim', `v${pkg.version}`)}                  ║
  ║   ${styleText('dim', 'Plataforma de fisioterapia')}      ║
  ║                                   ║
  ╚═══════════════════════════════════╝
`;

const PROYECTOS = [
  { name: `App   ${styleText('dim', '(Angular Frontend :4200)')}`, value: 'app' },
  { name: `Web   ${styleText('dim', '(Angular Web     :4300)')}`, value: 'web' },
  { name: `Backend ${styleText('dim', '(Node.js API   :3000)')}`, value: 'backend' },
  { name: `App + Backend ${styleText('dim', '(Full Stack :4200 + :3000)')}`, value: 'fullstack' },
];

const MODOS = [
  { name: `Desarrollo ${styleText('dim', '(hot-reload, sourcemaps)')}`, value: 'development' },
  { name: `Produccion ${styleText('dim', '(build optimizado)')}`, value: 'production' },
];

const COMANDOS = {
  app: {
    development: [['npx', ['nx', 'serve', 'app']]],
    production: [['npx', ['nx', 'serve', 'app', '--configuration=production']]],
  },
  web: {
    development: [['npx', ['nx', 'serve', 'web']]],
    production: [['npx', ['nx', 'serve', 'web', '--configuration=production']]],
  },
  backend: {
    development: [['npx', ['nx', 'dev', 'backend']]],
    production: [['npx', ['nx', 'serve', 'backend']]],
  },
  fullstack: {
    development: [
      ['npx', ['nx', 'serve', 'app']],
      ['npx', ['nx', 'dev', 'backend']],
    ],
    production: [
      ['npx', ['nx', 'serve', 'app', '--configuration=production']],
      ['npx', ['nx', 'serve', 'backend']],
    ],
  },
};

async function main() {
  console.log(BANNER);

  let proyecto;
  let modo;

  try {
    proyecto = await select({
      message: 'Selecciona el proyecto',
      choices: PROYECTOS,
    });

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

  const comandos = COMANDOS[proyecto][modo];
  const etiqueta = proyecto === 'fullstack' ? 'App + Backend' : proyecto;
  console.log(`\n${styleText('bold', 'Iniciando')} ${etiqueta} en modo ${modo}\n`);

  const procesos = comandos.map(([cmd, args]) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
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

main();
