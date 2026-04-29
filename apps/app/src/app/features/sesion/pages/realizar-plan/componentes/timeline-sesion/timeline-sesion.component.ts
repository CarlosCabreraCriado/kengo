import {
  ChangeDetectionStrategy,
  Component,
  input,
  Output,
  EventEmitter,
  inject,
  computed,
  effect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import {
  Ui2PillComponent,
  Ui2ProgressBarComponent,
} from '../../../../../../shared/ui-v2';
import {
  EjercicioPlan,
  EjercicioSesionMultiPlan,
} from '../../../../../../../types/global';

type EstadoEjercicio = 'completado' | 'activo' | 'pendiente';

interface EjercicioTimeline {
  ejercicio: EjercicioPlan;
  estado: EstadoEjercicio;
  index: number;
  portadaUrl: string | null;
  showPlanDivider: boolean;
  planTitulo: string | null;
}

@Component({
  selector: 'app-timeline-sesion',
  standalone: true,
  imports: [NgTemplateOutlet, Ui2PillComponent, Ui2ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'drawer') {
      <!-- Modo drawer (móvil) -->
      @if (isOpen()) {
        <div class="drawer-backdrop" (click)="closed.emit()"></div>
        <aside class="drawer-sheet">
          <div class="timeline-drawer">
            <!-- Handle bar -->
            <div class="drawer-handle">
              <div class="drawer-handle-bar"></div>
            </div>

            <!-- Header -->
            <div class="drawer-header">
              <div class="drawer-header-text">
                <h2 class="drawer-title">Tu sesión</h2>
                <span class="drawer-subtitle">
                  Ejercicio {{ ejercicioActualIndex() + 1 }} de
                  {{ totalEjercicios() }}
                </span>
              </div>
              <button
                type="button"
                class="drawer-close-btn"
                (click)="closed.emit()"
                aria-label="Cerrar"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Barra de progreso -->
            <div class="drawer-progress">
              <ui2-progress-bar
                [value]="progresoSesion()"
                size="sm"
                color="primary"
              />
            </div>

            <!-- Timeline scrollable -->
            <div #timelineContainer class="timeline-scroll">
              <ng-container [ngTemplateOutlet]="timelineNodes" />
            </div>
          </div>
        </aside>
      }
    } @else {
      <!-- Modo inline (desktop) -->
      <div class="timeline-inline">
        <div class="inline-header">
          <div class="inline-header-left">
            <span class="material-symbols-outlined inline-header-icon" aria-hidden="true"
              >timeline</span
            >
            <span class="inline-header-title">Ejercicios</span>
          </div>
          <span class="inline-header-progress">
            {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
          </span>
        </div>

        <ui2-progress-bar
          [value]="progresoSesion()"
          size="sm"
          color="primary"
        />

        <div #timelineContainer class="timeline-scroll-inline">
          <ng-container [ngTemplateOutlet]="timelineNodes" />
        </div>
      </div>
    }

    <!-- Template compartido de nodos de la timeline -->
    <ng-template #timelineNodes>
      @for (item of ejerciciosConEstado(); track item.index) {
        <!-- Separador de plan en modo multi-plan -->
        @if (item.showPlanDivider && item.planTitulo) {
          <div class="plan-divider">
            <div class="plan-divider-line"></div>
            <span class="plan-divider-text">
              {{ item.planTitulo }}
            </span>
            <div class="plan-divider-line"></div>
          </div>
        }

        <!-- Timeline node -->
        <div
          class="timeline-node"
          [class.completado]="item.estado === 'completado'"
          [class.activo]="item.estado === 'activo'"
          [class.pendiente]="item.estado === 'pendiente'"
          (click)="onTapEjercicio(item)"
        >
          <!-- Línea conectora superior -->
          @if (item.index > 0) {
            <div
              class="connector-line top"
              [class.filled]="item.estado !== 'pendiente'"
            ></div>
          }

          <!-- Nodo circular -->
          <div class="node-circle">
            @if (item.estado === 'completado') {
              <span class="material-symbols-outlined icon-check" aria-hidden="true">check</span>
            } @else {
              <span class="node-number">{{ item.index + 1 }}</span>
            }
          </div>

          <!-- Línea conectora inferior -->
          @if (item.index < ejerciciosConEstado().length - 1) {
            <div
              class="connector-line bottom"
              [class.filled]="item.estado === 'completado'"
            ></div>
          }

          <!-- Card del ejercicio -->
          <div class="exercise-card">
            <div class="exercise-thumb">
              @if (item.portadaUrl) {
                <img
                  [src]="item.portadaUrl"
                  [alt]="item.ejercicio.ejercicio.nombre"
                  loading="lazy"
                />
              } @else {
                <div class="exercise-thumb-placeholder">
                  <span class="material-symbols-outlined" aria-hidden="true"
                    >fitness_center</span
                  >
                </div>
              }
            </div>

            <div class="exercise-info">
              <span class="exercise-name">{{
                item.ejercicio.ejercicio.nombre
              }}</span>
              <span class="exercise-details">
                {{ item.ejercicio.series ?? 3 }} series &times;
                @if (item.ejercicio.duracionSeg) {
                  {{ formatDuracion(item.ejercicio.duracionSeg) }}
                } @else {
                  {{ item.ejercicio.repeticiones ?? 12 }} reps
                }
              </span>
              @if (item.estado === 'completado') {
                <span class="status-pill">
                  <ui2-pill variant="success" size="sm" icon="check_circle">
                    Completado
                  </ui2-pill>
                </span>
              } @else if (item.estado === 'activo') {
                <span class="status-pill">
                  <ui2-pill variant="primary" size="sm">En curso</ui2-pill>
                </span>
              }
            </div>

            <!-- Botón play preview -->
            <div class="preview-btn">
              <span class="material-symbols-outlined" aria-hidden="true">play_circle</span>
            </div>
          </div>
        </div>
      }

      <div class="bottom-spacer"></div>
    </ng-template>
  `,
  styles: `
    :host { display: contents; }

    /* ===== Drawer (bottom sheet) ===== */
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 90;
      animation: fadeBackdrop 0.2s ease-out;
    }

    .drawer-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 91;
      max-height: 85vh;
      background: var(--cream-50);
      border-top-left-radius: 22px;
      border-top-right-radius: 22px;
      box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.18);
      animation: slideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .timeline-drawer {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      overflow: hidden;
    }

    .drawer-handle {
      display: flex;
      justify-content: center;
      padding: 12px 0 4px;
    }

    .drawer-handle-bar {
      width: 48px;
      height: 5px;
      border-radius: 9999px;
      background: var(--ink-300);
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px 12px;
    }

    .drawer-header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .drawer-title {
      margin: 0;
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 1.05rem;
      color: var(--ink-900);
      letter-spacing: -0.2px;
    }

    .drawer-subtitle {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--ink-500);
    }

    .drawer-close-btn {
      display: inline-grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      background: var(--cream-100);
      color: var(--ink-700);
      border: 0;
      cursor: pointer;
      transition: background 0.15s;
    }

    .drawer-close-btn:hover {
      background: var(--ink-100);
    }

    .drawer-close-btn .material-symbols-outlined {
      font-size: 20px;
    }

    .drawer-progress {
      padding: 0 20px 12px;
    }

    .timeline-scroll {
      flex: 1;
      overflow-y: auto;
    }

    @keyframes fadeBackdrop {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    /* ===== Modo Inline ===== */
    .timeline-inline {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      background: var(--cream-50);
      border: 1px solid var(--ink-100);
      border-radius: 18px;
    }

    .inline-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .inline-header-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .inline-header-icon {
      font-size: 1rem;
      color: var(--kengo-primary);
    }

    .inline-header-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--ink-700);
    }

    .inline-header-progress {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--ink-500);
      font-variant-numeric: tabular-nums;
    }

    .timeline-inline .timeline-node {
      padding: 4px 4px 4px 36px;
      min-height: 56px;
    }

    .timeline-inline .node-circle {
      left: 4px;
      width: 24px;
      height: 24px;
    }

    .timeline-inline .node-number {
      font-size: 0.6rem;
    }

    .timeline-inline .icon-check {
      font-size: 0.8rem;
    }

    .timeline-inline .connector-line {
      left: 15px;
    }

    .timeline-inline .exercise-card {
      padding: 8px 10px;
      border-radius: 12px;
      gap: 10px;
    }

    .timeline-inline .exercise-thumb {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .timeline-inline .exercise-name {
      font-size: 0.75rem;
    }

    .timeline-inline .exercise-details {
      font-size: 0.625rem;
    }

    .timeline-inline .preview-btn .material-symbols-outlined {
      font-size: 1.25rem;
    }

    /* ===== Plan divider ===== */
    .plan-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px 8px;
    }

    .plan-divider-line {
      flex: 1;
      height: 1px;
      background: var(--ink-100);
    }

    .plan-divider-text {
      font-family: Galvji, sans-serif;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--ink-500);
    }

    /* ===== Timeline Node ===== */
    .timeline-node {
      position: relative;
      display: flex;
      align-items: center;
      padding: 6px 20px 6px 52px;
      min-height: 72px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .timeline-node:active {
      background: rgba(0, 0, 0, 0.03);
    }

    /* ===== Nodo circular ===== */
    .node-circle {
      position: absolute;
      left: 20px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      flex-shrink: 0;
      transition: all 0.3s;
    }

    .pendiente .node-circle {
      background: var(--cream-100);
      border: 2px solid var(--ink-300);
    }

    .pendiente .node-number {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 0.7rem;
      color: var(--ink-500);
    }

    .activo .node-circle {
      background: var(--kengo-primary);
      border: 2px solid var(--kengo-primary);
      box-shadow: 0 0 0 4px rgba(231, 92, 62, 0.18);
      animation: pulse-node 2s ease-in-out infinite;
    }

    .activo .node-number {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 0.7rem;
      color: white;
    }

    .completado .node-circle {
      background: var(--success);
      border: 2px solid var(--success);
    }

    .icon-check {
      font-size: 1rem;
      color: white;
      font-weight: 700;
    }

    @keyframes pulse-node {
      0%,
      100% {
        box-shadow: 0 0 0 4px rgba(231, 92, 62, 0.18);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(231, 92, 62, 0.08);
      }
    }

    /* ===== Líneas conectoras ===== */
    .connector-line {
      position: absolute;
      left: 33px;
      width: 2px;
      background: var(--ink-100);
      z-index: 1;
    }

    .connector-line.top {
      top: 0;
      height: calc(50% - 14px);
    }

    .connector-line.bottom {
      bottom: 0;
      height: calc(50% - 14px);
    }

    .connector-line.filled {
      background: var(--success);
    }

    /* ===== Exercise Card ===== */
    .exercise-card {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      padding: 10px 12px;
      border-radius: 14px;
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: var(--shadow-card);
      transition: all 0.2s;
    }

    .activo .exercise-card {
      background: linear-gradient(135deg, #fff5ee, #ffffff);
      border-color: rgba(231, 92, 62, 0.15);
      box-shadow: 0 4px 14px rgba(231, 92, 62, 0.08);
    }

    .completado .exercise-card {
      opacity: 0.75;
    }

    .exercise-thumb {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .exercise-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .exercise-thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cream-100);
      color: var(--ink-300);
    }

    .exercise-thumb-placeholder .material-symbols-outlined {
      font-size: 1.1rem;
    }

    .exercise-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .exercise-name {
      font-family: Galvji, sans-serif;
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--ink-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .exercise-details {
      font-size: 0.6875rem;
      color: var(--ink-500);
    }

    .status-pill {
      display: inline-flex;
      margin-top: 4px;
    }

    .preview-btn {
      flex-shrink: 0;
      color: var(--ink-300);
      transition: color 0.15s;
    }

    .activo .preview-btn {
      color: var(--kengo-primary);
    }

    .preview-btn .material-symbols-outlined {
      font-size: 1.5rem;
    }

    .bottom-spacer {
      height: 24px;
    }
  `,
})
export class TimelineSesionComponent {
  readonly isOpen = input(false);
  readonly mode = input<'drawer' | 'inline'>('drawer');
  @Output() closed = new EventEmitter<void>();
  @Output() previewEjercicio = new EventEmitter<{
    ejercicio: EjercicioPlan;
    index: number;
  }>();

  private registroService = inject(SesionStateService);
  private timelineContainer = viewChild<ElementRef>('timelineContainer');

  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;
  readonly modoMultiPlan = this.registroService.modoMultiPlan;

  readonly ejerciciosConEstado = computed<EjercicioTimeline[]>(() => {
    const lista = this.registroService.ejerciciosList();
    const currentIdx = this.ejercicioActualIndex();
    const esMultiPlan = this.modoMultiPlan();

    let prevPlanTitulo: string | null = null;

    return lista.map((ej, i) => {
      const estado: EstadoEjercicio =
        i < currentIdx
          ? 'completado'
          : i === currentIdx
            ? 'activo'
            : 'pendiente';

      let showPlanDivider = false;
      let planTitulo: string | null = null;

      if (esMultiPlan && this.isEjercicioMultiPlan(ej)) {
        planTitulo = ej.planTitulo;
        if (planTitulo !== prevPlanTitulo) {
          showPlanDivider = true;
          prevPlanTitulo = planTitulo;
        }
      }

      return {
        ejercicio: ej,
        estado,
        index: i,
        portadaUrl: ej.ejercicio?.portada
          ? this.registroService.getAssetUrl(ej.ejercicio.portada, 96, 96)
          : null,
        showPlanDivider,
        planTitulo,
      };
    });
  });

  constructor() {
    effect(() => {
      if (this.isOpen() && this.mode() === 'drawer') {
        setTimeout(() => this.scrollToActiveExercise(), 150);
      }
    });
  }

  formatDuracion(segundos: number): string {
    if (segundos < 60) {
      return `${segundos}s`;
    }
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }

  onTapEjercicio(item: EjercicioTimeline): void {
    this.previewEjercicio.emit({
      ejercicio: item.ejercicio,
      index: item.index,
    });
  }

  private isEjercicioMultiPlan(
    item: EjercicioPlan,
  ): item is EjercicioSesionMultiPlan {
    return 'planId' in item && 'planTitulo' in item;
  }

  private scrollToActiveExercise(): void {
    const container = this.timelineContainer()?.nativeElement;
    if (!container) return;

    const activeNode = container.querySelector(
      '.timeline-node.activo',
    ) as HTMLElement;
    if (activeNode) {
      activeNode.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }
}
