import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { RutinasService } from '../../data-access/rutinas.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ToggleGaleriaComponent } from '../../../../shared/ui/toggle-galeria/toggle-galeria.component';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import { Rutina, EjercicioRutina } from '../../../../../types/global';
import { environment as env } from '../../../../../environments/environment';

@Component({
  selector: 'app-rutinas-list',
  standalone: true,
  imports: [RouterLink, FormsModule, ToggleGaleriaComponent],
  templateUrl: './rutinas-list.component.html',
  styleUrl: './rutinas-list.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class RutinasListComponent {
  private router = inject(Router);
  private toastService = inject(ToastService);
  private breakpointObserver = inject(BreakpointObserver);
  private planBuilderService = inject(PlanBuilderService);
  rutinasService = inject(RutinasService);
  sessionService = inject(SessionService);

  // Detectar si es móvil (< 768px)
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true }
  );

  // Usuario
  usuario = computed(() => this.sessionService.usuario());

  // Rutinas
  busquedaRutinas = '';
  filtroVisibilidad: 'todas' | 'privadas' | 'publicas' = 'todas';
  rutinas = computed(() => this.rutinasService.rutinas());
  isLoadingRutinas = computed(() => this.rutinasService.isLoading());

  // Preview de ejercicios en rutinas
  expandedRutinaId = signal<number | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  // Menu state
  openRutinaMenuId: number | null = null;

  constructor() {
    // Cargar rutinas al iniciar
    this.rutinasService.reload();
  }

  // === Rutinas ===
  onBusquedaRutinasChange(value: string) {
    this.busquedaRutinas = value;
    this.rutinasService.setBusqueda(value);
  }

  onFiltroVisibilidadChange(value: 'todas' | 'privadas' | 'publicas') {
    this.filtroVisibilidad = value;
    this.rutinasService.setFiltroVisibilidad(value);
  }

  reload() {
    this.rutinasService.reload();
  }

  async togglePreview(rutina: Rutina) {
    if (this.expandedRutinaId() === rutina.id_rutina) {
      this.expandedRutinaId.set(null);
      this.previewEjercicios.set([]);
      return;
    }

    this.expandedRutinaId.set(rutina.id_rutina);
    this.loadingPreview.set(true);

    try {
      const completa = await this.rutinasService.getRutinaById(rutina.id_rutina);
      if (completa) {
        this.previewEjercicios.set(completa.ejercicios);
      }
    } finally {
      this.loadingPreview.set(false);
    }
  }

  isOwner(rutina: Rutina): boolean {
    const userId = this.usuario()?.id;
    const autorId = typeof rutina.autor === 'string' ? rutina.autor : rutina.autor?.id;
    return userId === autorId;
  }

  usarPlantilla(rutina: Rutina) {
    this.toastService.show('Selecciona un paciente para usar esta plantilla');
    this.router.navigate(['/mis-pacientes']);
  }

  async duplicarRutina(rutina: Rutina) {
    const nuevoNombre = `${rutina.nombre} (copia)`;
    const id = await this.rutinasService.duplicarRutina(rutina.id_rutina, nuevoNombre);

    if (id) {
      this.toastService.show('Plantilla duplicada');
    } else {
      this.toastService.show('Error al duplicar', 'error');
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la plantilla "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id_rutina);
    if (success) {
      this.toastService.show('Plantilla eliminada');
    } else {
      this.toastService.show('Error al eliminar', 'error');
    }
  }

  async cambiarVisibilidadRutina(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'publico' : 'privado';
    const success = await this.rutinasService.updateRutina(rutina.id_rutina, {
      visibilidad: nuevaVisibilidad,
    });

    if (success) {
      this.toastService.show(
        `Plantilla ahora es ${nuevaVisibilidad === 'publico' ? 'pública' : 'privada'}`
      );
    } else {
      this.toastService.show('Error al cambiar visibilidad', 'error');
    }
  }

  toggleRutinaMenu(rutinaId: number) {
    this.openRutinaMenuId = this.openRutinaMenuId === rutinaId ? null : rutinaId;
  }

  // === Utilidades ===
  formatDateLong(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  assetUrl(id: string | null | undefined, w = 60, h = 60): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }

  // === Crear Rutina ===
  crearRutina() {
    this.planBuilderService.startRutinaMode();
    this.router.navigate(['/galeria/ejercicios']);
  }
}
