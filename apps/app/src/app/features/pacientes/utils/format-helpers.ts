import { TipoCumplimiento } from '../../../../types/global';
import { formatDate } from '../../../shared/utils/format-date';
import { ymdMadridFromInstant } from '../../../shared/utils/madrid-date.util';

/** Color tailwind para una escala de dolor 0-10. */
export function getDolorColor(dolor: number | null): string {
  if (dolor === null) return 'text-zinc-400';
  if (dolor <= 3) return 'text-green-600';
  if (dolor <= 6) return 'text-yellow-600';
  return 'text-red-600';
}

/** Icono Material para el tipo de cumplimiento de una sesión. */
export function getTipoIcon(tipo: TipoCumplimiento): string {
  const icons: Record<TipoCumplimiento, string> = {
    completado: 'check_circle',
    parcial: 'warning',
    fallido: 'cancel',
    descanso: 'bedtime',
  };
  return icons[tipo];
}

/** Color tailwind para el tipo de cumplimiento. */
export function getTipoColor(tipo: TipoCumplimiento): string {
  const colors: Record<TipoCumplimiento, string> = {
    completado: 'text-success',
    parcial: 'text-amber',
    fallido: 'text-danger',
    descanso: 'text-zinc-400',
  };
  return colors[tipo];
}

/** Clase CSS de status para un plan según ratio de completados/esperados. */
export function getPlanStatusClass(plan: {
  esperados: number;
  completados: number;
}): string {
  if (plan.completados >= plan.esperados) return 'status-completado';
  if (plan.completados > 0) return 'status-parcial';
  return 'status-fallido';
}

/** Formatea una fecha ISO en label largo en español. Alias de `formatDate(fecha)`. */
export function formatearFecha(fecha: string): string {
  return formatDate(fecha, 'long');
}

/**
 * Formato corto en español ("27 abr") de un instante ISO 8601 (con `Z`),
 * interpretándolo como día calendario en Europe/Madrid.
 */
export function formatearFechaComentario(fechaIso: string): string {
  return formatDate(ymdMadridFromInstant(fechaIso), 'short');
}
