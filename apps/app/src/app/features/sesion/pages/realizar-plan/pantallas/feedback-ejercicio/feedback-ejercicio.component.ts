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
import { checkmarkAnimation, fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-feedback-ejercicio',
  standalone: true,
  imports: [CommonModule, FormsModule, EscalaDolorComponent],
  animations: [checkmarkAnimation, fadeAnimation],
  template: `
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto pt-2">
      <!-- Indicador de progreso -->
      <div class="flex items-center justify-center gap-3 py-2">
        <span class="text-sm font-bold text-zinc-700">
          {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
        </span>
        <div class="progress-bar-track h-2 w-24 overflow-hidden rounded-full">
          <div
            class="h-full rounded-full bg-gradient-to-r from-kengo-primary to-kengo-tertiary transition-all duration-300"
            [style.width.%]="progresoSesion()"
          ></div>
        </div>
      </div>

      <!-- Checkmark animado -->
      <div class="flex shrink-0 flex-col items-center gap-3 py-3" @checkmark>
        <div class="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg animate-pop-in">
          <span class="material-symbols-outlined text-3xl text-white">check</span>
        </div>
        <h2 class="m-0 text-xl font-bold text-zinc-800">¡Ejercicio completado!</h2>
        <p class="m-0 text-sm font-medium text-zinc-500">{{ nombreEjercicio() }}</p>
      </div>

      <!-- Escala de dolor -->
      <div class="shrink-0" @fade>
        <app-escala-dolor
          label="¿Sentiste dolor durante el ejercicio?"
          [valor]="dolorSeleccionado()"
          (valorChange)="onDolorChange($event)"
        />
      </div>

      <!-- Notas opcionales -->
      <div class="flex shrink-0 flex-col gap-2 px-1" @fade>
        <label class="pl-1 text-sm font-semibold text-zinc-700" for="notas">Notas (opcional)</label>
        <textarea
          id="notas"
          class="w-full resize-none rounded-xl bg-white/75 p-3.5 text-sm text-zinc-800 shadow-sm ring-1 ring-white/60 backdrop-blur-sm transition-shadow placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-kengo-primary/40"
          placeholder="Ej: Sentí molestia en la rodilla derecha..."
          rows="3"
          [(ngModel)]="nota"
        ></textarea>
      </div>

      <!-- Botón continuar -->
      <div class="flex shrink-0 flex-col items-center gap-2.5 pt-2">
        <button
          type="button"
          class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="dolorSeleccionado() === null"
          (click)="onEnviar()"
        >
          @if (esUltimoEjercicio()) {
            Finalizar sesión
          } @else {
            Siguiente ejercicio
          }
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>

        @if (dolorSeleccionado() === null) {
          <p class="m-0 rounded-xl bg-white/50 px-4 py-2 text-xs font-medium text-zinc-400">
            Selecciona un nivel de dolor para continuar
          </p>
        }
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

    .progress-bar-track {
      background-color: rgba(var(--kengo-primary-rgb), 0.15);
    }

    .animate-pop-in {
      animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes pop-in {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,
})
export class FeedbackEjercicioComponent {
  @Output() enviarFeedback = new EventEmitter<{ dolor: number; nota?: string }>();

  private registroService = inject(RegistroSesionService);

  readonly esUltimoEjercicio = this.registroService.esUltimoEjercicio;
  readonly nombreEjercicio = computed(
    () => this.registroService.ejercicioActual()?.ejercicio?.nombre_ejercicio || ''
  );

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  readonly dolorSeleccionado = signal<number | null>(null);
  nota = '';

  onDolorChange(valor: number): void {
    this.dolorSeleccionado.set(valor);
  }

  onEnviar(): void {
    const dolor = this.dolorSeleccionado();
    if (dolor === null) return;

    this.enviarFeedback.emit({
      dolor,
      nota: this.nota.trim() || undefined,
    });

    // Resetear para el próximo ejercicio
    this.dolorSeleccionado.set(null);
    this.nota = '';
  }
}
