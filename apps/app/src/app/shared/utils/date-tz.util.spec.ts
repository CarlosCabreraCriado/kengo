import {
  addDaysYmd,
  daysBetweenYMD,
  diaSemanaFromYMD,
  getDeviceTz,
  getDiaSemanaHoy,
  getTodayYmd,
  offsetTodayYmd,
  patientTzOf,
  ymdFromInstant,
  ymdToDateForDisplay,
} from './date-tz.util';

describe('date-tz.util', () => {
  describe('getTodayYmd', () => {
    it('escenario Canarias 23:30: el día del paciente sigue siendo el MISMO', () => {
      // Viernes 23:30 en Canarias (UTC+0 invierno) = sábado 00:30 Madrid.
      // Este era EL bug: con Madrid hardcodeado el sistema devolvía sábado y
      // el paciente canario perdía sus ejercicios del viernes.
      const instante = new Date('2026-01-16T23:30:00Z');
      expect(getTodayYmd('Atlantic/Canary', instante)).toBe('2026-01-16');
      expect(getTodayYmd('Europe/Madrid', instante)).toBe('2026-01-17');
    });

    it('escenario Canarias en verano (UTC+1) misma ventana crítica', () => {
      // 23:30 Canarias en julio = 22:30Z = 00:30 Madrid del día siguiente.
      const instante = new Date('2026-07-10T22:30:00Z');
      expect(getTodayYmd('Atlantic/Canary', instante)).toBe('2026-07-10');
      expect(getTodayYmd('Europe/Madrid', instante)).toBe('2026-07-11');
    });

    it('en CET (invierno, UTC+1) calcula el día Madrid correctamente', () => {
      expect(getTodayYmd('Europe/Madrid', new Date('2026-01-12T22:30:00Z'))).toBe(
        '2026-01-12',
      );
      expect(getTodayYmd('Europe/Madrid', new Date('2026-01-12T23:30:00Z'))).toBe(
        '2026-01-13',
      );
    });

    it('atraviesa los cambios CET↔CEST sin saltos', () => {
      expect(getTodayYmd('Europe/Madrid', new Date('2026-03-29T01:00:00Z'))).toBe(
        '2026-03-29',
      );
      expect(getTodayYmd('Europe/Madrid', new Date('2026-03-29T03:00:00Z'))).toBe(
        '2026-03-29',
      );
      expect(getTodayYmd('Europe/Madrid', new Date('2026-10-25T00:30:00Z'))).toBe(
        '2026-10-25',
      );
      expect(getTodayYmd('Europe/Madrid', new Date('2026-10-25T02:30:00Z'))).toBe(
        '2026-10-25',
      );
    });

    it('TZs extremas: LA y Kiritimati', () => {
      const instante = new Date('2026-01-16T23:30:00Z');
      expect(getTodayYmd('America/Los_Angeles', instante)).toBe('2026-01-16');
      expect(getTodayYmd('Pacific/Kiritimati', instante)).toBe('2026-01-17');
    });
  });

  describe('getDiaSemanaHoy', () => {
    it('devuelve el día de semana en la TZ pedida', () => {
      // Viernes 23:30 Canarias: sigue siendo viernes para el canario,
      // sábado para Madrid.
      const instante = new Date('2026-01-16T23:30:00Z');
      expect(getDiaSemanaHoy('Atlantic/Canary', instante)).toBe('V');
      expect(getDiaSemanaHoy('Europe/Madrid', instante)).toBe('S');
    });

    it('cubre toda la semana en Madrid', () => {
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-12T12:00:00Z'))).toBe('L');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-13T12:00:00Z'))).toBe('M');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-14T12:00:00Z'))).toBe('X');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-15T12:00:00Z'))).toBe('J');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-16T12:00:00Z'))).toBe('V');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-17T12:00:00Z'))).toBe('S');
      expect(getDiaSemanaHoy('Europe/Madrid', new Date('2026-01-18T12:00:00Z'))).toBe('D');
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
      expect(diaSemanaFromYMD('2026-03-29')).toBe('D');
      expect(diaSemanaFromYMD('2026-10-25')).toBe('D');
    });
  });

  describe('offsetTodayYmd', () => {
    it('avanza y retrocede días en la TZ pedida', () => {
      const base = new Date('2026-05-03T12:00:00Z');
      expect(offsetTodayYmd('Europe/Madrid', -1, base)).toBe('2026-05-02');
      expect(offsetTodayYmd('Europe/Madrid', -7, base)).toBe('2026-04-26');
      expect(offsetTodayYmd('Europe/Madrid', 7, new Date('2026-03-22T12:00:00Z'))).toBe(
        '2026-03-29',
      );
    });

    it('respeta el día de la TZ en la franja crítica de medianoche', () => {
      // 2026-07-13 22:30Z = martes 14, 00:30 Madrid / lunes 13, 23:30 Canarias.
      const instante = new Date('2026-07-13T22:30:00Z');
      expect(offsetTodayYmd('Europe/Madrid', 0, instante)).toBe('2026-07-14');
      expect(offsetTodayYmd('Atlantic/Canary', 0, instante)).toBe('2026-07-13');
      expect(offsetTodayYmd('Atlantic/Canary', -1, instante)).toBe('2026-07-12');
    });
  });

  describe('addDaysYmd', () => {
    it('aritmética pura de calendario, robusta ante DST y fin de mes/año', () => {
      expect(addDaysYmd('2026-03-28', 2)).toBe('2026-03-30');
      expect(addDaysYmd('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDaysYmd('2026-01-01', -1)).toBe('2025-12-31');
    });
  });

  describe('ymdToDateForDisplay', () => {
    it('construye un Date a 12:00 UTC para evitar saltos de DST', () => {
      const d = ymdToDateForDisplay('2026-05-03');
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(4);
      expect(d.getUTCDate()).toBe(3);
      expect(d.getUTCHours()).toBe(12);
    });

    it('en cambio CET → CEST mantiene el día estable', () => {
      const d = ymdToDateForDisplay('2026-03-29');
      expect(d.getUTCDate()).toBe(29);
      expect(d.getUTCMonth()).toBe(2);
    });
  });

  describe('daysBetweenYMD', () => {
    it('cuenta días enteros del calendario, no fracciones de 24h', () => {
      expect(daysBetweenYMD('2026-05-01', '2026-05-02')).toBe(1);
      expect(daysBetweenYMD('2026-05-01', '2026-05-08')).toBe(7);
      expect(daysBetweenYMD('2026-05-08', '2026-05-01')).toBe(-7);
      expect(daysBetweenYMD('2026-05-03', '2026-05-03')).toBe(0);
    });

    it('atraviesa cambios de hora sin perder ni sumar días', () => {
      expect(daysBetweenYMD('2026-03-28', '2026-03-30')).toBe(2);
      expect(daysBetweenYMD('2026-03-29', '2026-03-30')).toBe(1);
      expect(daysBetweenYMD('2026-10-24', '2026-10-26')).toBe(2);
      expect(daysBetweenYMD('2026-10-25', '2026-10-26')).toBe(1);
    });

    it('cubre cambios de mes y de año', () => {
      expect(daysBetweenYMD('2026-01-31', '2026-02-01')).toBe(1);
      expect(daysBetweenYMD('2025-12-31', '2026-01-01')).toBe(1);
      expect(daysBetweenYMD('2025-01-01', '2026-01-01')).toBe(365);
    });
  });

  describe('ymdFromInstant', () => {
    it('extrae el día de un ISO UTC en la TZ pedida', () => {
      expect(ymdFromInstant('2026-01-12T22:30:00.000Z', 'Europe/Madrid')).toBe(
        '2026-01-12',
      );
      expect(ymdFromInstant('2026-01-12T23:30:00.000Z', 'Europe/Madrid')).toBe(
        '2026-01-13',
      );
    });

    it('la execution de las 23:30 canarias pertenece al día canario, no al de Madrid', () => {
      const iso = '2026-01-16T23:30:00.000Z';
      expect(ymdFromInstant(iso, 'Atlantic/Canary')).toBe('2026-01-16');
      expect(ymdFromInstant(iso, 'Europe/Madrid')).toBe('2026-01-17');
    });
  });

  describe('getDeviceTz', () => {
    it('devuelve una TZ IANA válida y utilizable por Intl', () => {
      const tz = getDeviceTz();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
      expect(() => new Intl.DateTimeFormat('en-CA', { timeZone: tz })).not.toThrow();
    });
  });

  describe('patientTzOf', () => {
    it('usa la TZ del paciente cuando es válida', () => {
      expect(patientTzOf({ timezone: 'Atlantic/Canary' })).toBe('Atlantic/Canary');
    });

    it('cae a Europe/Madrid ante ausencia o basura', () => {
      expect(patientTzOf(null)).toBe('Europe/Madrid');
      expect(patientTzOf({})).toBe('Europe/Madrid');
      expect(patientTzOf({ timezone: null })).toBe('Europe/Madrid');
      expect(patientTzOf({ timezone: 'Not/AZone' })).toBe('Europe/Madrid');
      expect(patientTzOf({ timezone: '<script>' })).toBe('Europe/Madrid');
    });
  });
});
