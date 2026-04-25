/**
 * Tipos base y utilitarios compartidos
 */

/** ID genérico que puede ser string o número */
export type ID = string | number;

/** UUID de 36 caracteres (heredado del esquema legacy de Directus). */
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
