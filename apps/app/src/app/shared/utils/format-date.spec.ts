import { formatDate } from './format-date';
import { getMadridDate, offsetMadridDate } from './madrid-date.util';

describe('formatDate', () => {
  describe('variante "short"', () => {
    it('devuelve "{día} {mes-corto-es}" sin year', () => {
      expect(formatDate('2026-04-27', 'short')).toBe('27 abr');
      expect(formatDate('2026-01-03', 'short')).toBe('3 ene');
      expect(formatDate('2026-12-31', 'short')).toBe('31 dic');
    });

    it('es estable en el cambio CET → CEST (29 marzo)', () => {
      expect(formatDate('2026-03-29', 'short')).toBe('29 mar');
    });

    it('es estable en el cambio CEST → CET (25 octubre)', () => {
      expect(formatDate('2026-10-25', 'short')).toBe('25 oct');
    });
  });

  describe('variante "long"', () => {
    it('devuelve "Hoy" para la fecha de hoy en Madrid', () => {
      const hoyYMD = getMadridDate();
      expect(formatDate(hoyYMD, 'long')).toBe('Hoy');
      // Por defecto sin variant también es long.
      expect(formatDate(hoyYMD)).toBe('Hoy');
    });

    it('devuelve "{label} (Ayer)" para la fecha de ayer en Madrid', () => {
      const ayerYMD = offsetMadridDate(-1);
      const label = formatDate(ayerYMD, 'long');
      expect(label).toMatch(/\(Ayer\)$/);
    });

    it('devuelve "{Weekday} {dia} {mes}" sin sufijo para fechas del año actual', () => {
      const hoyYMD = getMadridDate();
      const year = Number(hoyYMD.slice(0, 4));
      // Tomamos una fecha lejana del mismo año, pero distinta de hoy/ayer.
      const fechaMismoAno = `${year}-03-15`;
      // Si por casualidad coincide con hoy o ayer, saltamos.
      if (
        fechaMismoAno !== hoyYMD &&
        fechaMismoAno !== offsetMadridDate(-1)
      ) {
        const label = formatDate(fechaMismoAno, 'long');
        expect(label).not.toMatch(/\(Ayer\)$/);
        expect(label).not.toBe('Hoy');
        // No debe contener el año (formato sin year cuando coincide con hoy).
        expect(label).not.toMatch(new RegExp(`\\s${year}$`));
      }
    });

    it('añade sufijo de año cuando la fecha es de un año distinto', () => {
      const hoyYMD = getMadridDate();
      const yearActual = Number(hoyYMD.slice(0, 4));
      const otroYear = yearActual === 2026 ? '2030' : '2026';
      const fechaOtroAno = `${otroYear}-05-04`;
      const label = formatDate(fechaOtroAno, 'long');
      expect(label).toMatch(new RegExp(`\\s${otroYear}$`));
    });
  });

  describe('robustez frente a husos del navegador', () => {
    // formatDate ahora interpreta YYYY-MM-DD como Madrid, no como local.
    // El día/mes que devuelve siempre coincide con el calendario Madrid,
    // independientemente de la zona del navegador.
    it('un YYYY-MM-DD concreto siempre formatea con el día correcto', () => {
      // 27 abril es siempre 27 abril en Madrid, independientemente de la
      // zona del navegador del test runner.
      expect(formatDate('2026-04-27', 'short')).toBe('27 abr');
    });
  });
});
