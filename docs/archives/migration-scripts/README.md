# Migration scripts (archive)

Scripts de seeding y SQL ejecutados durante la migración de Directus + Node/Express a Convex (abril 2026). Estos artefactos **NO** son código de runtime; quedan archivados aquí como referencia auditable.

## Contenido

- `seed/` — Funciones Convex que importaron datos legacy desde JSON dumps (usuarios, clínicas, ejercicios, planes, registros, etc.). Se ejecutaron una sola vez con `npx convex run seed/<archivo>:<función>`.
- `seed/data/` — Dumps JSON de origen utilizados por los scripts.
- `sql/001_cumplimiento_diario.sql` — Script SQL histórico ejecutado contra MySQL antes del cutover.

## Cómo re-ejecutar (si fuese necesario)

1. Copiar `seed/` de vuelta a `convex/seed/`.
2. `npx convex dev --once` para regenerar `convex/_generated/api.d.ts`.
3. `npx convex run seed/<archivo>:<función>`.

Tras la migración, los datos vivos están en Convex. Cualquier ejecución sobrescribiría datos productivos — usar solo en entornos aislados (test, demo, restauración tras incidente).
