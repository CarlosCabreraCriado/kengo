import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';

import { RutinasService } from '../services/rutinas.service';
import { Rutina, RutinaCompleta } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-selector-rutina',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title class="!flex items-center gap-2">
      <mat-icon class="material-symbols-outlined text-orange-500">folder_open</mat-icon>
      Seleccionar plantilla
    </h2>

    <mat-dialog-content class="!max-h-[60vh]">
      <!-- Search and filters -->
      <div class="mb-4 flex flex-col gap-3 sm:flex-row">
        <mat-form-field appearance="outline" class="flex-1">
          <mat-label>Buscar</mat-label>
          <input
            matInput
            [(ngModel)]="busqueda"
            (ngModelChange)="onBusquedaChange($event)"
            placeholder="Nombre de la plantilla..."
          />
          <mat-icon matSuffix class="material-symbols-outlined">search</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full sm:w-40">
          <mat-label>Filtrar</mat-label>
          <mat-select [(ngModel)]="filtro" (ngModelChange)="onFiltroChange($event)">
            <mat-option value="todas">Todas</mat-option>
            <mat-option value="privadas">Mis plantillas</mat-option>
            <mat-option value="publicas">Publicas</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (rutinasService.isLoading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- Rutinas list -->
      @if (rutinas().length === 0 && !rutinasService.isLoading()) {
        <div class="py-8 text-center">
          <mat-icon class="material-symbols-outlined !text-5xl text-zinc-300">
            folder_off
          </mat-icon>
          <p class="mt-2 text-zinc-500">No se encontraron plantillas</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (rutina of rutinas(); track rutina.id_rutina) {
            <button
              type="button"
              class="w-full rounded-lg border p-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50"
              [class.!border-orange-500]="selectedId() === rutina.id_rutina"
              [class.!bg-orange-50]="selectedId() === rutina.id_rutina"
              (click)="selectRutina(rutina)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium text-zinc-800">{{ rutina.nombre }}</h4>
                  @if (rutina.descripcion) {
                    <p class="mt-1 text-sm text-zinc-500 line-clamp-2">
                      {{ rutina.descripcion }}
                    </p>
                  }
                </div>
                <mat-icon
                  class="material-symbols-outlined flex-shrink-0"
                  [class.text-zinc-300]="rutina.visibilidad === 'privado'"
                  [class.text-green-500]="rutina.visibilidad === 'publico'"
                >
                  {{ rutina.visibilidad === 'privado' ? 'lock' : 'public' }}
                </mat-icon>
              </div>
            </button>
          }
        </div>
      }

      <!-- Preview -->
      @if (selectedRutina(); as rutina) {
        <div class="mt-4 rounded-lg bg-zinc-50 p-4">
          <h4 class="mb-2 text-sm font-semibold text-zinc-700">
            Vista previa: {{ rutina.nombre }}
          </h4>

          @if (isLoadingPreview()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          } @else if (previewEjercicios().length > 0) {
            <div class="space-y-2">
              @for (ej of previewEjercicios(); track ej.id; let i = $index) {
                <div class="flex items-center gap-2 text-sm">
                  <div class="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-zinc-200">
                    @if (ej.ejercicio.portada) {
                      <img
                        [src]="assetUrl(ej.ejercicio.portada)"
                        class="h-full w-full object-cover"
                      />
                    }
                  </div>
                  <span class="text-zinc-600">
                    {{ i + 1 }}. {{ ej.ejercicio.nombre_ejercicio }}
                  </span>
                  <span class="text-xs text-zinc-400">
                    ({{ ej.series || 3 }}x{{ ej.repeticiones || 12 }})
                  </span>
                </div>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        [disabled]="!selectedId()"
        (click)="confirmar()"
        class="!bg-orange-500 !text-white"
      >
        <mat-icon class="material-symbols-outlined">check</mat-icon>
        Usar plantilla
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class SelectorRutinaComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<SelectorRutinaComponent>);
  rutinasService = inject(RutinasService);

  busqueda = '';
  filtro: 'todas' | 'privadas' | 'publicas' = 'todas';

  selectedId = signal<number | null>(null);
  selectedRutina = signal<Rutina | null>(null);
  isLoadingPreview = signal(false);
  previewEjercicios = signal<RutinaCompleta['ejercicios']>([]);

  rutinas = computed(() => this.rutinasService.rutinas());

  ngOnInit() {
    // Cargar rutinas
    this.rutinasService.reload();
  }

  onBusquedaChange(value: string) {
    this.rutinasService.setBusqueda(value);
  }

  onFiltroChange(value: 'todas' | 'privadas' | 'publicas') {
    this.rutinasService.setFiltroVisibilidad(value);
  }

  async selectRutina(rutina: Rutina) {
    this.selectedId.set(rutina.id_rutina);
    this.selectedRutina.set(rutina);

    // Cargar preview
    this.isLoadingPreview.set(true);
    try {
      const completa = await this.rutinasService.getRutinaById(rutina.id_rutina);
      if (completa) {
        this.previewEjercicios.set(completa.ejercicios);
      }
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  confirmar() {
    if (this.selectedId()) {
      this.dialogRef.close(this.selectedId());
    }
  }

  assetUrl(id: string | null | undefined): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=80&height=80&fit=cover&format=webp`;
  }
}
