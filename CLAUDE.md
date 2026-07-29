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
│   ├── app/                    # Angular frontend application (kengoapp.com)
│   └── landingpage/            # Angular landing page (www.kengoapp.com)
└── libs/
    └── shared/
        ├── models/             # @kengo/shared-models library
        └── legal/              # @kengo/legal — textos legales compartidos
```

> Reparto de dominios (`railway.toml`): el **apex** `kengoapp.com` sirve la
> **app**; `www.kengoapp.com` sirve la **landing**. No hay redirect entre
> ellos: son dos servicios de Railway distintos.

## Backend Integration

- **Directus CMS**: Primary data source
- **Convex**: Custom endpoints served over HTTP at `CONVEX_SITE_URL` (backend.kengoapp.com). El antiguo backend Express (system.kengoapp.com) fue decomisionado tras la migración completa a Convex.

## Convex CLI

Ejecutar `npx convex codegen|deploy|dev` **siempre desde la raíz del proyecto** o vía `npm run convex:*`. El `convex.json` del root anclá la "functions dir" a `convex/`; evitar `cd convex && npx convex ...` para no disparar el bug del CLI que crea un `convex/convex/` anidado.

## Database

For detailed information about the database structure (tables, columns, relationships, constraints), please refer to the file `docs/DATABASE_SCHEMA.ddl`.

## Code Quality Verification

After making code changes, ALWAYS run `/verify` before committing to catch lint errors, type errors, and test failures early. Never commit code that introduces new lint warnings or type errors — fix them before committing.

## Subdirectory Instructions

`apps/app/CLAUDE.md` contains Angular-specific coding standards (signals, OnPush, accessibility, component patterns). It loads automatically when working in that directory.

## Contenido legal

Los cuatro documentos legales (privacidad, términos, cookies y aviso legal) viven **solo** en `libs/shared/legal` (`@kengo/legal`), como componentes standalone de contenido puro: sin `ui-v2`, sin router y sin servicios. Nunca dupliques el texto en una app — es texto con validez jurídica y dos copias divergen.

Se consumen desde tres sitios:

- **App, diálogo**: `features/legal/components/legal-dialog` (perfil y registro).
- **App, páginas públicas**: `/legal/*`, sin `AuthGuard` — las stores revisan la política sin iniciar sesión.
- **Landing**: `/legal/*`, prerenderizadas (SSG), que es la versión canónica indexable. La de la app lleva `noindex` + `canonical` hacia `www`.

Reglas:

- El título, la descripción y la **versión** de cada documento salen de `LEGAL_DOCS` (`legal-docs.metadata.ts`). Al revisar un texto de forma sustancial hay que subir su `version`: es lo que se guarda en la tabla `consents` como prueba del consentimiento (art. 7.1 RGPD).
- El prefijo de selector de la librería es `ui-` (`eslint.config.js` solo admite `app|web|ui|ui2`).
- El CSS usa tokens con fallback (`--ink-900` en la app, `--color-ink` en la landing): la librería no debe conocer a ninguna de las dos.
- Las URLs públicas que se declaran en App Store Connect y Play Console son las de `www.kengoapp.com`. **No usar `kengoapp.com/soporte`**: en la app esa ruta es la pantalla interna de impersonación con `SoporteGuard`.
- Al tocar `.well-known`, verificar con `curl -i` mirando el **body**: `express.static` ignora los directorios que empiezan por punto (`dotfiles: 'ignore'` por defecto en `send`), así que un fallo cae en el fallback SPA y devuelve `index.html` con **200**, aparentando funcionar. `apps/app/server.js` ya lo resuelve.

## Multiclínica

El modelo soporta N:N entre usuarios y clínicas a través de la tabla `clinicMemberships` en Convex (`{ userId, clinicId, puesto }`). El sistema funciona con **una única clínica activa por sesión** — todo lo demás se deriva de ella.

### Reglas

- **Contexto único activo**: el id de la clínica activa vive en `ClinicaActivaService` (`core/auth/services/clinica-activa.service.ts`), persistido en `localStorage:kengo:clinica-activa`. No existe vista agregada "todas las clínicas".
- **Modo derivado**: el modo fisio/paciente sale del puesto del usuario en la clínica activa. Cambiar de modo = cambiar de clínica. Se hace desde `<ui2-clinica-switcher>` (en `shared/ui-v2/clinica-switcher`).
- **Aislamiento estricto**: las queries de Convex que reciben `pacienteId` validan acceso vía `assertCanAccessPaciente` (`convex/_helpers/authorization.ts`); las que reciben `clinicId`, vía `assertCanAccessClinic`. `plans.getById` / `sessions.getById` / `routines.getById` validan con `assertCanAccess{Plan,Session,Routine}`. Un fisio nunca ve recursos de una clínica donde no es miembro.
- **`plans.clinicId`** es opcional en schema durante la migración, pero `plans.create` lo recibe y lo persiste; el backfill (`convex/migrations/backfillPlanClinicId*.ts`) lo rellenó retroactivamente. Tras confirmar 0 pendientes se podrá promover a obligatorio en schema.
- **Suscripción por clínica**: `plans.create/update/version` exigen suscripción activa de **la clínica del plan** (`requireActiveSubscription(clinicId)`), no de cualquiera del fisio.
- **Sesión del paciente**: `sessions.create` acepta `clinicId` opcional; cuando se proporciona, se atribuye estrictamente y solo cuenta ejercicios de planes de esa clínica.
- **Cascada al salir de una clínica** (`clinicMemberships.remove`): si el puesto era paciente, se borran `assignments` y se marcan `cancelado` los planes activos/borrador de esa clínica; si era fisio/admin, se borran los `assignments` donde figuraba como responsable. Nunca se hard-delete contenido clínico.
- **Rutas protegidas**: `ClinicaActivaGuard` (`core/guards/clinica-activa.guard.ts`) redirige a `/seleccionar-clinica` cuando el usuario tiene más de una clínica y ninguna está marcada como activa.
