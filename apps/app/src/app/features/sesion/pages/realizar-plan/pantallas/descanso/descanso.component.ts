import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { SesionProgressHeaderComponent } from '../../componentes/sesion-progress-header/sesion-progress-header.component';
import { DescansoRespiracionComponent } from '../../componentes/descanso-piezas/descanso-respiracion/descanso-respiracion.component';
import { DescansoProximoComponent } from '../../componentes/descanso-piezas/descanso-proximo/descanso-proximo.component';
import { EjercicioPlan } from '../../../../../../../types/global';
import { Ui2ButtonComponent } from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-descanso',
  standalone: true,
  imports: [
    SesionProgressHeaderComponent,
    DescansoRespiracionComponent,
    DescansoProximoComponent,
    Ui2ButtonComponent,
  ],
  templateUrl: './descanso.component.html',
  styleUrl: './descanso.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescansoComponent {
  @Output() saltar = new EventEmitter<void>();
  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() agregarTiempo = new EventEmitter<number>();
  @Output() salir = new EventEmitter<void>();
  @Output() abrirTimeline = new EventEmitter<void>();
  @Output() previewEjercicio = new EventEmitter<{
    ejercicio: EjercicioPlan;
    index: number;
  }>();

  private readonly registroService = inject(SesionStateService);
  private readonly respiracion = viewChild(DescansoRespiracionComponent);

  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly tiempoDescanso = computed(
    () => this.registroService.ejercicioActual()?.descansoSeg || 45,
  );

  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  readonly esDescansoEntreEjercicios = this.registroService.descansoEntreEjercicios;
  readonly proximoEjercicio = this.registroService.proximoEjercicio;
  readonly proximoEjercicioPortada = computed(() => {
    const portadaId = this.proximoEjercicio()?.ejercicio?.portada;
    return portadaId ? this.registroService.getAssetUrl(portadaId, 96, 96) : null;
  });

  onTiempoAgotado(): void {
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
    this.respiracion()?.agregarTiempo(15);
    this.agregarTiempo.emit(15);
  }
}
