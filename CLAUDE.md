# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kengo is a healthcare/physiotherapy management platform built with Angular 20. It provides exercise catalog management, patient/client management, treatment plan configuration, and clinic administration for physiotherapists. It uses tailwindcss for styling and Directus CMS as the primary backend.

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
- **Angular Material 20** for UI components
- **Tailwind CSS 4** for utility styling
- **TypeScript 5.8** with strict mode enabled
- **Directus CMS** as primary backend (<https://admin.kengoapp.com>)

### Key Directories

- `src/app/services/` - 8 core services (auth, ejercicios, clinicas, plan-builder, etc.)
- `src/app/Components/` - 34 standalone components organized by domain
- `src/types/global.ts` - Shared TypeScript interfaces and types
- `src/environments/` - Environment-specific configuration

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

## Backend Integration

- **Directus CMS**: Primary data source
- **Custom API**: Secondary endpoint at `API_URL` (localhost:3000 in dev, system.kengoapp.com in prod)
- **Magic Link Auth**: Authentication via magic links with `MAGIC_HASH`

## Deployment

Railway platform deployment using Caddy server. Build configuration in `nixpacks.toml`, server config in `Caddyfile`.
