import { TipoCumplimiento } from '../../../../types/global';

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

/** Formatea una fecha ISO (yyyy-mm-dd) en label largo en español:
 *  "Hoy" / "Sáb 27 abril (Ayer)" / "Mar 4 mayo 2027". */
export function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const esAyer = d.toDateString() === ayer.toDateString();

  const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'long' });
  const year =
    d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : '';
  const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}${year}`;
  return esAyer ? `${label} (Ayer)` : label;
}

/** Formato corto en español: "27 abr". */
export function formatearFechaComentario(fecha: string): string {
  const d = new Date(fecha);
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' });
  return `${day} ${month}`;
}
