import { EstadoPlan } from '../../../../types/global';
import type { Ui2PillVariant } from '../../../shared/ui-v2';

export const ESTADO_VARIANT: Record<EstadoPlan, Ui2PillVariant> = {
  borrador: 'neutral',
  activo: 'success',
  completado: 'soft',
  cancelado: 'danger',
};

export const ESTADO_LABEL: Record<EstadoPlan, string> = {
  borrador: 'Borrador',
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const ESTADO_DESCRIPCION: Record<EstadoPlan, string> = {
  borrador: 'El paciente todavía no puede verlo. Actívalo cuando esté listo.',
  activo: 'El paciente puede ver y ejecutar los ejercicios.',
  completado: 'El plan terminó. Se conserva en el historial.',
  cancelado: 'El plan fue cancelado. Se conserva en el historial.',
};

export function estadoVariantOf(estado: string | undefined): Ui2PillVariant {
  return ESTADO_VARIANT[(estado ?? '') as EstadoPlan] ?? 'neutral';
}

export function estadoLabelOf(estado: string | undefined): string {
  return ESTADO_LABEL[(estado ?? '') as EstadoPlan] ?? 'Plan';
}

/**
 * Devuelve las transiciones manuales permitidas desde el estado actual.
 * No incluye el propio estado actual.
 */
export function transicionesPermitidas(actual: EstadoPlan): EstadoPlan[] {
  switch (actual) {
    case 'borrador':
      return ['activo', 'cancelado'];
    case 'activo':
      return ['completado', 'borrador', 'cancelado'];
    case 'completado':
      return ['activo', 'borrador'];
    case 'cancelado':
      return ['activo', 'borrador'];
  }
}
