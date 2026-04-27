/** Variante de formato de fecha disponible en el helper compartido. */
export type FormatDateVariant = 'long' | 'short';

/**
 * Formatea una fecha ISO (yyyy-mm-dd) en español.
 *
 * - `'long'` (por defecto): "Hoy" / "Sáb 27 abril (Ayer)" / "Mar 4 mayo 2027".
 * - `'short'`: "27 abr".
 */
export function formatDate(
  iso: string,
  variant: FormatDateVariant = 'long',
): string {
  const d = new Date(iso);

  if (variant === 'short') {
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    return `${day} ${month}`;
  }

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
