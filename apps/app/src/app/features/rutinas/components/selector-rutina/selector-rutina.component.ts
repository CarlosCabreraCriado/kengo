import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';

import { RutinasService } from '../../data-access/rutinas.service';
import { Rutina, RutinaCompleta } from '../../../../../types/global';
import { environment as env } from '../../../../../environments/environment';

@Component({
  selector: 'app-selector-rutina',
  standalone: true,
  imports: [
    FormsModule,
  ],
  template: `
    <div class="selector-rutina-container">
      <header class="dialog-header">
        <span class="material-symbols-outlined text-2xl text-orange-500">folder_open</span>
        <h2 class="dialog-title">Seleccionar rutina</h2>
        <button type="button" class="close-btn" (click)="cerrar()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div class="dialog-content">
      <!-- Search and filters -->
      <div class="mb-4 flex flex-col gap-3 sm:flex-row">
        <div class="flex-1">
          <div class="relative">
            <input
              type="text"
              [(ngModel)]="busqueda"
              (ngModelChange)="onBusquedaChange($event)"
              placeholder="Nombre de la rutina..."
              class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-10 text-base transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          </div>
        </div>

        <select
          [(ngModel)]="filtro"
          (ngModelChange)="onFiltroChange($event)"
          class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-40"
        >
          <option value="todas">Todas</option>
          <option value="privadas">Mis rutinas</option>
          <option value="publicas">Públicas</option>
        </select>
      </div>

      @if (rutinasService.isLoading()) {
        <div class="h-1 w-full overflow-hidden rounded-full bg-gray-200">
          <div class="h-full w-1/3 animate-[shimmer_1.5s_infinite] bg-primary"></div>
        </div>
      }

      <!-- Rutinas list -->
      @if (rutinas().length === 0 && !rutinasService.isLoading()) {
        <div class="py-8 text-center">
          <span class="material-symbols-outlined text-5xl text-zinc-300">
            folder_off
          </span>
          <p class="mt-2 text-zinc-500">No se encontraron rutinas</p>
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
                <span
                  class="material-symbols-outlined flex-shrink-0"
                  [class.text-zinc-300]="rutina.visibilidad === 'privado'"
                  [class.text-amber-500]="rutina.visibilidad === 'clinica'"
                >
                  {{ rutina.visibilidad === 'privado' ? 'lock' : 'domain' }}
                </span>
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
            <div class="h-1 w-full overflow-hidden rounded-full bg-gray-200">
              <div class="h-full w-1/3 animate-[shimmer_1.5s_infinite] bg-primary"></div>
            </div>
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
      </div>

      <footer class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="cerrar()">Cancelar</button>
        <button
          type="button"
          class="btn-confirm"
          [disabled]="!selectedId()"
          (click)="confirmar()"
        >
          <span class="material-symbols-outlined">check</span>
          Usar rutina
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .selector-rutina-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      margin: auto;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(20px);
      border-radius: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    .dialog-title {
      flex: 1;
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #27272a;
    }
    .close-btn {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #71717a;
      cursor: pointer;
    }
    .close-btn:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.5rem;
      max-height: 60vh;
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    .btn-cancel {
      padding: 0.625rem 1rem;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 0.5rem;
      background: transparent;
      color: #52525b;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-cancel:hover {
      background: rgba(0, 0, 0, 0.04);
    }
    .btn-confirm {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: #f97316;
      color: white;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-confirm:hover:not(:disabled) {
      background: #ea580c;
    }
    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
  `],
})
export class SelectorRutinaComponent implements OnInit {
  private dialogRef = inject(DialogRef<number>);
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

  onFiltroChange(value: 'todas' | 'privadas' | 'clinica') {
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
    const id = this.selectedId();
    if (id) {
      this.dialogRef.close(id);
    }
  }

  cerrar() {
    this.dialogRef.close();
  }

  assetUrl(id: string | null | undefined): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=80&height=80&fit=cover&format=webp`;
  }
}
