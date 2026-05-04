/**
 * @kengo/shared-models
 *
 * Librería compartida de tipos TypeScript para el monorepo Kengo.
 * Tras la migración a Convex (v1.0), expone:
 *  - Tipos base (`types/`)
 *  - Tipos `*Record` con la forma del record expandido del backend (`records/`).
 *  - Tipos de dominio (`domain/`) — formato canónico que consumen las apps.
 *  - Payloads para mutations Convex (`payloads/`).
 */

// Tipos base y utilitarios
export * from './lib/types/common';

// Tipos *Record (forma del record expandido del backend)
export * from './lib/records/users.record';
export * from './lib/records/exercises.record';
export * from './lib/records/plans.record';

// Tipos de dominio transformados para uso en las apps
export * from './lib/domain/users';
export * from './lib/domain/exercises';
export * from './lib/domain/plans';
export * from './lib/domain/routines';
export * from './lib/domain/clinics';
export * from './lib/domain/sessions';
export * from './lib/domain/access-codes';
export * from './lib/domain/compliance';
export * from './lib/domain/notifications';
export * from './lib/domain/dashboard';
export * from './lib/domain/assignments';
export * from './lib/domain/billing';

// DTOs para operaciones de crear/actualizar
export * from './lib/payloads/plans.payload';
export * from './lib/payloads/routines.payload';
export * from './lib/payloads/users.payload';
export * from './lib/payloads/clinics.payload';
export * from './lib/payloads/password-reset.payload';
export * from './lib/payloads/email-verification.payload';
export * from './lib/payloads/assignments.payload';
