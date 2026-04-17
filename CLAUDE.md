# CLAUDE.md

## Project Overview

Kengo is a healthcare/physiotherapy management platform built with Angular 20. It provides exercise catalog management, patient/client management, treatment plan configuration, and clinic administration for physiotherapists. This application should prioritize viewing on mobile devices using tailwindcss for styling. This angular application uses Directus CMS for CRUD and a Node.js for custom requests.

## Architecture

- **apps/app/** — Angular 20 (standalone components, signals, OnPush). Has its own CLAUDE.md with Angular-specific rules.
- **apps/backend/** — **Node.js** custom API for additional endpoints. Has its own CLAUDE.md with Node-specific rules.
- **libs/shared/types/** — shared TypeScript interfaces. Import as `@secretar-ia/shared-types`.

### Monorepo Structure

```
kengo/
├── apps/
│   ├── app/                    # Angular frontend application
│   └── backend/                # Node.js/Express API
└── libs/
    └── shared/
        └── models/             # @kengo/shared-models library
```

## Backend Integration

- **Directus CMS**: Primary data source
- **Custom API**: Secondary endpoint at `API_URL` (localhost:4201 in dev, system.kengoapp.com in prod)

## Database

For detailed information about the database structure (tables, columns, relationships, constraints), please refer to the file `docs/DATABASE_SCHEMA.ddl`.

## Code Quality Verification

After making code changes, ALWAYS run `/verify` before committing to catch lint errors, type errors, and test failures early. Never commit code that introduces new lint warnings or type errors — fix them before committing.

## Subdirectory Instructions

`apps/app/CLAUDE.md` contains Angular-specific coding standards (signals, OnPush, accessibility, component patterns). It loads automatically when working in that directory.
