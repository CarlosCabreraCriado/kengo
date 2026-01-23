import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { slideUpAnimation } from '../../realizar-plan.animations';
import {
  EjercicioPlan,
  EjercicioSesionMultiPlan,
} from '../../../../../../../types/global';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-resumen-sesion',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  animations: [slideUpAnimation],
  template: `
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Header sticky -->
      <header
        class="sticky top-0 z-40 w-full mb-4 bg-gradient-to-b from-white/95 via-white/90 to-transparent pt-4 pb-2 backdrop-blur-md"
      >
        <div class="mx-auto max-w-7xl px-4">
          <div class="flex items-center gap-2">
            <button
              mat-icon-button
              class="!h-10 !w-10 shrink-0"
              aria-label="Volver"
              (click)="volverAtras()"
            >
              <mat-icon class="material-symbols-outlined text-zinc-600"
                >arrow_back</mat-icon
              >
            </button>
            <div class="min-w-0 flex-1">
              <h1 class="m-0 truncate text-xl font-bold text-zinc-800 sm:text-2xl">
                {{ tituloSesion() }}
              </h1>
              <p class="m-0 truncate text-sm text-zinc-500">
                {{ subtitulo() }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <!-- Lista de ejercicios -->
      <div class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pr-5">
        @for (item of ejercicios(); track $index; let i = $index) {
          <div
            class="tarjeta-kengo relative flex shrink-0 items-center gap-3 rounded-2xl p-3.5 transition-transform hover:-translate-y-0.5"
            @slideUp
          >
            <div
              class="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 shadow-md"
            >
              @if (item.ejercicio.portada) {
                <img
                  [src]="getImageUrl(item.ejercicio.portada)"
                  [alt]="item.ejercicio.nombre_ejercicio"
                  class="h-full w-full object-cover transition-transform hover:scale-105"
                />
              } @else {
                <div
                  class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e75c3e] to-[#efc048]"
                >
                  <mat-icon class="material-symbols-outlined text-white"
                    >fitness_center</mat-icon
                  >
                </div>
              }
            </div>

            <div class="min-w-0 flex-1">
              <h3
                class="m-0 mb-1 truncate pr-7 text-sm font-semibold text-zinc-800"
              >
                {{ item.ejercicio.nombre_ejercicio }}
              </h3>
              <div
                class="flex items-center gap-1.5 text-xs font-medium text-zinc-500"
              >
                @if (item.series && item.series > 1) {
                  <span>{{ item.series }} series</span>
                  <span class="font-semibold text-[#e75c3e]">x</span>
                }
                @if (item.duracion_seg) {
                  <span>{{ formatDuracion(item.duracion_seg) }}</span>
                } @else {
                  <span>{{ item.repeticiones || 12 }} reps</span>
                }
              </div>
              <!-- Badge de plan en modo multi-plan -->
              @if (esMultiPlan() && isEjercicioMultiPlan(item)) {
                <div
                  class="mt-1.5 inline-block max-w-full truncate rounded-md bg-zinc-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-zinc-500"
                >
                  {{ getEjercicioMultiPlan(item).planTitulo }}
                </div>
              }
            </div>

            <div
              class="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#e75c3e] to-[#d14d31] text-[0.6875rem] font-bold text-white shadow-md"
            >
              {{ i + 1 }}
            </div>
          </div>
        }
      </div>

      <!-- Contador y boton -->
      <div class="flex shrink-0 flex-col items-center gap-3 px-4 py-3">
        <p
          class="m-0 rounded-2xl bg-white/60 px-4 py-1.5 text-xs font-medium text-zinc-500"
        >
          {{ ejercicios().length }} ejercicios
        </p>

        <button
          mat-flat-button
          color="primary"
          class="!h-14 !w-full !rounded-2xl !text-base !font-bold disabled:!opacity-50"
          (click)="comenzar.emit()"
          [disabled]="ejercicios().length === 0"
        >
          Comenzar sesión
          <mat-icon class="material-symbols-outlined ml-2">play_arrow</mat-icon>
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
export class ResumenSesionComponent {
  @Output() comenzar = new EventEmitter<void>();

  private router = inject(Router);
  private registroService = inject(RegistroSesionService);

  // Titulo dinamico de la sesion
  readonly tituloSesion = this.registroService.tituloSesion;

  // Modo multi-plan
  readonly esMultiPlan = this.registroService.modoMultiPlan;

  // Lista de ejercicios unificada
  readonly ejercicios = this.registroService.ejerciciosList;

  // Subtitulo (nombre del plan o resumen de planes)
  readonly subtitulo = computed(() => {
    if (this.registroService.modoMultiPlan()) {
      const config = this.registroService.configSesion();
      if (!config) return '';
      if (config.planesInvolucrados.length === 1) {
        return config.planesInvolucrados[0].titulo;
      }
      return `${config.planesInvolucrados.length} planes combinados`;
    }
    return this.registroService.planActivo()?.titulo ?? '';
  });

  getImageUrl(id: string): string {
    return this.registroService.getAssetUrl(id, 128, 128);
  }

  formatDuracion(segundos: number): string {
    if (segundos < 60) {
      return `${segundos} seg`;
    }
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }

  // Helpers para tipo multi-plan
  isEjercicioMultiPlan(item: EjercicioPlan): item is EjercicioSesionMultiPlan {
    return 'planId' in item && 'planTitulo' in item;
  }

  getEjercicioMultiPlan(item: EjercicioPlan): EjercicioSesionMultiPlan {
    return item as EjercicioSesionMultiPlan;
  }

  volverAtras(): void {
    this.registroService.resetearEstado();
    this.router.navigate(['/actividad-diaria']);
  }
}
