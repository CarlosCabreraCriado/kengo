import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  Ui2AchievementCardComponent,
  Ui2BigTitleComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2HorizontalScrollerComponent,
  Ui2IconBadgeComponent,
  Ui2KpiCardComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2StatusDotComponent,
  Ui2SegmentedOption,
} from '../../../../shared/ui-v2';

interface DiaActividad {
  label: string;
  value: number; // 0..1
  today?: boolean;
}

interface PuntoDolor {
  d: string; // L, M, X, J...
  v: number; // 0..10
}

interface Logro {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  earned: boolean;
}

interface SesionHistorica {
  day: string;
  plan: string;
  pct: number;
  time: string;
  pain: number | null;
  rest?: boolean;
}

interface PuntoDolorPlot extends PuntoDolor {
  x: number;
  y: number;
}

const PERIODO_OPTIONS: Ui2SegmentedOption[] = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'plan', label: 'Plan completo' },
];

@Component({
  selector: 'app-actividad-estadisticas',
  standalone: true,
  imports: [
    Ui2AchievementCardComponent,
    Ui2BigTitleComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2HorizontalScrollerComponent,
    Ui2IconBadgeComponent,
    Ui2KpiCardComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2StatusDotComponent,
  ],
  templateUrl: './actividad-estadisticas.component.html',
  styleUrl: './actividad-estadisticas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActividadEstadisticasComponent {
  readonly periodoOptions = PERIODO_OPTIONS;
  readonly periodoActivo = signal<string>('semana');

  readonly weeks: DiaActividad[] = [
    { label: 'L 14', value: 0.8 },
    { label: 'M 15', value: 1.0 },
    { label: 'X 16', value: 0.6 },
    { label: 'J 17', value: 1.0 },
    { label: 'V 18', value: 0.9 },
    { label: 'S 19', value: 0.0 },
    { label: 'D 20', value: 0.4 },
    { label: 'L 21', value: 1.0 },
    { label: 'M 22', value: 0.85 },
    { label: 'X 23', value: 0.33, today: true },
  ];

  readonly pain: PuntoDolor[] = [
    { d: 'L', v: 6 },
    { d: 'M', v: 5 },
    { d: 'X', v: 5 },
    { d: 'J', v: 4 },
    { d: 'V', v: 3 },
    { d: 'S', v: 3 },
    { d: 'D', v: 2 },
  ];

  readonly achievements: Logro[] = [
    { emoji: '🔥', title: '12 días de racha', subtitle: '¡Sigue así!', color: '#f59e0b', earned: true },
    { emoji: '💪', title: '50 ejercicios', subtitle: 'Completados', color: '#22c55e', earned: true },
    { emoji: '🎯', title: 'Mes perfecto', subtitle: 'Faltan 4 días', color: '#6366f1', earned: false },
    { emoji: '⭐', title: 'Primera semana', subtitle: 'Desbloqueado', color: '#e75c3e', earned: true },
  ];

  readonly history: SesionHistorica[] = [
    { day: 'Ayer · mar 22', plan: 'Hombro · Semana 3', pct: 100, time: '28 min', pain: 3 },
    { day: 'Lun 21 abr', plan: 'Hombro · Semana 3', pct: 100, time: '32 min', pain: 3 },
    { day: 'Dom 20 abr', plan: 'Hombro · Semana 2', pct: 50, time: '14 min', pain: 4 },
    { day: 'Sáb 19 abr', plan: 'Descanso', pct: 0, time: '—', pain: null, rest: true },
    { day: 'Vie 18 abr', plan: 'Hombro · Semana 2', pct: 100, time: '30 min', pain: 4 },
  ];

  readonly diasActivosTotal = computed(
    () => this.weeks.filter((w) => w.value > 0).length,
  );

  readonly painPlot = computed<PuntoDolorPlot[]>(() => {
    const pts = this.pain;
    const last = Math.max(pts.length - 1, 1);
    return pts.map((p, i) => ({
      ...p,
      x: (i / last) * 280 + 10,
      y: 80 - (p.v / 10) * 70,
    }));
  });

  readonly painPolyline = computed(() =>
    this.painPlot()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  readonly painArea = computed(() => `10,80 ${this.painPolyline()} 290,80`);

  onPeriodoChange(id: string): void {
    this.periodoActivo.set(id);
  }

  barColor(w: DiaActividad): string {
    if (w.value === 0) return 'rgba(0, 0, 0, 0.06)';
    if (w.today) {
      return 'repeating-linear-gradient(45deg, var(--kengo-primary), var(--kengo-primary) 3px, var(--kengo-primary-light) 3px, var(--kengo-primary-light) 6px)';
    }
    if (w.value >= 1) return 'linear-gradient(180deg, var(--kengo-primary), var(--kengo-primary-dark))';
    return 'linear-gradient(180deg, var(--kengo-primary-light), var(--kengo-primary))';
  }

  barHeightPct(w: DiaActividad): number {
    return Math.max(w.value * 100, 3);
  }

  painDotColor(v: number): string {
    if (v <= 3) return '#22c55e';
    if (v <= 5) return '#efc048';
    return '#ef4444';
  }
}
