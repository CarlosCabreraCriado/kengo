/**
 * @kengo/shared-models
 *
 * Librería compartida de tipos TypeScript para el monorepo Kengo.
 * Sincroniza los modelos entre frontend (Angular) y backend (Node.js).
 */

// Tipos base y utilitarios
export * from './lib/types/common';

// Tipos que reflejan exactamente la estructura de la BD
export * from './lib/database/users.db';
export * from './lib/database/exercises.db';
export * from './lib/database/plans.db';
export * from './lib/database/routines.db';
export * from './lib/database/clinics.db';

// Tipos para respuestas del SDK Directus
export * from './lib/directus/users.directus';
export * from './lib/directus/exercises.directus';
export * from './lib/directus/plans.directus';
export * from './lib/directus/routines.directus';
export * from './lib/directus/clinics.directus';

// Tipos de dominio transformados para uso en las apps
export * from './lib/domain/users';
export * from './lib/domain/exercises';
export * from './lib/domain/plans';
export * from './lib/domain/routines';
export * from './lib/domain/clinics';
export * from './lib/domain/sessions';

// DTOs para operaciones de crear/actualizar
export * from './lib/payloads/plans.payload';
export * from './lib/payloads/routines.payload';
export * from './lib/payloads/users.payload';
