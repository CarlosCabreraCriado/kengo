import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import {
  celebrateAnimation,
  fadeAnimation,
  slideUpAnimation,
} from '../../realizar-plan.animations';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-sesion-completada',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  animations: [celebrateAnimation, fadeAnimation, slideUpAnimation],
  template: `
    <div class="flex flex-1 flex-col gap-4 overflow-hidden py-2">
      <!-- Celebración -->
      <div
        class="flex shrink-0 flex-col items-center gap-2.5 py-3 text-center"
        @celebrate
      >
        <mat-icon
          class="material-symbols-outlined !text-primary animate-bounce !text-6xl"
          >celebration</mat-icon
        >
        <h1
          class="m-0 bg-gradient-to-r from-[#e75c3e] to-[#efc048] bg-clip-text text-2xl font-extrabold text-transparent"
        >
          ¡Sesión completada!
        </h1>
        <p class="m-0 text-sm font-medium text-zinc-500">
          Has terminado todos los ejercicios de hoy
        </p>
      </div>

      <!-- Estadísticas -->
      <div class="grid shrink-0 grid-cols-2 gap-3" @slideUp>
        <div class="tarjeta-kengo rounded-xl p-3.5">
          <div class="flex items-center gap-3.5">
            <mat-icon class="material-symbols-outlined !text-primary"
              >timer</mat-icon
            >
            <div class="flex flex-col gap-0.5">
              <span
                class="text-[0.6875rem] font-semibold tracking-wider text-zinc-500 uppercase"
                >Tiempo total</span
              >
              <span class="text-lg font-bold text-zinc-800">{{
                tiempoFormateado()
              }}</span>
            </div>
          </div>
        </div>

        <div class="tarjeta-kengo rounded-xl p-3.5">
          <div class="flex items-center gap-3.5">
            <mat-icon class="material-symbols-outlined !text-emerald-500"
              >check_circle</mat-icon
            >
            <div class="flex flex-col gap-0.5">
              <span
                class="text-[0.6875rem] font-semibold tracking-wider text-zinc-500 uppercase"
                >Ejercicios</span
              >
              <span class="text-lg font-bold text-zinc-800"
                >{{ totalEjercicios() }}/{{ totalEjercicios() }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen de dolor por ejercicio -->
      @if (registros().length > 0) {
        <div class="flex flex-1 flex-col gap-2.5 overflow-hidden" @fade>
          <h3 class="m-0 shrink-0 pl-1 text-sm font-bold text-zinc-700">
            Resumen de dolor
          </h3>
          <div class="flex flex-1 flex-col gap-2 overflow-y-auto">
            @for (registro of registrosConNombre(); track registro.plan_item) {
              <div
                class="tarjeta-kengo flex shrink-0 items-center justify-between rounded-xl px-3.5 py-3"
              >
                <span
                  class="mr-4 flex-1 truncate text-sm font-medium text-zinc-700"
                  >{{ registro.nombre }}</span
                >
                <div class="flex shrink-0 items-center gap-2.5">
                  <span
                    class="text-sm font-bold"
                    [style.color]="getDolorColor(registro.dolor_escala || 0)"
                  >
                    {{ registro.dolor_escala }}/10
                  </span>
                  <mat-icon
                    class="material-symbols-outlined !text-xl"
                    [style.color]="getDolorColor(registro.dolor_escala || 0)"
                  >
                    {{ getDolorIcon(registro.dolor_escala || 0) }}
                  </mat-icon>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Mensaje motivacional -->
      <div class="shrink-0" @fade>
        <p
          class="m-0 rounded-xl bg-white/50 px-4 py-3 text-center text-xs leading-relaxed text-zinc-500"
        >
          Tu fisioterapeuta verá tu progreso y podrá ajustar tu plan según tus
          resultados.
        </p>
      </div>

      <!-- Botón volver -->
      <div class="shrink-0 pt-2">
        <button
          mat-flat-button
          class="!from-primary !h-14 !w-full !rounded-2xl !bg-gradient-to-r to-amber-600 !text-base !font-bold !text-white"
          (click)="volverInicio.emit()"
        >
          <mat-icon class="material-symbols-outlined mr-2">home</mat-icon>
          Volver al inicio
        </button>
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
  `,
})
export class SesionCompletadaComponent {
  @Output() volverInicio = new EventEmitter<void>();

  private registroService = inject(RegistroSesionService);

  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly registros = this.registroService.registrosSesion;

  readonly tiempoFormateado = computed(() => {
    const segundos = this.registroService.tiempoTranscurrido();
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    if (mins > 0) {
      return `${mins} min ${secs > 0 ? secs + 's' : ''}`.trim();
    }
    return `${secs} seg`;
  });

  readonly registrosConNombre = computed(() => {
    const plan = this.registroService.planActivo();
    const regs = this.registros();

    return regs.map((reg) => {
      const item = plan?.items?.find((i) => i.id === reg.plan_item);
      return {
        ...reg,
        nombre: item?.ejercicio?.nombre_ejercicio || 'Ejercicio',
      };
    });
  });

  getDolorColor(dolor: number): string {
    const colores: Record<number, string> = {
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
    return colores[dolor] || '#6b7280';
  }

  getDolorEmoji(dolor: number): string {
    if (dolor <= 2) return '😊';
    if (dolor <= 4) return '🙂';
    if (dolor <= 6) return '😐';
    if (dolor <= 8) return '😣';
    return '😖';
  }

  getDolorIcon(dolor: number): string {
    if (dolor <= 2) return 'sentiment_very_satisfied';
    if (dolor <= 4) return 'sentiment_satisfied';
    if (dolor <= 6) return 'sentiment_neutral';
    if (dolor <= 8) return 'sentiment_dissatisfied';
    return 'sentiment_very_dissatisfied';
  }
}
