# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the backend application for Kengo. Kengo is a healthcare/physiotherapy management platform. It provides exercise catalog management, patient/client management, treatment plan configuration, and clinic administration for physiotherapists. It uses Directus CMS as complementary backend. Both applications work together connecting to a MySQL Database.

## Build & Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production run
npm start
```

No test suite is currently configured.

## Architecture Overview

This is a Node.js/Express TypeScript backend for a healthcare clinic management application. It integrates with **Directus CMS** for user management and uses **MySQL** for data storage.

### Key Components

- **Entry Point**: `src/app.ts` - Express server setup, middleware, listens on port 3000
- **Controllers** (`src/controllers/`): Request handlers with static methods
- **Models** (`src/models/`): Database and Directus SDK operations
- **Routes** (`src/routes/apiKengo.ts`): API endpoint definitions
- **Utils** (`src/utils/database.ts`): MySQL connection pool

### API Endpoints

All routes mounted at root (`/`):

- `POST /getUsuarioById` - Fetch user by ID
- `POST /crearMagicLink` - Generate magic link for passwordless auth
- `POST /consumirMagicLink` - Verify and consume magic link token

### Authentication Flow

The app uses a magic link system for authentication:

1. `crearMagicLink` generates a JWT containing user credentials, stores URL in Directus
2. `consumirMagicLink` verifies the JWT and exchanges it for Directus access/refresh tokens

JWT is signed with `MAGIC_JWT_SECRET` and has configurable TTL via `MAGIC_JWT_TTL_MIN`.

### External Integrations

- **Directus SDK** (`@directus/sdk`): User CRUD, authentication, stores magic link URLs
- **MySQL** (`mysql2`): Connection pooling, direct queries for user data

## Environment Variables

```
MYSQL_PRIVATE_URL, MYSQL_PORT, MYSQLUSER, MYSQL_DATABASE, MYSQL_ROOT_PASSWORD
DIRECTUS_URL, DIRECTUS_STATIC_TOKEN
APP_URL, MAGIC_JWT_SECRET, MAGIC_JWT_TTL_MIN
```

## Conventions

- Static class methods for controllers (e.g., `usuarioController.method`)
- Directus schema types defined in `src/models/directus.ts`
- Database field names use snake_case
- Async/await with try-catch error handling returning JSON responses
