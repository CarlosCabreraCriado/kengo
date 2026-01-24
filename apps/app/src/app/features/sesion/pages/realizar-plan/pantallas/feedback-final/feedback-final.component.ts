import {
  Component,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { EscalaDolorComponent } from '../../componentes/escala-dolor/escala-dolor.component';
import { fadeAnimation, staggerAnimation } from '../../realizar-plan.animations';

export interface FeedbackFinalData {
  feedbacks: Array<{
    planItemId: number;
    dolor: number;
    nota?: string;
  }>;
  observacionesGenerales?: string;
}

@Component({
  selector: 'app-feedback-final',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EscalaDolorComponent,
  ],
  animations: [fadeAnimation, staggerAnimation],
  template: `
    <div class="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-zinc-50 to-white">
      <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 px-4 pt-6 pb-4 text-center">
        <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
          <span class="material-symbols-outlined text-3xl text-white">sentiment_satisfied</span>
        </div>
        <h1 class="m-0 text-xl font-bold text-zinc-800">¡Sesión completada!</h1>
        <p class="m-0 mt-1 text-sm text-zinc-500">
          Cuéntanos cómo te sentiste en cada ejercicio
        </p>
      </div>

      <!-- Lista de ejercicios con feedback -->
      <div class="flex-1 overflow-y-auto px-4 pb-4">
        <div class="flex flex-col gap-4">
          @for (ejercicio of ejerciciosCompletados(); track ejercicio.planItemId; let i = $index) {
            <div
              class="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-sm"
              @fade
            >
              <!-- Nombre del ejercicio -->
              <div class="mb-3 flex items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600">
                  {{ i + 1 }}
                </div>
                <span class="text-base font-semibold text-zinc-800">
                  {{ ejercicio.nombre }}
                </span>
                @if (dolorPorEjercicio().get(ejercicio.planItemId) !== undefined) {
                  <span class="material-symbols-outlined icon-filled ml-auto text-xl text-emerald-500">check_circle</span>
                }
              </div>

              <!-- Escala de dolor -->
              <app-escala-dolor
                label="¿Sentiste dolor?"
                [valor]="dolorPorEjercicio().get(ejercicio.planItemId) ?? null"
                (valorChange)="onDolorChange(ejercicio.planItemId, $event)"
              />

              <!-- Nota individual (colapsable custom) -->
              <div class="mt-3 rounded-xl bg-zinc-50 overflow-hidden">
                <button
                  type="button"
                  class="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100"
                  (click)="toggleNota(ejercicio.planItemId)"
                >
                  <span class="material-symbols-outlined text-base">edit_note</span>
                  Agregar nota (opcional)
                  <span
                    class="material-symbols-outlined ml-auto text-base transition-transform"
                    [class.rotate-180]="notasExpandidas().has(ejercicio.planItemId)"
                  >expand_more</span>
                </button>
                @if (notasExpandidas().has(ejercicio.planItemId)) {
                  <div class="px-3 pb-3">
                    <textarea
                      class="w-full resize-none rounded-lg border-0 bg-white p-3 text-sm text-zinc-700 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#e75c3e]/40"
                      placeholder="Ej: Sentí molestia al estirar..."
                      rows="2"
                      [ngModel]="notasPorEjercicio().get(ejercicio.planItemId) || ''"
                      (ngModelChange)="onNotaChange(ejercicio.planItemId, $event)"
                    ></textarea>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Observaciones generales -->
          <div class="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-sm" @fade>
            <label class="mb-2 flex items-center gap-1 text-sm font-semibold text-zinc-700">
              <span class="material-symbols-outlined text-lg text-zinc-400">comment</span>
              Observaciones generales (opcional)
            </label>
            <textarea
              class="w-full resize-none rounded-xl border-0 bg-zinc-50 p-3.5 text-sm text-zinc-700 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#e75c3e]/40"
              placeholder="¿Cómo te sentiste durante la sesión en general?"
              rows="3"
              [(ngModel)]="observacionesGenerales"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Botón finalizar -->
      <div class="shrink-0 border-t border-zinc-100 bg-white/80 px-4 py-4 backdrop-blur-sm">
        <button
          type="button"
          class="cta-button flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="!todosCompletados()"
          (click)="onFinalizar()"
        >
          Finalizar sesión
          <span class="material-symbols-outlined">check</span>
        </button>

        @if (!todosCompletados()) {
          <p class="m-0 mt-2 text-center text-xs font-medium text-zinc-400">
            Completa la escala de dolor de todos los ejercicios ({{ ejerciciosConDolor() }}/{{ totalEjercicios() }})
          </p>
        }
      </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .cta-button {
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.35);
    }

    .cta-button:hover:not(:disabled) {
      box-shadow: 0 6px 20px rgba(231, 92, 62, 0.45);
    }

    .icon-filled {
      font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
    }
  `,
})
export class FeedbackFinalComponent {
  @Output() enviarFeedback = new EventEmitter<FeedbackFinalData>();

  private registroService = inject(RegistroSesionService);

  // Estado interno
  private _dolorPorEjercicio = signal<Map<number, number>>(new Map());
  private _notasPorEjercicio = signal<Map<number, string>>(new Map());
  private _notasExpandidas = signal<Set<number>>(new Set());
  observacionesGenerales = '';

  // Computed - lista de ejercicios completados
  readonly ejerciciosCompletados = computed(() => {
    const lista = this.registroService.ejerciciosList();
    return lista.map((ej) => ({
      planItemId: this.registroService.modoMultiPlan()
        ? (ej as any).planItemId
        : ej.id,
      nombre: ej.ejercicio?.nombre_ejercicio || 'Ejercicio',
    }));
  });

  readonly totalEjercicios = computed(() => this.ejerciciosCompletados().length);

  readonly dolorPorEjercicio = this._dolorPorEjercicio.asReadonly();
  readonly notasPorEjercicio = this._notasPorEjercicio.asReadonly();
  readonly notasExpandidas = this._notasExpandidas.asReadonly();

  readonly ejerciciosConDolor = computed(() => this._dolorPorEjercicio().size);

  readonly todosCompletados = computed(() => {
    const total = this.ejerciciosCompletados().length;
    const completados = this._dolorPorEjercicio().size;
    return total > 0 && completados === total;
  });

  toggleNota(planItemId: number): void {
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

  onDolorChange(planItemId: number, dolor: number): void {
    this._dolorPorEjercicio.update((map) => {
      const newMap = new Map(map);
      newMap.set(planItemId, dolor);
      return newMap;
    });
  }

  onNotaChange(planItemId: number, nota: string): void {
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

  onFinalizar(): void {
    if (!this.todosCompletados()) return;

    const feedbacks = this.ejerciciosCompletados().map((ej) => ({
      planItemId: ej.planItemId,
      dolor: this._dolorPorEjercicio().get(ej.planItemId)!,
      nota: this._notasPorEjercicio().get(ej.planItemId),
    }));

    this.enviarFeedback.emit({
      feedbacks,
      observacionesGenerales: this.observacionesGenerales.trim() || undefined,
    });
  }
}
