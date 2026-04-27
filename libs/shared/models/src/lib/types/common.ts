/**
 * Tipos base y utilitarios compartidos
 */

/** ID genérico (Convex Id, string opaco). */
export type ID = string;

/** UUID de 36 caracteres. */
export type UUID = string;

/** Timestamp ISO 8601 string */
export type Timestamp = string;

/**
 * Días de la semana (abreviados)
 * L = Lunes, M = Martes, X = Miércoles, J = Jueves, V = Viernes, S = Sábado, D = Domingo
 */
export type DiaSemana = 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D';

/** Rol de usuario en la plataforma */
export type RolUsuario = 'fisio' | 'paciente';
