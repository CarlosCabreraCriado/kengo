import {
  daysBetweenYMD,
  diaSemanaFromYMD,
  getMadridDate,
  getMadridDiaSemana,
  offsetMadridDate,
  ymdMadridFromInstant,
  ymdToDateForDisplay,
} from './madrid-date.util';

describe('madrid-date.util', () => {
  describe('getMadridDate', () => {
    it('en CET (invierno, UTC+1) calcula el día Madrid correctamente', () => {
      // Lunes 22:30Z = Lunes 23:30 Madrid
      expect(getMadridDate(new Date('2026-01-12T22:30:00Z'))).toBe('2026-01-12');
      // Lunes 23:30Z = Martes 00:30 Madrid (cambio de día)
      expect(getMadridDate(new Date('2026-01-12T23:30:00Z'))).toBe('2026-01-13');
    });

    it('en CEST (verano, UTC+2) calcula el día Madrid correctamente', () => {
      // Lunes 21:30Z = Lunes 23:30 Madrid
      expect(getMadridDate(new Date('2026-07-13T21:30:00Z'))).toBe('2026-07-13');
      // Lunes 22:30Z = Martes 00:30 Madrid (cambio de día)
      expect(getMadridDate(new Date('2026-07-13T22:30:00Z'))).toBe('2026-07-14');
    });

    it('atraviesa el cambio CET → CEST sin saltos (último dom de marzo)', () => {
      // 2026-03-29 01:00Z = 02:00 CET (justo antes del salto a CEST)
      expect(getMadridDate(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29');
      // 2026-03-29 03:00Z = 05:00 CEST (después del salto)
      expect(getMadridDate(new Date('2026-03-29T03:00:00Z'))).toBe('2026-03-29');
    });

    it('atraviesa el cambio CEST → CET sin saltos (último dom de octubre)', () => {
      // 2026-10-25 00:30Z = 02:30 CEST (justo antes del retroceso)
      expect(getMadridDate(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25');
      // 2026-10-25 02:30Z = 03:30 CET (después)
      expect(getMadridDate(new Date('2026-10-25T02:30:00Z'))).toBe('2026-10-25');
    });

    it('escenario Canarias 23:30 viernes invierno reproduce el bug histórico', () => {
      // Viernes 23:30 Canarias (UTC+0) = Sábado 00:30 Madrid (UTC+1)
      // El cliente buggy enviaba "viernes" (UTC). Helper devuelve "sábado" (Madrid).
      const instante = new Date('2026-01-16T23:30:00Z');
      expect(getMadridDate(instante)).toBe('2026-01-17');
    });
  });

  describe('getMadridDiaSemana', () => {
    it('devuelve el día de semana en Madrid, no en UTC', () => {
      // Lunes 22:30Z = Lunes 23:30 Madrid → 'L'
      expect(getMadridDiaSemana(new Date('2026-01-12T22:30:00Z'))).toBe('L');
      // Lunes 23:30Z = Martes 00:30 Madrid → 'M'
      expect(getMadridDiaSemana(new Date('2026-01-12T23:30:00Z'))).toBe('M');
    });

    it('cubre toda la semana', () => {
      // 2026-01-12 mediodía = lunes Madrid
      expect(getMadridDiaSemana(new Date('2026-01-12T12:00:00Z'))).toBe('L');
      expect(getMadridDiaSemana(new Date('2026-01-13T12:00:00Z'))).toBe('M');
      expect(getMadridDiaSemana(new Date('2026-01-14T12:00:00Z'))).toBe('X');
      expect(getMadridDiaSemana(new Date('2026-01-15T12:00:00Z'))).toBe('J');
      expect(getMadridDiaSemana(new Date('2026-01-16T12:00:00Z'))).toBe('V');
      expect(getMadridDiaSemana(new Date('2026-01-17T12:00:00Z'))).toBe('S');
      expect(getMadridDiaSemana(new Date('2026-01-18T12:00:00Z'))).toBe('D');
    });
  });

  describe('diaSemanaFromYMD', () => {
    it('debe coincidir 1:1 con convex/_helpers/datetime.ts:getDiaSemana', () => {
      expect(diaSemanaFromYMD('2026-05-03')).toBe('D'); // domingo
      expect(diaSemanaFromYMD('2026-05-04')).toBe('L'); // lunes
      expect(diaSemanaFromYMD('2026-05-05')).toBe('M'); // martes
      expect(diaSemanaFromYMD('2026-05-06')).toBe('X'); // miércoles
      expect(diaSemanaFromYMD('2026-05-07')).toBe('J'); // jueves
      expect(diaSemanaFromYMD('2026-05-08')).toBe('V'); // viernes
      expect(diaSemanaFromYMD('2026-05-09')).toBe('S'); // sábado
    });

    it('es estable en los días de cambio horario', () => {
      expect(diaSemanaFromYMD('2026-03-29')).toBe('D'); // último dom marzo
      expect(diaSemanaFromYMD('2026-10-25')).toBe('D'); // último dom octubre
    });
  });

  describe('offsetMadridDate', () => {
    it('avanza días sin saltos al atravesar CET → CEST', () => {
      // 2026-03-22 + 7 días = 2026-03-29 (atraviesa cambio horario)
      expect(offsetMadridDate(7, new Date('2026-03-22T12:00:00Z'))).toBe(
        '2026-03-29',
      );
    });

    it('retrocede días correctamente', () => {
      expect(offsetMadridDate(-1, new Date('2026-05-03T12:00:00Z'))).toBe(
        '2026-05-02',
      );
      expect(offsetMadridDate(-7, new Date('2026-05-03T12:00:00Z'))).toBe(
        '2026-04-26',
      );
    });

    it('respeta el día Madrid en la franja crítica de medianoche', () => {
      // 2026-07-13 22:30Z = Martes 14 00:30 Madrid
      // offsetMadridDate(0) debe devolver "14", no "13"
      expect(offsetMadridDate(0, new Date('2026-07-13T22:30:00Z'))).toBe(
        '2026-07-14',
      );
      expect(offsetMadridDate(-1, new Date('2026-07-13T22:30:00Z'))).toBe(
        '2026-07-13',
      );
    });
  });

  describe('ymdToDateForDisplay', () => {
    it('construye un Date a 12:00 UTC para evitar saltos de DST', () => {
      const d = ymdToDateForDisplay('2026-05-03');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(4); // mayo (0-indexed)
      expect(d.getUTCDate()).toBe(3);
      expect(d.getUTCHours()).toBe(12);
    });

    it('en cambio CET → CEST mantiene el día estable', () => {
      const d = ymdToDateForDisplay('2026-03-29');
      expect(d.getUTCDate()).toBe(29);
      expect(d.getUTCMonth()).toBe(2); // marzo
    });
  });

  describe('daysBetweenYMD', () => {
    it('cuenta días enteros del calendario, no fracciones de 24h', () => {
      expect(daysBetweenYMD('2026-05-01', '2026-05-02')).toBe(1);
      expect(daysBetweenYMD('2026-05-01', '2026-05-08')).toBe(7);
      expect(daysBetweenYMD('2026-05-08', '2026-05-01')).toBe(-7);
      expect(daysBetweenYMD('2026-05-03', '2026-05-03')).toBe(0);
    });

    it('atraviesa CET → CEST sin perder días (29 marzo dura 23h)', () => {
      // Si usáramos div 86400000 sobre Dates locales, daría 0 (≈0.96).
      // El helper devuelve siempre el entero correcto.
      expect(daysBetweenYMD('2026-03-28', '2026-03-30')).toBe(2);
      expect(daysBetweenYMD('2026-03-29', '2026-03-30')).toBe(1);
    });

    it('atraviesa CEST → CET sin sumar días (25 octubre dura 25h)', () => {
      expect(daysBetweenYMD('2026-10-24', '2026-10-26')).toBe(2);
      expect(daysBetweenYMD('2026-10-25', '2026-10-26')).toBe(1);
    });

    it('cubre cambios de mes y de año', () => {
      expect(daysBetweenYMD('2026-01-31', '2026-02-01')).toBe(1);
      expect(daysBetweenYMD('2025-12-31', '2026-01-01')).toBe(1);
      expect(daysBetweenYMD('2025-01-01', '2026-01-01')).toBe(365);
    });
  });

  describe('ymdMadridFromInstant', () => {
    it('extrae el día Madrid de un ISO UTC en CET (UTC+1)', () => {
      // 22:30Z = 23:30 Madrid (CET) → mismo día
      expect(ymdMadridFromInstant('2026-01-12T22:30:00.000Z')).toBe(
        '2026-01-12',
      );
      // 23:30Z = 00:30 Madrid (CET) → día siguiente
      expect(ymdMadridFromInstant('2026-01-12T23:30:00.000Z')).toBe(
        '2026-01-13',
      );
    });

    it('extrae el día Madrid de un ISO UTC en CEST (UTC+2)', () => {
      // 21:30Z = 23:30 Madrid (CEST) → mismo día
      expect(ymdMadridFromInstant('2026-07-13T21:30:00.000Z')).toBe(
        '2026-07-13',
      );
      // 22:30Z = 00:30 Madrid (CEST) → día siguiente
      expect(ymdMadridFromInstant('2026-07-13T22:30:00.000Z')).toBe(
        '2026-07-14',
      );
    });

    it('reproduce el bug original: viernes 23:30 Canarias guardado como Sábado Madrid', () => {
      // Frontend buggy guardaba toISOString() en Canarias 23:30 (UTC+0
      // invierno) = "23:30Z" del viernes. En Madrid (CET, UTC+1) es ya
      // 00:30 del sábado.
      expect(ymdMadridFromInstant('2026-01-16T23:30:00.000Z')).toBe(
        '2026-01-17',
      );
    });
  });
});
