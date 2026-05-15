import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../../ui-v2';
import { VideoEjercicioComponent } from '../video-ejercicio/video-ejercicio.component';
import { EjercicioPlan } from '../../../../types/global';

export interface PreviewEjercicioData {
  ejercicio: EjercicioPlan;
  index: number;
  totalEjercicios: number;
  videoUrl: string | null;
  posterUrl: string | null;
  estado: 'completado' | 'activo' | 'pendiente';
}

@Component({
  selector: 'app-preview-ejercicio-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    VideoEjercicioComponent,
  ],
  template: `
    <ui2-dialog-host variant="standard">
      <ui2-dialog-header
        [title]="data.ejercicio.ejercicio.nombre"
        [subtitle]="
          'Ejercicio ' + (data.index + 1) + ' de ' + data.totalEjercicios
        "
        (closeClick)="dialogRef.close()"
      />

      <ui2-dialog-content [noPadding]="true">
        <!-- Video -->
        <app-video-ejercicio
          [videoUrl]="data.videoUrl"
          [posterUrl]="data.posterUrl"
          [autoplay]="true"
        />

        <!-- Info del ejercicio -->
        <div class="flex flex-col gap-3 p-4">
          <!-- Detalles -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="detail-chip">
              <span class="material-symbols-outlined text-sm">repeat</span>
              {{ data.ejercicio.series ?? 3 }} series
            </span>
            @if (data.ejercicio.duracionSeg) {
              <span class="detail-chip">
                <span class="material-symbols-outlined text-sm">timer</span>
                {{ formatDuracion(data.ejercicio.duracionSeg) }}
              </span>
            } @else {
              <span class="detail-chip">
                <span class="material-symbols-outlined text-sm"
                  >fitness_center</span
                >
                {{ data.ejercicio.repeticiones ?? 12 }} reps
              </span>
            }
            @if (data.ejercicio.descansoSeg) {
              <span class="detail-chip">
                <span class="material-symbols-outlined text-sm">snooze</span>
                {{ data.ejercicio.descansoSeg }}s descanso
              </span>
            }
          </div>

          <!-- Instrucciones del paciente -->
          @if (data.ejercicio.instruccionesPaciente) {
            <div class="rounded-xl bg-zinc-50 p-3">
              <p class="text-xs font-semibold text-zinc-500 mb-1">
                Instrucciones
              </p>
              <p class="text-sm text-zinc-700 leading-relaxed">
                {{ data.ejercicio.instruccionesPaciente }}
              </p>
            </div>
          }

          <!-- Badge de estado -->
          <div class="flex items-center gap-2">
            @switch (data.estado) {
              @case ('completado') {
                <span
                  class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                >
                  <span class="material-symbols-outlined text-sm"
                    >check_circle</span
                  >
                  Completado
                </span>
              }
              @case ('activo') {
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold estado-activo-badge"
                >
                  <span class="material-symbols-outlined text-sm"
                    >play_circle</span
                  >
                  En curso
                </span>
              }
              @case ('pendiente') {
                <span
                  class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500"
                >
                  <span class="material-symbols-outlined text-sm"
                    >schedule</span
                  >
                  Pendiente
                </span>
              }
            }
          </div>
        </div>
      </ui2-dialog-content>
    </ui2-dialog-host>
  `,
  styles: `
    .detail-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 8px;
      background: #f4f4f5;
      font-size: 0.75rem;
      font-weight: 500;
      color: #52525b;
    }

    .estado-activo-badge {
      background: rgba(var(--kengo-primary-rgb), 0.08);
      color: var(--kengo-primary);
    }
  `,
})
export class PreviewEjercicioDialogComponent {
  readonly dialogRef = inject<DialogRef>(DialogRef);
  readonly data = inject<PreviewEjercicioData>(DIALOG_DATA);

  formatDuracion(segundos: number): string {
    if (segundos < 60) {
      return `${segundos}s`;
    }
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }
}
