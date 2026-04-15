import {
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
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { DrawerComponent } from '../../../../../../shared/ui/drawer/drawer.component';
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
  imports: [DrawerComponent],
  template: `
    <ui-drawer
      [isOpen]="isOpen()"
      position="bottom"
      size="lg"
      (closed)="closed.emit()"
    >
      <div class="timeline-drawer">
        <!-- Handle bar -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="h-1.5 w-12 rounded-full bg-zinc-300"></div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3">
          <div class="flex flex-col gap-0.5">
            <h2 class="text-base font-bold text-zinc-800">Tu sesion</h2>
            <span class="text-xs font-medium text-zinc-400">
              Ejercicio {{ ejercicioActualIndex() + 1 }} de
              {{ totalEjercicios() }}
            </span>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors active:bg-zinc-200"
            (click)="closed.emit()"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Barra de progreso -->
        <div class="mx-5 mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            class="progress-fill h-full rounded-full transition-all duration-500 ease-out"
            [style.width.%]="progresoSesion()"
          ></div>
        </div>

        <!-- Timeline scrollable -->
        <div #timelineContainer class="timeline-scroll">
          @for (item of ejerciciosConEstado(); track item.index) {
            <!-- Separador de plan en modo multi-plan -->
            @if (item.showPlanDivider && item.planTitulo) {
              <div class="flex items-center gap-3 px-5 pb-2 pt-4">
                <div class="h-px flex-1 bg-zinc-200"></div>
                <span
                  class="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400"
                >
                  {{ item.planTitulo }}
                </span>
                <div class="h-px flex-1 bg-zinc-200"></div>
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
              <!-- Linea conectora superior -->
              @if (item.index > 0) {
                <div
                  class="connector-line top"
                  [class.filled]="item.estado !== 'pendiente'"
                ></div>
              }

              <!-- Nodo circular -->
              <div class="node-circle">
                @if (item.estado === 'completado') {
                  <span class="material-symbols-outlined icon-check"
                    >check</span
                  >
                } @else {
                  <span class="node-number">{{ item.index + 1 }}</span>
                }
              </div>

              <!-- Linea conectora inferior -->
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
                      [alt]="item.ejercicio.ejercicio.nombre_ejercicio"
                      loading="lazy"
                    />
                  } @else {
                    <div
                      class="flex h-full w-full items-center justify-center bg-zinc-100"
                    >
                      <span
                        class="material-symbols-outlined text-lg text-zinc-300"
                        >fitness_center</span
                      >
                    </div>
                  }
                </div>

                <div class="exercise-info">
                  <span class="exercise-name">{{
                    item.ejercicio.ejercicio.nombre_ejercicio
                  }}</span>
                  <span class="exercise-details">
                    {{ item.ejercicio.series ?? 3 }} series &times;
                    @if (item.ejercicio.duracion_seg) {
                      {{ formatDuracion(item.ejercicio.duracion_seg) }}
                    } @else {
                      {{ item.ejercicio.repeticiones ?? 12 }} reps
                    }
                  </span>
                  @if (item.estado === 'completado') {
                    <span class="status-badge completado">
                      <span class="material-symbols-outlined text-[0.625rem]"
                        >check_circle</span
                      >
                      Completado
                    </span>
                  } @else if (item.estado === 'activo') {
                    <span class="status-badge activo"> En curso </span>
                  }
                </div>

                <!-- Boton play preview -->
                <div class="preview-btn">
                  <span class="material-symbols-outlined">play_circle</span>
                </div>
              </div>
            </div>
          }

          <!-- Espaciado inferior -->
          <div class="h-8"></div>
        </div>
      </div>
    </ui-drawer>
  `,
  styles: `
    .timeline-drawer {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
      overflow: hidden;
    }

    .progress-fill {
      background: linear-gradient(
        90deg,
        var(--kengo-primary) 0%,
        var(--kengo-tertiary) 100%
      );
    }

    .timeline-scroll {
      flex: 1;
      overflow-y: auto;
      padding-bottom: env(safe-area-inset-bottom);
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
      background: #f4f4f5;
      border: 2px solid #d4d4d8;
    }

    .pendiente .node-number {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #a1a1aa;
    }

    .activo .node-circle {
      background: var(--kengo-primary);
      border: 2px solid var(--kengo-primary);
      box-shadow: 0 0 0 4px rgba(var(--kengo-primary-rgb), 0.15);
      animation: pulse-node 2s ease-in-out infinite;
    }

    .activo .node-number {
      font-size: 0.6875rem;
      font-weight: 700;
      color: white;
    }

    .completado .node-circle {
      background: #10b981;
      border: 2px solid #10b981;
    }

    .icon-check {
      font-size: 1rem;
      color: white;
      font-weight: 700;
    }

    @keyframes pulse-node {
      0%,
      100% {
        box-shadow: 0 0 0 4px rgba(var(--kengo-primary-rgb), 0.15);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(var(--kengo-primary-rgb), 0.08);
      }
    }

    /* ===== Lineas conectoras ===== */
    .connector-line {
      position: absolute;
      left: 33px;
      width: 2px;
      background: #e4e4e7;
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
      background: #10b981;
    }

    /* ===== Exercise Card ===== */
    .exercise-card {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.05);
      transition: all 0.2s;
    }

    .activo .exercise-card {
      background: rgba(var(--kengo-primary-rgb), 0.04);
      border-color: rgba(var(--kengo-primary-rgb), 0.15);
      box-shadow: 0 2px 8px rgba(var(--kengo-primary-rgb), 0.08);
    }

    .completado .exercise-card {
      opacity: 0.7;
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

    .exercise-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .exercise-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #27272a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .exercise-details {
      font-size: 0.6875rem;
      color: #71717a;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.625rem;
      font-weight: 600;
      margin-top: 2px;
      width: fit-content;
    }

    .status-badge.completado {
      color: #10b981;
    }

    .status-badge.activo {
      color: var(--kengo-primary);
    }

    .preview-btn {
      flex-shrink: 0;
      color: #a1a1aa;
      transition: color 0.15s;
    }

    .activo .preview-btn {
      color: var(--kengo-primary);
    }

    .preview-btn .material-symbols-outlined {
      font-size: 1.5rem;
    }
  `,
})
export class TimelineSesionComponent {
  readonly isOpen = input(false);
  @Output() closed = new EventEmitter<void>();
  @Output() previewEjercicio = new EventEmitter<{
    ejercicio: EjercicioPlan;
    index: number;
  }>();

  private registroService = inject(RegistroSesionService);
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
      if (this.isOpen()) {
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
