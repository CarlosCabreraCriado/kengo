import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { RutinasService } from '../../data-access/rutinas.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ToggleGaleriaComponent } from '../../../../shared/ui/toggle-galeria/toggle-galeria.component';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import { Rutina, EjercicioRutina, Usuario } from '../../../../../types/global';
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
  private dialog = inject(Dialog);
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
  filtroVisibilidad: 'todas' | 'privadas' | 'clinica' = 'todas';
  rutinas = computed(() => this.rutinasService.rutinas());
  isLoadingRutinas = computed(() => this.rutinasService.isLoading());

  // Preview de ejercicios en rutinas
  expandedRutinaId = signal<number | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  // Menu state
  openRutinaMenuId: number | null = null;
  filtroMenuAbierto = signal(false);

  // Opciones del filtro de visibilidad
  opcionesFiltro = [
    { value: 'todas' as const, label: 'Todas las rutinas', icon: 'view_list' },
    { value: 'privadas' as const, label: 'Solo privadas', icon: 'lock' },
    { value: 'clinica' as const, label: 'De mi clínica', icon: 'domain' },
  ];

  constructor() {
    // Cargar rutinas al iniciar
    this.rutinasService.reload();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.filtroMenuAbierto.set(false);
  }

  // === Rutinas ===
  onBusquedaRutinasChange(value: string) {
    this.busquedaRutinas = value;
    this.rutinasService.setBusqueda(value);
  }

  onFiltroVisibilidadChange(value: 'todas' | 'privadas' | 'clinica') {
    this.filtroVisibilidad = value;
    this.rutinasService.setFiltroVisibilidad(value);
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
    this.toastService.show('Selecciona un paciente para usar esta rutina');
    this.router.navigate(['/mis-pacientes']);
  }

  async duplicarRutina(rutina: Rutina) {
    const nuevoNombre = `${rutina.nombre} (copia)`;
    const id = await this.rutinasService.duplicarRutina(rutina.id_rutina, nuevoNombre);

    if (id) {
      this.toastService.show('Rutina duplicada');
    } else {
      this.toastService.show('Error al duplicar', 'error');
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la rutina "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id_rutina);
    if (success) {
      this.toastService.show('Rutina eliminada');
    } else {
      this.toastService.show('Error al eliminar', 'error');
    }
  }

  async cambiarVisibilidadRutina(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'clinica' : 'privado';
    const success = await this.rutinasService.updateRutina(rutina.id_rutina, {
      visibilidad: nuevaVisibilidad,
    });

    if (success) {
      this.toastService.show(
        nuevaVisibilidad === 'clinica'
          ? 'Rutina compartida con la clínica'
          : 'Rutina ahora es privada'
      );
    } else {
      this.toastService.show('Error al cambiar visibilidad', 'error');
    }
  }

  toggleRutinaMenu(rutinaId: number) {
    this.openRutinaMenuId = this.openRutinaMenuId === rutinaId ? null : rutinaId;
  }

  toggleFiltroMenu() {
    this.filtroMenuAbierto.update((v) => !v);
  }

  cerrarFiltroMenu() {
    this.filtroMenuAbierto.set(false);
  }

  limpiarFiltro() {
    this.filtroVisibilidad = 'todas';
    this.rutinasService.setFiltroVisibilidad('todas');
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

  // === Asignar a Paciente ===
  async asignarAPaciente(rutina: Rutina) {
    // 1. Abrir diálogo de selección de paciente
    const paciente = await this.seleccionarPaciente();
    if (!paciente) return; // Usuario canceló

    // 2. Establecer paciente en PlanBuilderService
    this.planBuilderService.paciente.set(paciente);

    // 3. Guardar en localStorage para persistencia
    localStorage.setItem('carrito:last_paciente_id', paciente.id);
    const fisioId = this.planBuilderService.fisioId();
    if (fisioId) {
      localStorage.setItem('carrito:last_fisio_id', fisioId);
    }

    // 4. Cargar ejercicios de la rutina en el carrito
    const success = await this.planBuilderService.loadFromRutina(rutina.id_rutina);

    if (success) {
      // 5. Abrir el drawer del carrito
      this.planBuilderService.openDrawer();
      // 6. Mostrar notificación de éxito
      this.toastService.show(`Rutina "${rutina.nombre}" cargada para ${paciente.first_name}`);
    } else {
      this.toastService.show('Error al cargar la rutina', 'error');
    }
  }

  private async seleccionarPaciente(): Promise<Usuario | null> {
    const { SelectorPacienteComponent } = await import(
      '../../../../shared/ui/selector-paciente/selector-paciente.component'
    );

    const dialogRef = this.dialog.open<Usuario>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });

    return new Promise((resolve) => {
      dialogRef.closed.subscribe((paciente) => {
        resolve(paciente || null);
      });
    });
  }

  // === Crear Rutina ===
  crearRutina() {
    this.planBuilderService.startRutinaMode();
    this.router.navigate(['/galeria/ejercicios']);
  }
}
