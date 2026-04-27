import {
  Component,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { EscalaDolorComponent } from '../../componentes/escala-dolor/escala-dolor.component';
import { fadeAnimation, staggerAnimation } from '../../realizar-plan.animations';

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
    FormsModule,
    EscalaDolorComponent,
  ],
  animations: [fadeAnimation, staggerAnimation],
  templateUrl: './feedback-final.component.html',
  styleUrl: './feedback-final.component.css',
})
export class FeedbackFinalComponent {
  @Output() enviarFeedback = new EventEmitter<FeedbackFinalData>();

  private registroService = inject(SesionStateService);

  // Estado interno - modo de feedback
  private _modoDetallado = signal(false);
  readonly modoDetallado = this._modoDetallado.asReadonly();

  // Dolor global para modo simplificado
  private _dolorGlobal = signal<number | null>(null);
  readonly dolorGlobal = this._dolorGlobal.asReadonly();

  // Estado interno - modo detallado
  private _dolorPorEjercicio = signal<Map<string, number>>(new Map());
  private _notasPorEjercicio = signal<Map<string, string>>(new Map());
  private _notasExpandidas = signal<Set<string>>(new Set());
  observacionesGenerales = '';

  // Para el anillo de progreso circular
  readonly circumference = 2 * Math.PI * 18; // r = 18

  // Confetti pieces
  readonly confettiPieces = Array.from({ length: 20 }, (_, i) => i);

  // Computed - lista de ejercicios completados
  readonly ejerciciosCompletados = computed(() => {
    const lista = this.registroService.ejerciciosList();
    return lista.map((ej) => ({
      planItemId: this.registroService.modoMultiPlan()
        ? (ej as any).planItemId
        : ej.id,
      nombre: ej.ejercicio?.nombre || 'Ejercicio',
    }));
  });

  readonly totalEjercicios = computed(() => this.ejerciciosCompletados().length);

  readonly dolorPorEjercicio = this._dolorPorEjercicio.asReadonly();
  readonly notasPorEjercicio = this._notasPorEjercicio.asReadonly();
  readonly notasExpandidas = this._notasExpandidas.asReadonly();

  readonly ejerciciosConDolor = computed(() => this._dolorPorEjercicio().size);

  // Validación para modo detallado (todos los ejercicios con dolor)
  readonly todosCompletadosDetallado = computed(() => {
    const total = this.ejerciciosCompletados().length;
    const completados = this._dolorPorEjercicio().size;
    return total > 0 && completados === total;
  });

  // Validación para modo simplificado (solo dolor global)
  readonly puedeFinalizarSimplificado = computed(() =>
    this._dolorGlobal() !== null
  );

  // Validación unificada según el modo activo
  readonly todosCompletados = computed(() =>
    this._modoDetallado()
      ? this.todosCompletadosDetallado()
      : this.puedeFinalizarSimplificado()
  );

  // Progreso para el anillo circular (stroke-dashoffset)
  readonly progressOffset = computed(() => {
    const total = this.totalEjercicios();
    if (total === 0) return this.circumference;
    const progress = this.ejerciciosConDolor() / total;
    return this.circumference * (1 - progress);
  });

  // Colores de dolor para los badges
  private readonly dolorColores: Record<number, string> = {
    0: '#22c55e',
    1: '#4ade80',
    2: '#86efac',
    3: '#a3e635',
    4: '#facc15',
    5: '#fbbf24',
    6: '#fb923c',
    7: '#f97316',
    8: '#ef4444',
    9: '#dc2626',
    10: '#b91c1c',
  };

  getDolorColor(dolor: number): string {
    return this.dolorColores[dolor] || '#6b7280';
  }

  // Confetti helpers
  getConfettiX(index: number): string {
    return `${5 + (index * 4.5)}%`;
  }

  getConfettiRotation(index: number): string {
    return `${(index * 37) % 360}deg`;
  }

  toggleNota(planItemId: string): void {
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

  onDolorChange(planItemId: string, dolor: number): void {
    this._dolorPorEjercicio.update((map) => {
      const newMap = new Map(map);
      newMap.set(planItemId, dolor);
      return newMap;
    });
  }

  onNotaChange(planItemId: string, nota: string): void {
    this._notasPorEjercicio.update((map) => {
      const newMap = new Map(map);
      if (nota.trim()) {
        newMap.set(planItemId, nota.trim());
      } else {
        newMap.delete(planItemId);
      }
      return newMap;
    });
  }

  // Métodos para el modo simplificado/detallado
  onDolorGlobalChange(dolor: number): void {
    this._dolorGlobal.set(dolor);
  }

  activarModoDetallado(): void {
    // Si hay dolor global, copiarlo a todos los ejercicios sin valor
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
      // Modo detallado: comportamiento actual
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: this._dolorPorEjercicio().get(ej.planItemId)!,
        nota: this._notasPorEjercicio().get(ej.planItemId),
      }));
    } else {
      // Modo simplificado: aplicar dolor global a todos
      const dolorGlobal = this._dolorGlobal()!;
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: dolorGlobal,
        nota: undefined,
      }));
    }

    this.enviarFeedback.emit({
      feedbacks,
      observacionesGenerales: this.observacionesGenerales.trim() || undefined,
    });
  }
}
