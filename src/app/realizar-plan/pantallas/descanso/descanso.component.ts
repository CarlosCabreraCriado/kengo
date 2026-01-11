import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-descanso',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    TemporizadorComponent,
  ],
  animations: [fadeAnimation],
  template: `
    <div
      class="relative flex flex-1 flex-col items-center justify-between gap-5 overflow-hidden py-4 text-center"
    >
      <!-- Botón salir - superior izquierda -->
      <button
        class="absolute top-5 left-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/40 shadow-md ring-1 ring-[#e75c3e]/20 backdrop-blur-md transition-colors hover:bg-white/60"
        (click)="salir.emit()"
      >
        <mat-icon class="material-symbols-outlined !text-[22px] !text-[#e75c3e]"
          >close</mat-icon
        >
      </button>

      <!-- Header -->
      <div class="flex shrink-0 flex-col gap-2" @fade>
        <h2 class="m-0 text-2xl font-bold text-zinc-800">Descanso</h2>
        <p class="m-0 text-sm font-medium text-zinc-500">
          Prepárate para la siguiente serie
        </p>
        <!-- Indicador de progreso -->
        <div class="flex items-center justify-center gap-3 pt-1">
          <span class="text-sm font-bold text-zinc-700">
            {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
          </span>
          <div class="h-2 w-24 overflow-hidden rounded-full bg-[#e75c3e]/15">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#e75c3e] to-[#efc048] transition-all duration-300"
              [style.width.%]="progresoSesion()"
            ></div>
          </div>
        </div>
      </div>

      <!-- Timer -->
      <div
        class="timer-wrapper flex min-h-0 flex-1 items-center justify-center"
      >
        <app-temporizador
          #temporizador
          [tiempoInicial]="tiempoDescanso()"
          [autoIniciar]="true"
          label="segundos"
          [umbralAdvertencia]="5"
          (tiempoAgotado)="onTiempoAgotado()"
        />
      </div>

      <!-- Info próxima serie -->
      <div class="shrink-0" @fade>
        <div
          class="flex flex-col gap-1.5 rounded-2xl bg-white/70 px-9 py-4 shadow-sm ring-1 ring-[#e75c3e]/15 backdrop-blur-sm"
        >
          <span
            class="text-xs font-semibold tracking-widest text-zinc-400 uppercase"
            >Próxima</span
          >
          <span
            class="bg-gradient-to-br from-[#e75c3e] to-[#d14d31] bg-clip-text text-xl font-bold text-transparent"
          >
            Serie {{ serieActual() }} de {{ totalSeries() }}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex w-full max-w-xs shrink-0 flex-col gap-2.5">
        <button
          mat-stroked-button
          class="!h-12 !w-full !rounded-xl !border-[#e75c3e] !text-sm !font-semibold !text-zinc-700 hover:!bg-[#e75c3e]/10 hover:!text-[#e75c3e]"
          (click)="onAgregarTiempo()"
        >
          <mat-icon class="material-symbols-outlined mr-1">add</mat-icon>
          15 segundos
        </button>

        <button
          mat-flat-button
          color="primary"
          class="!h-14 !w-full !rounded-2xl !text-base !font-bold"
          (click)="saltar.emit()"
        >
          Saltar descanso
          <mat-icon class="material-symbols-outlined ml-2"
            >arrow_forward</mat-icon
          >
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

    /* Timer adaptable - crece con el espacio disponible */
    .timer-wrapper {
      container-type: size;
    }

    .timer-wrapper ::ng-deep .timer-container {
      width: clamp(14rem, 50cqmin, 18rem);
      height: auto;
      aspect-ratio: 1;
    }

    .timer-wrapper ::ng-deep .timer-value {
      font-size: clamp(1.75rem, 28cqh, 3.5rem);
    }

    .timer-wrapper ::ng-deep .timer-label {
      font-size: clamp(0.5rem, 10cqh, 0.85rem);
    }
  `,
})
export class DescansoComponent implements OnInit {
  @Output() saltar = new EventEmitter<void>();
  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() agregarTiempo = new EventEmitter<number>();
  @Output() salir = new EventEmitter<void>();

  @ViewChild('temporizador') temporizador!: TemporizadorComponent;

  private registroService = inject(RegistroSesionService);

  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly tiempoDescanso = computed(
    () => this.registroService.ejercicioActual()?.descanso_seg || 45,
  );

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  ngOnInit(): void {
    // El temporizador se inicia automáticamente
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    this.tiempoAgotado.emit();
  }

  onAgregarTiempo(): void {
    if (this.temporizador) {
      this.temporizador.agregarTiempo(15);
    }
    this.agregarTiempo.emit(15);
  }
}
