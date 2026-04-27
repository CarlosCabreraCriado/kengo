import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  OnInit,
  ViewChild,
  signal,
  OnDestroy,
} from '@angular/core';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { EjercicioPlan } from '../../../../../../../types/global';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-descanso',
  standalone: true,
  imports: [TemporizadorComponent],
  animations: [fadeAnimation],
  templateUrl: './descanso.component.html',
  styleUrl: './descanso.component.css',
})
export class DescansoComponent implements OnInit, OnDestroy {
  @Output() saltar = new EventEmitter<void>();
  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() agregarTiempo = new EventEmitter<number>();
  @Output() salir = new EventEmitter<void>();
  @Output() abrirTimeline = new EventEmitter<void>();
  @Output() previewEjercicio = new EventEmitter<{
    ejercicio: EjercicioPlan;
    index: number;
  }>();

  @ViewChild('temporizador') temporizador!: TemporizadorComponent;

  private registroService = inject(SesionStateService);
  private breathInterval: ReturnType<typeof setInterval> | null = null;

  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly tiempoDescanso = computed(
    () => this.registroService.ejercicioActual()?.descansoSeg || 45,
  );

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  // Próximo ejercicio (para descanso entre ejercicios)
  readonly esDescansoEntreEjercicios = this.registroService.descansoEntreEjercicios;
  readonly proximoEjercicio = this.registroService.proximoEjercicio;
  readonly proximoEjercicioPortada = computed(() => {
    const portadaId = this.proximoEjercicio()?.ejercicio?.portada;
    return portadaId ? this.registroService.getAssetUrl(portadaId, 96, 96) : null;
  });

  // Estado de la animación de respiración
  readonly breathPhase = signal<'inhale' | 'exhale'>('inhale');

  // Estado de advertencia (últimos 5 segundos)
  readonly isWarning = signal(false);

  ngOnInit(): void {
    // Ciclo de respiración: 4s inhalar, 4s exhalar
    this.breathInterval = setInterval(() => {
      this.breathPhase.update((phase) =>
        phase === 'inhale' ? 'exhale' : 'inhale',
      );
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.breathInterval) {
      clearInterval(this.breathInterval);
    }
  }

  onTick(segundosRestantes: number): void {
    this.isWarning.set(segundosRestantes <= 5 && segundosRestantes > 0);
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    this.tiempoAgotado.emit();
  }

  onPreviewProximo(): void {
    const ejercicio = this.proximoEjercicio();
    if (!ejercicio) return;
    this.previewEjercicio.emit({
      ejercicio,
      index: this.ejercicioActualIndex() + 1,
    });
  }

  onAgregarTiempo(): void {
    if (this.temporizador) {
      this.temporizador.agregarTiempo(15);
    }
    this.agregarTiempo.emit(15);
  }
}
