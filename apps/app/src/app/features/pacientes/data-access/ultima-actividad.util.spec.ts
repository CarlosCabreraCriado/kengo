import {
  formatFechaCortaYmd,
  ultimaActividadLabel,
} from './ultima-actividad.util';

describe('ultima-actividad.util', () => {
  it('formatFechaCortaYmd no desplaza el día por la TZ del dispositivo', () => {
    // 2026-08-15 es una fecha civil: debe salir "15 ago" en cualquier TZ.
    expect(formatFechaCortaYmd('2026-08-15')).toMatch(/^15 ago/);
  });

  it('ultimaActividadLabel devuelve null sin última actividad', () => {
    expect(ultimaActividadLabel(null)).toBeNull();
  });

  it('ultimaActividadLabel formatea "hace N días"', () => {
    const label = ultimaActividadLabel({ fecha: '2026-08-15', diasDesde: 23 });
    expect(label).toContain('15 ago');
    expect(label).toContain('hace 23 días');
  });

  it('ultimaActividadLabel usa "hoy" y "ayer" en los casos límite', () => {
    expect(ultimaActividadLabel({ fecha: '2026-09-07', diasDesde: 0 })).toContain('(hoy)');
    expect(ultimaActividadLabel({ fecha: '2026-09-06', diasDesde: 1 })).toContain('(ayer)');
  });
});
