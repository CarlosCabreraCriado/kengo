# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kengo is a healthcare/physiotherapy management platform built with Angular 20. It provides exercise catalog management, patient/client management, treatment plan configuration, and clinic administration for physiotherapists. This application should prioritize viewing on mobile devices using tailwindcss for styling. This angular application uses Directus CMS for CRUD and a Node.js for custom requests.

## Build & Development Commands

```bash
npm start          # Dev server at http://localhost:4200/
npm run build      # Production build (outputs to dist/)
npm run lint       # ESLint check
npm test           # Run tests with Karma + Jasmine
npm run watch      # Build with watch mode (development config)
```

## Architecture

### Technology Stack

- **Angular 20** with standalone components and Signals
- **Tailwind CSS 4** for utility styling
- **TypeScript 5.8** with strict mode enabled
- **Directus CMS** as primary backend (<https://admin.kengoapp.com>)
- **Node.js** custom API for additional endpoints
- **Nx Monorepo** for workspace management

### Monorepo Structure

```
kengo/
├── apps/
│   ├── app/                    # Angular frontend application
│   │   └── src/
│   │       ├── app/
│   │       │   ├── core/       # Auth, guards, interceptors
│   │       │   ├── features/   # Feature modules (planes, ejercicios, etc.)
│   │       │   └── shared/     # Shared components and utilities
│   │       ├── types/global.ts # Re-exports from @kengo/shared-models
│   │       └── environments/   # Environment configs
│   └── backend/                # Node.js/Express API
│       └── src/
│           ├── controllers/
│           ├── models/
│           ├── routes/
│           └── types/          # Re-exports from @kengo/shared-models
└── libs/
    └── shared/
        └── models/             # @kengo/shared-models library
            └── src/lib/
                ├── types/      # Base types (ID, UUID, DiaSemana)
                ├── database/   # DB schema types (*.db.ts)
                ├── directus/   # Directus SDK response types
                ├── domain/     # Transformed domain types
                └── payloads/   # Create/update DTOs
```

### Shared Models Library (`@kengo/shared-models`)

Tipos TypeScript sincronizados entre frontend y backend:

```typescript
import { Usuario, Plan, Ejercicio, DiaSemana } from '@kengo/shared-models';
```

**Categorías de tipos:**

| Carpeta | Propósito | Ejemplo |
|---------|-----------|---------|
| `types/` | Tipos base utilitarios | `ID`, `UUID`, `DiaSemana`, `Timestamp` |
| `database/` | Reflejan esquema BD exacto | `PlanDB`, `EjercicioDB`, `ClinicaDB` |
| `directus/` | Respuestas del SDK Directus | `PlanDirectus`, `UsuarioDirectus` |
| `domain/` | Tipos transformados para apps | `Plan`, `Usuario`, `PlanCompleto` |
| `payloads/` | DTOs para crear/actualizar | `CreatePlanPayload`, `CreateRutinaPayload` |

**Tipo DiaSemana:**
```typescript
type DiaSemana = 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D';
```

### Routing Structure

Routes are defined in `app.routes.ts`:

- Auth routes: `/login`, `/registro`, `/magic`
- Protected routes under `/inicio` using `NavegacionComponent` as shell:
  - `/inicio/dashboard`, `/inicio/perfil`, `/inicio/ejercicios`, `/inicio/mis-pacientes`, `/inicio/mi-clinica`

### State Management

- **Signals** for component and service reactive state
- **RxJS** for HTTP operations and complex async flows
- Auth state managed in `auth.service.ts` using signals (accessToken, refreshToken, isLoggedIn)

## Code Conventions

### Component Selectors

- Components: kebab-case with `app-` prefix (e.g., `app-ejercicios`)
- Directives: camelCase with `app` prefix (e.g., `appDirective`)

### Styling

- Primary color: `#e75c3e` (coral/orange-red)
- Tertiary color: `#efc048` (gold)
- Theme defined in `src/theme.scss`
- Custom `.tarjeta-kengo` class for glassmorphism cards

### Patterns

- All components use `standalone: true`
- Reactive Forms preferred over template-driven
- Use `takeUntilDestroyed()` for RxJS subscription cleanup
- Angular CDK breakpoints for responsive layouts

### Type Imports

Importar tipos desde `@kengo/shared-models` o desde `types/global.ts` (que re-exporta la librería):

```typescript
// Opción 1: Directo desde librería compartida
import { Usuario, Plan } from '@kengo/shared-models';

// Opción 2: Desde global.ts (incluye tipos específicos de frontend)
import { Usuario, Plan, SeccionPrincipal } from '../types/global';
```

## Backend Integration

- **Directus CMS**: Primary data source
- **Custom API**: Secondary endpoint at `API_URL` (localhost:3000 in dev, system.kengoapp.com in prod)
- **Magic Link Auth**: Authentication via magic links with `MAGIC_HASH`

## Deployment

Railway platform deployment using Caddy server. Build configuration in `nixpacks.toml`, server config in `Caddyfile`.
