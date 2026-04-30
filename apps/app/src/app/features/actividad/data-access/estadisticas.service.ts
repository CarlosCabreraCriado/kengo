import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';

export type PeriodoEstadisticas = 'semana' | 'mes' | 'plan';

export interface DiaActividadVm {
  label: string;
  value: number; // 0..1
  today?: boolean;
}

export interface PuntoDolorVm {
  d: string;
  v: number; // 0..10
}

export interface SesionHistoricaVm {
  day: string;
  plan: string;
  pct: number;
  time: string;
  pain: number | null;
  rest?: boolean;
}

interface DailyRollup {
  fecha: string;
  totalEsperados: number;
  totalCompletados: number;
  dolorPromedio?: number;
  estadoDia:
    | 'completado'
    | 'parcial'
    | 'fallido'
    | 'descanso'
    | 'sin_plan';
}

interface WeeklyRollup {
  anioSemana: string;
  adherencia: number;
  rachaMaxima: number;
  dolorMedio?: number;
}

interface MonthlyRollup {
  anioMes: string;
  adherencia: number;
  tendenciaAdherencia?: number;
  dolorMedio?: number;
}

interface SesionReciente {
  fecha: string;
  fechaInicio?: string;
  totalEsperados?: number;
  totalCompletados?: number;
  duracionTotalSeg?: number;
  dolorPromedio?: number;
  esSintetica?: boolean;
  planTitulo: string | null;
}

interface PlanActivo {
  _id: string;
  titulo: string;
  fechaInicio?: string;
}

const DIAS_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const MESES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  readonly cargando = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly periodo = signal<PeriodoEstadisticas>('semana');

  private datosCargados = signal<boolean>(false);
  private dailyHistorico = signal<DailyRollup[]>([]);
  private weeklyHistorico = signal<WeeklyRollup[]>([]);
  private monthlyHistorico = signal<MonthlyRollup[]>([]);
  private planActivo = signal<PlanActivo | null>(null);
  private historialRaw = signal<SesionReciente[]>([]);

  readonly hayDatos = computed(
    () =>
      this.dailyHistorico().length > 0 ||
      this.weeklyHistorico().length > 0 ||
      this.historialRaw().length > 0,
  );

  readonly actividadSerie = computed<DiaActividadVm[]>(() => {
    const daily = this.dailyHistorico();
    const ult10 = ultimosNDias(10);
    const mapaPorFecha = new Map(daily.map((d) => [d.fecha, d]));
    const hoyStr = toIsoDate(new Date());

    return ult10.map((fecha) => {
      const r = mapaPorFecha.get(fecha);
      const value = computeBarValue(r);
      return {
        label: dayLabel(fecha),
        value,
        today: fecha === hoyStr,
      };
    });
  });

  readonly dolorSerie = computed<PuntoDolorVm[]>(() => {
    const periodo = this.periodo();
    if (periodo === 'semana') return this.dolorSerieSemana();
    if (periodo === 'mes') return this.dolorSerieMes();
    return this.dolorSeriePlan();
  });

  readonly dolorInicial = computed<number | null>(() => {
    const serie = this.dolorSerie();
    return serie.length > 0 ? serie[0]!.v : null;
  });

  readonly dolorActual = computed<number | null>(() => {
    const serie = this.dolorSerie();
    return serie.length > 0 ? serie[serie.length - 1]!.v : null;
  });

  readonly adherencia = computed<number | null>(() => {
    const periodo = this.periodo();
    if (periodo === 'semana') {
      const w = this.weeklyActual();
      return w ? Math.round(w.adherencia) : null;
    }
    if (periodo === 'mes') {
      const m = this.monthlyActual();
      return m ? Math.round(m.adherencia) : null;
    }
    const weeklies = this.weeklyHistorico();
    if (weeklies.length === 0) return null;
    const sum = weeklies.reduce((a, b) => a + b.adherencia, 0);
    return Math.round(sum / weeklies.length);
  });

  readonly adherenciaDelta = computed<{ valor: number; texto: string } | null>(
    () => {
      const periodo = this.periodo();
      if (periodo === 'plan') return null;
      if (periodo === 'semana') {
        const actual = this.weeklyActual();
        const previa = this.weeklyAnterior();
        if (!actual || !previa) return null;
        const delta = Math.round(actual.adherencia - previa.adherencia);
        return {
          valor: delta,
          texto: `${formatDelta(delta)}% vs sem pasada`,
        };
      }
      const m = this.monthlyActual();
      if (!m || m.tendenciaAdherencia == null) return null;
      const delta = Math.round(m.tendenciaAdherencia);
      return { valor: delta, texto: `${formatDelta(delta)}% vs mes pasado` };
    },
  );

  readonly rachaActual = computed<number>(() => {
    const daily = this.dailyHistorico();
    if (daily.length === 0) return 0;
    const sorted = [...daily].sort((a, b) => b.fecha.localeCompare(a.fecha));
    let racha = 0;
    for (const dia of sorted) {
      if (dia.estadoDia === 'descanso' || dia.estadoDia === 'sin_plan') {
        continue;
      }
      if (dia.estadoDia === 'completado') {
        racha++;
      } else {
        break;
      }
    }
    return racha;
  });

  readonly mejorRachaHistorica = computed<number>(() => {
    const weeklies = this.weeklyHistorico();
    if (weeklies.length === 0) return 0;
    return Math.max(...weeklies.map((w) => w.rachaMaxima));
  });

  readonly historialReciente = computed<SesionHistoricaVm[]>(() => {
    return this.historialRaw().map((s) => buildSesionVm(s));
  });

  readonly subtituloHero = computed<string>(() => {
    const plan = this.planActivo();
    if (!plan) return 'Tu progreso de las últimas semanas.';

    const semanas = plan.fechaInicio
      ? Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(plan.fechaInicio).getTime()) /
              (1000 * 60 * 60 * 24 * 7),
          ),
        )
      : null;

    const inicial = this.dolorPlanInicial();
    const actual = this.dolorPlanActual();
    const mejoraDolor = inicial != null && actual != null && inicial - actual >= 1;

    const planNombre = plan.titulo;
    const sufijoSemanas = semanas
      ? `Llevas ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} con tu plan de ${planNombre}.`
      : `Estás con tu plan de ${planNombre}.`;

    if (mejoraDolor) {
      return `${sufijoSemanas} El dolor ha bajado de ${inicial} a ${actual}.`;
    }
    return `${sufijoSemanas} ¡Sigue así!`;
  });

  readonly periodoLabel = computed(() => {
    switch (this.periodo()) {
      case 'semana':
        return 'Esta semana';
      case 'mes':
        return 'Este mes';
      case 'plan':
        return 'Plan completo';
    }
  });

  resumenCompartible(): string {
    const lineas: string[] = [];
    lineas.push(`Mi progreso en Kengo (${this.periodoLabel().toLowerCase()}):`);
    const ad = this.adherencia();
    if (ad != null) lineas.push(`• Adherencia: ${ad}%`);
    const racha = this.rachaActual();
    const mejor = this.mejorRachaHistorica();
    if (racha > 0 || mejor > 0) {
      lineas.push(`• Racha actual: ${racha} días${mejor > 0 ? ` (mejor: ${mejor})` : ''}`);
    }
    const dolorAct = this.dolorActual();
    if (dolorAct != null) lineas.push(`• Dolor medio: ${dolorAct}/10`);
    const plan = this.planActivo();
    if (plan) lineas.push(`• Plan: ${plan.titulo}`);
    return lineas.join('\n');
  }

  setPeriodo(id: string): void {
    if (id === 'semana' || id === 'mes' || id === 'plan') {
      this.periodo.set(id);
    }
  }

  cargarSiNecesario(): void {
    if (this.datosCargados() || this.cargando()) return;
    const usuario = this.sessionService.usuario();
    if (!usuario?.id) return;
    void this.cargar();
  }

  recargar(): void {
    this.datosCargados.set(false);
    this.cargarSiNecesario();
  }

  constructor() {
    effect(() => {
      const usuario = this.sessionService.usuario();
      const enModoPaciente = this.sessionService.enModoPaciente();
      if (
        usuario?.id &&
        enModoPaciente &&
        !this.datosCargados() &&
        !this.cargando()
      ) {
        void this.cargar();
      }
    });
  }

  private async cargar(): Promise<void> {
    if (this.cargando()) return;

    const convexId = this.resolveUserConvexId();
    if (!convexId) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const hoy = new Date();
      const desde30 = new Date(hoy);
      desde30.setDate(hoy.getDate() - 29);
      const desdeAnioSemana = '2020-W01';
      const hastaAnioSemana = formatISOWeek(hoy);
      const desdeAnioMes = '2020-01';
      const hastaAnioMes = formatYearMonth(hoy);

      const [daily, weekly, monthly, planes, historial] = await Promise.all([
        this.convex.query(api.rollups.queries.getDailyByPaciente, {
          pacienteId: convexId,
          desde: toIsoDate(desde30),
          hasta: toIsoDate(hoy),
        }),
        this.convex.query(api.rollups.queries.getWeeklyByPaciente, {
          pacienteId: convexId,
          desdeAnioSemana,
          hastaAnioSemana,
        }),
        this.convex.query(api.rollups.queries.getMonthlyByPaciente, {
          pacienteId: convexId,
          desdeAnioMes,
          hastaAnioMes,
        }),
        this.convex.query(api.plans.queries.getActiveForPatientToday, {
          pacienteId: convexId,
        }),
        this.convex.query(api.sessions.queries.listRecentByPaciente, {
          pacienteId: convexId,
          limit: 5,
        }),
      ]);

      this.dailyHistorico.set(daily as DailyRollup[]);
      this.weeklyHistorico.set(
        ([...weekly] as WeeklyRollup[]).sort((a, b) =>
          a.anioSemana.localeCompare(b.anioSemana),
        ),
      );
      this.monthlyHistorico.set(
        ([...monthly] as MonthlyRollup[]).sort((a, b) =>
          a.anioMes.localeCompare(b.anioMes),
        ),
      );
      const planMasAntiguo = elegirPlanActivo(planes as PlanActivo[]);
      this.planActivo.set(planMasAntiguo);
      this.historialRaw.set(historial as SesionReciente[]);
      this.datosCargados.set(true);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      this.error.set('No se pudieron cargar las estadísticas.');
    } finally {
      this.cargando.set(false);
    }
  }

  private weeklyActual(): WeeklyRollup | null {
    const semanaHoy = formatISOWeek(new Date());
    return this.weeklyHistorico().find((w) => w.anioSemana === semanaHoy) ?? null;
  }

  private weeklyAnterior(): WeeklyRollup | null {
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const semanaPrevia = formatISOWeek(haceUnaSemana);
    return (
      this.weeklyHistorico().find((w) => w.anioSemana === semanaPrevia) ?? null
    );
  }

  private monthlyActual(): MonthlyRollup | null {
    const mesHoy = formatYearMonth(new Date());
    return this.monthlyHistorico().find((m) => m.anioMes === mesHoy) ?? null;
  }

  private dolorSerieSemana(): PuntoDolorVm[] {
    const ult7 = ultimosNDias(7);
    const mapa = new Map(this.dailyHistorico().map((d) => [d.fecha, d]));
    return ult7
      .map((fecha) => {
        const r = mapa.get(fecha);
        if (!r || r.dolorPromedio == null) return null;
        return {
          d: dayLetterFor(fecha),
          v: Math.round(r.dolorPromedio * 10) / 10,
        } as PuntoDolorVm;
      })
      .filter((p): p is PuntoDolorVm => p != null);
  }

  private dolorSerieMes(): PuntoDolorVm[] {
    const ordenadas = [...this.weeklyHistorico()].sort((a, b) =>
      a.anioSemana.localeCompare(b.anioSemana),
    );
    return ordenadas
      .slice(-4)
      .filter((w) => w.dolorMedio != null)
      .map((w) => ({
        d: w.anioSemana.slice(-2),
        v: Math.round(w.dolorMedio! * 10) / 10,
      }));
  }

  private dolorSeriePlan(): PuntoDolorVm[] {
    const ordenadas = [...this.monthlyHistorico()].sort((a, b) =>
      a.anioMes.localeCompare(b.anioMes),
    );
    return ordenadas
      .filter((m) => m.dolorMedio != null)
      .map((m) => ({
        d: MESES_CORTO[parseInt(m.anioMes.slice(-2), 10) - 1] ?? m.anioMes.slice(-2),
        v: Math.round(m.dolorMedio! * 10) / 10,
      }));
  }

  private dolorPlanInicial(): number | null {
    const plan = this.planActivo();
    if (!plan?.fechaInicio) return null;
    const candidatas = this.dailyHistorico()
      .filter((d) => d.fecha >= plan.fechaInicio! && d.dolorPromedio != null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (candidatas.length === 0) return null;
    return Math.round(candidatas[0]!.dolorPromedio!);
  }

  private dolorPlanActual(): number | null {
    const plan = this.planActivo();
    if (!plan?.fechaInicio) return null;
    const candidatas = this.dailyHistorico()
      .filter((d) => d.fecha >= plan.fechaInicio! && d.dolorPromedio != null)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (candidatas.length === 0) return null;
    return Math.round(candidatas[0]!.dolorPromedio!);
  }

  private resolveUserConvexId(): string | undefined {
    const u = this.sessionService.usuario();
    return u?.convexId ?? undefined;
  }
}

// ============================================================
// Helpers (puros)
// ============================================================

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ultimosNDias(n: number): string[] {
  const hoy = new Date();
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    result.push(toIsoDate(d));
  }
  return result;
}

function dayLetterFor(fecha: string): string {
  const d = new Date(fecha);
  const dow = d.getDay(); // 0=Dom..6=Sab
  const idx = dow === 0 ? 6 : dow - 1;
  return DIAS_LETRA[idx]!;
}

function dayLabel(fecha: string): string {
  const d = new Date(fecha);
  return `${dayLetterFor(fecha)} ${d.getDate()}`;
}

function computeBarValue(r: DailyRollup | undefined): number {
  if (!r) return 0;
  if (r.estadoDia === 'descanso' || r.estadoDia === 'sin_plan') return 0;
  if (r.totalEsperados <= 0) return 0;
  return Math.min(1, r.totalCompletados / r.totalEsperados);
}

function formatISOWeek(d: Date): string {
  // ISO 8601 week date — algoritmo estándar
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = Math.round(
    1 +
      (target.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDelta(n: number): string {
  if (n > 0) return `↑ +${n}`;
  if (n < 0) return `↓ ${n}`;
  return `→ ${n}`;
}

function elegirPlanActivo(planes: PlanActivo[]): PlanActivo | null {
  if (planes.length === 0) return null;
  const conFecha = planes.filter((p) => !!p.fechaInicio);
  if (conFecha.length > 0) {
    return conFecha
      .slice()
      .sort((a, b) => a.fechaInicio!.localeCompare(b.fechaInicio!))[0]!;
  }
  return planes[0]!;
}

function buildSesionVm(s: SesionReciente): SesionHistoricaVm {
  const esperados = s.totalEsperados ?? 0;
  const completados = s.totalCompletados ?? 0;
  const esDescanso = esperados === 0 || s.esSintetica === true;
  const pct = esperados > 0 ? Math.round((completados / esperados) * 100) : 0;
  const minutos = s.duracionTotalSeg
    ? Math.round(s.duracionTotalSeg / 60)
    : 0;
  return {
    day: formatHistoryDay(s.fecha),
    plan: esDescanso ? 'Descanso' : s.planTitulo ?? 'Sesión',
    pct,
    time: minutos > 0 ? `${minutos} min` : '—',
    pain: s.dolorPromedio != null ? Math.round(s.dolorPromedio) : null,
    rest: esDescanso || undefined,
  };
}

function formatHistoryDay(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dayLetter = dayLetterFor(fecha);
  const dia = d.getDate();
  const mes = MESES_CORTO[d.getMonth()] ?? '';

  if (sameDay(d, hoy)) return `Hoy · ${dayLetter} ${dia} ${mes}`;
  if (sameDay(d, ayer)) return `Ayer · ${dayLetter} ${dia} ${mes}`;
  return `${dayLetter} ${dia} ${mes}`;
}
