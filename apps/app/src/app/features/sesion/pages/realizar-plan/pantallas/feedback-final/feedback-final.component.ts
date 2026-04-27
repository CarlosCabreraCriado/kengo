import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { FeedbackCelebracionComponent } from '../../componentes/feedback/feedback-celebracion/feedback-celebracion.component';
import { FeedbackGlobalFormComponent } from '../../componentes/feedback/feedback-global-form/feedback-global-form.component';
import {
  EjercicioFeedback,
  FeedbackDetalladoFormComponent,
} from '../../componentes/feedback/feedback-detallado-form/feedback-detallado-form.component';

export interface FeedbackFinalData {
  feedbacks: {
    planItemId: string;
    dolor: number;
    nota?: string;
  }[];
  observacionesGenerales?: string;
}

@Component({
  selector: 'app-feedback-final',
  standalone: true,
  imports: [
    FeedbackCelebracionComponent,
    FeedbackGlobalFormComponent,
    FeedbackDetalladoFormComponent,
  ],
  templateUrl: './feedback-final.component.html',
  styleUrl: './feedback-final.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackFinalComponent {
  @Output() enviarFeedback = new EventEmitter<FeedbackFinalData>();

  private readonly registroService = inject(SesionStateService);

  private readonly _modoDetallado = signal(false);
  readonly modoDetallado = this._modoDetallado.asReadonly();

  private readonly _dolorGlobal = signal<number | null>(null);
  readonly dolorGlobal = this._dolorGlobal.asReadonly();

  private readonly _dolorPorEjercicio = signal<Map<string, number>>(new Map());
  readonly dolorPorEjercicio = this._dolorPorEjercicio.asReadonly();

  private readonly _notasPorEjercicio = signal<Map<string, string>>(new Map());
  readonly notasPorEjercicio = this._notasPorEjercicio.asReadonly();

  private readonly _notasExpandidas = signal<Set<string>>(new Set());
  readonly notasExpandidas = this._notasExpandidas.asReadonly();

  private readonly _observacionesGenerales = signal('');
  readonly observacionesGenerales = this._observacionesGenerales.asReadonly();

  private readonly circumference = 2 * Math.PI * 18;

  readonly ejerciciosCompletados = computed<EjercicioFeedback[]>(() => {
    const lista = this.registroService.ejerciciosList();
    return lista.map((ej) => {
      const planItemIdMulti = (ej as unknown as { planItemId?: string }).planItemId;
      const planItemId = this.registroService.modoMultiPlan()
        ? (planItemIdMulti ?? ej.id ?? '')
        : (ej.id ?? '');
      return {
        planItemId,
        nombre: ej.ejercicio?.nombre || 'Ejercicio',
      };
    });
  });

  readonly totalEjercicios = computed(() => this.ejerciciosCompletados().length);

  readonly ejerciciosConDolor = computed(() => this._dolorPorEjercicio().size);

  readonly todosCompletadosDetallado = computed(() => {
    const total = this.ejerciciosCompletados().length;
    const completados = this._dolorPorEjercicio().size;
    return total > 0 && completados === total;
  });

  readonly puedeFinalizarSimplificado = computed(() => this._dolorGlobal() !== null);

  readonly todosCompletados = computed(() =>
    this._modoDetallado()
      ? this.todosCompletadosDetallado()
      : this.puedeFinalizarSimplificado(),
  );

  readonly progressOffset = computed(() => {
    const total = this.totalEjercicios();
    if (total === 0) return this.circumference;
    const progress = this.ejerciciosConDolor() / total;
    return this.circumference * (1 - progress);
  });

  onDolorGlobalChange(dolor: number): void {
    this._dolorGlobal.set(dolor);
  }

  onObservacionesChange(valor: string): void {
    this._observacionesGenerales.set(valor);
  }

  onDolorEjercicioChange({ planItemId, valor }: { planItemId: string; valor: number }): void {
    this._dolorPorEjercicio.update((map) => {
      const newMap = new Map(map);
      newMap.set(planItemId, valor);
      return newMap;
    });
  }

  onNotaEjercicioChange({ planItemId, valor }: { planItemId: string; valor: string }): void {
    this._notasPorEjercicio.update((map) => {
      const newMap = new Map(map);
      const trimmed = valor.trim();
      if (trimmed) {
        newMap.set(planItemId, trimmed);
      } else {
        newMap.delete(planItemId);
      }
      return newMap;
    });
  }

  onToggleNota(planItemId: string): void {
    this._notasExpandidas.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(planItemId)) {
        newSet.delete(planItemId);
      } else {
        newSet.add(planItemId);
      }
      return newSet;
    });
  }

  activarModoDetallado(): void {
    const dolorGlobal = this._dolorGlobal();
    if (dolorGlobal !== null) {
      this._dolorPorEjercicio.update((map) => {
        const newMap = new Map(map);
        this.ejerciciosCompletados().forEach((ej) => {
          if (!newMap.has(ej.planItemId)) {
            newMap.set(ej.planItemId, dolorGlobal);
          }
        });
        return newMap;
      });
    }
    this._modoDetallado.set(true);
  }

  desactivarModoDetallado(): void {
    this._modoDetallado.set(false);
  }

  onFinalizar(): void {
    if (!this.todosCompletados()) return;

    let feedbacks: FeedbackFinalData['feedbacks'];

    if (this._modoDetallado()) {
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: this._dolorPorEjercicio().get(ej.planItemId)!,
        nota: this._notasPorEjercicio().get(ej.planItemId),
      }));
    } else {
      const dolorGlobal = this._dolorGlobal()!;
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: dolorGlobal,
        nota: undefined,
      }));
    }

    this.enviarFeedback.emit({
      feedbacks,
      observacionesGenerales: this._observacionesGenerales().trim() || undefined,
    });
  }
}
