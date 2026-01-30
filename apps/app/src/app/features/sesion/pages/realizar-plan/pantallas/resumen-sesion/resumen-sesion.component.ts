import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import {
  EjercicioPlan,
  EjercicioSesionMultiPlan,
} from '../../../../../../../types/global';

@Component({
  selector: 'app-resumen-sesion',
  standalone: true,
  imports: [],
  templateUrl: './resumen-sesion.component.html',
  styleUrl: './resumen-sesion.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 overflow-hidden',
  },
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

  // Planes involucrados para mostrar en multi-plan
  readonly planesInvolucrados = computed(() => {
    if (this.registroService.modoMultiPlan()) {
      const config = this.registroService.configSesion();
      return config?.planesInvolucrados ?? [];
    }
    return [];
  });

  // Total de series
  readonly totalSeries = computed(() => {
    return this.ejercicios().reduce((total, item) => {
      return total + (item.series ?? 3);
    }, 0);
  });

  // Tiempo estimado de la sesión
  readonly tiempoEstimado = computed(() => {
    const ejerciciosList = this.ejercicios();
    let totalSegundos = 0;

    for (const item of ejerciciosList) {
      const series = item.series ?? 3;
      const descanso = item.descanso_seg ?? 60;

      if (item.duracion_seg) {
        // Ejercicio por tiempo
        totalSegundos += item.duracion_seg * series;
      } else {
        // Ejercicio por repeticiones - estimar ~3 seg por rep
        const reps = item.repeticiones ?? 12;
        totalSegundos += reps * 3 * series;
      }

      // Agregar descanso entre series (menos en la última)
      totalSegundos += descanso * (series - 1);
    }

    // Convertir a minutos
    const minutos = Math.round(totalSegundos / 60);

    if (minutos < 60) {
      return `${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
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
    this.router.navigate(['/actividad-personal']);
  }
}
