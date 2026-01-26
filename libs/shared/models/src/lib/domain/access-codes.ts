/**
 * Tipos de dominio para códigos de acceso
 * Tipos transformados y listos para usar en las aplicaciones
 */

/**
 * Tipo de código de acceso
 */
export type TipoCodigoAcceso = 'fisioterapeuta' | 'paciente';

/**
 * Código de acceso transformado para uso en la aplicación
 */
export interface CodigoAcceso {
  id: number;
  codigo: string;
  tipo: TipoCodigoAcceso;
  activo: boolean;
  usosMaximos: number | null;
  usosActuales: number;
  fechaExpiracion: Date | null;
  email: string | null;
  fechaCreacion: Date;
}

/**
 * Resultado de validar un código de acceso
 */
export interface ValidacionCodigo {
  valido: boolean;
  error?: 'CODIGO_NO_ENCONTRADO' | 'CODIGO_INACTIVO' | 'CODIGO_EXPIRADO' | 'CODIGO_AGOTADO' | 'EMAIL_NO_COINCIDE';
  tipo?: TipoCodigoAcceso;
  nombreClinica?: string;
}
