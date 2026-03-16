#!/usr/bin/env node

/**
 * dev-ports — Registro central de puertos para desarrollo local.
 *
 * Asigna bloques de 10 puertos por proyecto en ~/.dev-ports.json
 * para evitar colisiones entre proyectos simultaneos.
 *
 * Uso:
 *   node scripts/dev-ports.mjs register <nombre>
 *   node scripts/dev-ports.mjs list
 *   node scripts/dev-ports.mjs get <nombre>
 *   node scripts/dev-ports.mjs remove <nombre>
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REGISTRY_PATH = join(homedir(), '.dev-ports.json');
const BLOCK_SIZE = 10;
const FIRST_BASE = 4200;

// ── Helpers ──────────────────────────────────────────────────────────

export function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, blockSize: BLOCK_SIZE, projects: {} };
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
}

export function writeRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

export function nextFreeBase(registry) {
  const usedBases = Object.values(registry.projects).map((p) => p.base);
  let candidate = FIRST_BASE;
  while (usedBases.includes(candidate)) {
    candidate += BLOCK_SIZE;
  }
  return candidate;
}

// ── Comandos ─────────────────────────────────────────────────────────

function register(name) {
  if (!name) {
    console.error('Uso: dev-ports register <nombre>');
    process.exit(1);
  }
  const registry = readRegistry();
  if (registry.projects[name]) {
    console.log(`Ya registrado: ${name} → base ${registry.projects[name].base}`);
    return;
  }
  const base = nextFreeBase(registry);
  registry.projects[name] = { base, registered: new Date().toISOString().slice(0, 10) };
  writeRegistry(registry);
  console.log(`Registrado: ${name} → base ${base} (rango ${base}-${base + BLOCK_SIZE - 1})`);
}

function list() {
  const registry = readRegistry();
  const entries = Object.entries(registry.projects);
  if (entries.length === 0) {
    console.log('No hay proyectos registrados.');
    return;
  }
  console.log('Proyecto          Base    Rango');
  console.log('─'.repeat(42));
  for (const [name, { base, registered }] of entries) {
    const rango = `${base}-${base + BLOCK_SIZE - 1}`;
    console.log(`${name.padEnd(18)}${String(base).padEnd(8)}${rango.padEnd(12)}${registered}`);
  }
}

function get(name) {
  if (!name) {
    console.error('Uso: dev-ports get <nombre>');
    process.exit(1);
  }
  const registry = readRegistry();
  const project = registry.projects[name];
  if (!project) {
    console.error(`Proyecto no registrado: ${name}`);
    process.exit(1);
  }
  // Solo imprime el numero base (para scripting)
  console.log(project.base);
}

function remove(name) {
  if (!name) {
    console.error('Uso: dev-ports remove <nombre>');
    process.exit(1);
  }
  const registry = readRegistry();
  if (!registry.projects[name]) {
    console.error(`Proyecto no registrado: ${name}`);
    process.exit(1);
  }
  const { base } = registry.projects[name];
  delete registry.projects[name];
  writeRegistry(registry);
  console.log(`Eliminado: ${name} (base ${base})`);
}

// ── CLI ──────────────────────────────────────────────────────────────

const [command, arg] = process.argv.slice(2);

switch (command) {
  case 'register':
    register(arg);
    break;
  case 'list':
    list();
    break;
  case 'get':
    get(arg);
    break;
  case 'remove':
    remove(arg);
    break;
  default:
    console.log(`dev-ports — Registro central de puertos para desarrollo local

Comandos:
  register <nombre>   Registrar proyecto (asigna siguiente bloque libre)
  list                Listar proyectos registrados
  get <nombre>        Obtener base del proyecto (para scripting)
  remove <nombre>     Eliminar proyecto del registro`);
    process.exit(command ? 1 : 0);
}
