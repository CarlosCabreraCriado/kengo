import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import {
  Ui2BigTitleComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2KpiCardComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
  Ui2StatusDotComponent,
  Ui2WebActivityChartComponent,
} from '../../../../shared/ui-v2';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { ShareService } from '../../../../core/services/share.service';
import { ClipboardService } from '../../../../core/services/clipboard.service';
import {
  EstadisticasService,
  type PuntoDolorVm,
} from '../../data-access/estadisticas.service';

interface PuntoDolorPlot extends PuntoDolorVm {
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
    Ui2BigTitleComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2KpiCardComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
    Ui2StatusDotComponent,
    Ui2WebActivityChartComponent,
  ],
  templateUrl: './actividad-estadisticas.component.html',
  styleUrl: './actividad-estadisticas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActividadEstadisticasComponent implements OnInit {
  private estadisticas = inject(EstadisticasService);
  private toast = inject(ToastService);
  private share = inject(ShareService);
  private clipboard = inject(ClipboardService);

  readonly periodoOptions = PERIODO_OPTIONS;
  readonly periodoActivo = this.estadisticas.periodo;

  readonly cargando = this.estadisticas.cargando;
  readonly hayDatos = this.estadisticas.hayDatos;

  readonly weeks = this.estadisticas.actividadSerie;
  readonly pain = this.estadisticas.dolorSerie;
  readonly history = this.estadisticas.historialReciente;
  readonly subtituloHero = this.estadisticas.subtituloHero;
  readonly periodoLabel = this.estadisticas.periodoLabel;

  readonly adherencia = this.estadisticas.adherencia;
  readonly adherenciaDelta = this.estadisticas.adherenciaDelta;
  readonly racha = this.estadisticas.rachaActual;
  readonly mejorRacha = this.estadisticas.mejorRachaHistorica;
  readonly dolorInicial = this.estadisticas.dolorInicial;
  readonly dolorActual = this.estadisticas.dolorActual;

  readonly adherenciaValue = computed<string | number>(() => {
    const ad = this.adherencia();
    return ad === null ? '—' : ad;
  });

  readonly adherenciaUnit = computed<string | null>(() =>
    this.adherencia() === null ? null : '%',
  );

  readonly mejorRachaTexto = computed<string | null>(() =>
    this.mejorRacha() > 0 ? `Mejor racha: ${this.mejorRacha()} días` : null,
  );

  readonly painPlot = computed<PuntoDolorPlot[]>(() => {
    const pts = this.pain();
    if (pts.length === 0) return [];
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

  readonly tieneDolor = computed(() => this.painPlot().length >= 2);

  readonly deltaTexto = computed(() => this.adherenciaDelta()?.texto ?? null);
  readonly deltaColor = computed(() => {
    const delta = this.adherenciaDelta();
    if (!delta) return 'var(--ink-500)';
    if (delta.valor > 0) return 'var(--success)';
    if (delta.valor < 0) return 'var(--danger)';
    return 'var(--ink-500)';
  });

  ngOnInit(): void {
    this.estadisticas.cargarSiNecesario();
  }

  onPeriodoChange(id: string): void {
    this.estadisticas.setPeriodo(id);
  }

  async onCompartir(): Promise<void> {
    const texto = this.estadisticas.resumenCompartible();

    if (this.share.isAvailable) {
      const shared = await this.share.share({ title: 'Mi progreso en Kengo', text: texto });
      if (shared) return;
    }

    const copied = await this.clipboard.write(texto);
    if (copied) {
      this.toast.success('Resumen copiado al portapapeles');
      return;
    }
    this.toast.warning('Tu dispositivo no permite compartir el resumen.');
  }

  painDotColor(v: number): string {
    if (v <= 3) return 'var(--success)';
    if (v <= 5) return 'var(--kengo-tertiary)';
    return 'var(--danger)';
  }
}
