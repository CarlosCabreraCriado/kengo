import { normalizeAppUrlPath } from './deep-link.util';

describe('deep-link.util', () => {
  describe('normalizeAppUrlPath', () => {
    it('recompone el host en esquemas custom con path (kengo://billing/return)', () => {
      // Regresión del bug: `pathname` era solo `/return`, así que
      // `startsWith('/billing/return')` fallaba y el retorno de pago se colgaba.
      expect(
        normalizeAppUrlPath('kengo://billing/return?status=success'),
      ).toBe('/billing/return?status=success');
    });

    it('recompone el host en esquemas custom sin path (kengo://magic)', () => {
      expect(normalizeAppUrlPath('kengo://magic?t=abc123')).toBe(
        '/magic?t=abc123',
      );
    });

    it('preserva la ruta de universal links (https://kengoapp.com/...)', () => {
      expect(
        normalizeAppUrlPath('https://kengoapp.com/billing/return?status=cancel'),
      ).toBe('/billing/return?status=cancel');
      expect(normalizeAppUrlPath('https://kengoapp.com/magic?t=abc123')).toBe(
        '/magic?t=abc123',
      );
    });

    it('conserva el hash cuando existe', () => {
      expect(normalizeAppUrlPath('kengo://billing/return#seccion')).toBe(
        '/billing/return#seccion',
      );
    });

    it('normaliza la raíz del esquema custom', () => {
      // `kengo://magic` sin query → `/magic`; sirve de guardia para el
      // `if (!path || path === '/')` del listener.
      expect(normalizeAppUrlPath('kengo://magic')).toBe('/magic');
    });
  });
});
