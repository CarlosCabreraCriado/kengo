import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';

import { PlanesService } from '../services/planes.service';
import { RutinasService } from '../services/rutinas.service';
import { AppService } from '../services/app.service';
import { Plan, Usuario, EstadoPlan, Rutina, EjercicioRutina } from '../../types/global';
import { environment as env } from '../../environments/environment';

type TabType = 'mis-planes' | 'planes-pacientes' | 'rutinas';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [
    NgClass,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
  ],
  templateUrl: './planes.component.html',
  styleUrl: './planes.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PlanesComponent implements OnInit {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private breakpointObserver = inject(BreakpointObserver);
  planesService = inject(PlanesService);
  rutinasService = inject(RutinasService);
  appService = inject(AppService);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe(['(min-width: 1024px)'])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  // Tab activa
  tabActiva = signal<TabType>('mis-planes');
  tabIndex = signal(0);

  // Usuario y rol
  usuario = computed(() => this.appService.usuario());
  isFisio = computed(() => this.appService.rolUsuario() === 'fisio');

  // Planes
  busqueda = '';
  filtroEstado: 'todos' | EstadoPlan = 'todos';
  planes = computed(() => this.planesService.planes());
  isLoadingPlanes = computed(() => this.planesService.isLoading());
  totalPlanes = computed(() => this.planesService.total());

  // Mis planes (como paciente)
  misPlanes = signal<Plan[]>([]);
  isLoadingMisPlanes = signal(false);

  // Rutinas
  busquedaRutinas = '';
  filtroVisibilidad: 'todas' | 'privadas' | 'publicas' = 'todas';
  rutinas = computed(() => this.rutinasService.rutinas());
  isLoadingRutinas = computed(() => this.rutinasService.isLoading());

  // Preview de ejercicios en rutinas
  expandedRutinaId = signal<number | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  estadoLabels: Record<EstadoPlan, string> = {
    borrador: 'Borrador',
    activo: 'Activo',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  estadoColors: Record<EstadoPlan, string> = {
    borrador: 'bg-zinc-100 text-zinc-600',
    activo: 'bg-green-100 text-green-700',
    completado: 'bg-blue-100 text-blue-700',
    cancelado: 'bg-red-100 text-red-600',
  };

  ngOnInit() {
    // Cargar datos segun el rol inicial
    if (this.isFisio()) {
      this.tabActiva.set('planes-pacientes');
      this.tabIndex.set(1);
      this.planesService.reload();
    } else {
      this.tabActiva.set('mis-planes');
      this.tabIndex.set(0);
      this.cargarMisPlanes();
    }
  }

  onTabChange(index: number) {
    this.tabIndex.set(index);

    // El orden de tabs depende de si el usuario es fisio
    // Fisio: [mis-planes, planes-pacientes, rutinas]
    // Paciente: [mis-planes, rutinas]
    let tab: TabType;
    if (this.isFisio()) {
      const tabs: TabType[] = ['mis-planes', 'planes-pacientes', 'rutinas'];
      tab = tabs[index];
    } else {
      const tabs: TabType[] = ['mis-planes', 'rutinas'];
      tab = tabs[index];
    }

    this.tabActiva.set(tab);

    // Cargar datos segun la tab
    switch (tab) {
      case 'mis-planes':
        this.cargarMisPlanes();
        break;
      case 'planes-pacientes':
        this.planesService.reload();
        break;
      case 'rutinas':
        this.rutinasService.reload();
        break;
    }
  }

  async cargarMisPlanes() {
    const userId = this.usuario()?.id;
    if (!userId) return;

    this.isLoadingMisPlanes.set(true);
    try {
      const planes = await this.planesService.getPlanesByPaciente(userId);
      this.misPlanes.set(planes);
    } finally {
      this.isLoadingMisPlanes.set(false);
    }
  }

  // === Planes de pacientes (fisio) ===
  onBusquedaChange(value: string) {
    this.busqueda = value;
    this.planesService.setBusqueda(value);
  }

  onFiltroEstadoChange(value: 'todos' | EstadoPlan) {
    this.filtroEstado = value;
    this.planesService.setFiltroEstado(value);
  }

  reload() {
    const tab = this.tabActiva();
    if (tab === 'mis-planes') {
      this.cargarMisPlanes();
    } else if (tab === 'planes-pacientes') {
      this.planesService.reload();
    } else {
      this.rutinasService.reload();
    }
  }

  crearNuevoPlan() {
    this.router.navigate(['/mis-pacientes']);
  }

  verResumen(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'resumen']);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'editar']);
  }

  async cambiarEstado(plan: Plan, nuevoEstado: EstadoPlan) {
    const success = await this.planesService.updateEstado(plan.id_plan, nuevoEstado);
    if (success) {
      this.snackBar.open(`Estado cambiado a ${this.estadoLabels[nuevoEstado]}`, 'OK', {
        duration: 2000,
      });
    } else {
      this.snackBar.open('Error al cambiar estado', 'OK', { duration: 3000 });
    }
  }

  getPacienteNombre(plan: Plan): string {
    const p = plan.paciente;
    if (typeof p === 'string') return 'Paciente';
    return `${p.first_name} ${p.last_name}`;
  }

  getFisioNombre(plan: Plan): string {
    const f = plan.fisio;
    if (typeof f === 'string') return 'Fisioterapeuta';
    if (!f) return 'Fisioterapeuta';
    return `${f.first_name} ${f.last_name}`;
  }

  getPacienteAvatar(plan: Plan): string {
    const p = plan.paciente;
    if (typeof p === 'string') return '';
    return (p as Usuario).avatar || '';
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
    this.snackBar.open('Selecciona un paciente para usar esta plantilla', 'OK', {
      duration: 3000,
    });
    this.router.navigate(['/mis-pacientes']);
  }

  async duplicarRutina(rutina: Rutina) {
    const nuevoNombre = `${rutina.nombre} (copia)`;
    const id = await this.rutinasService.duplicarRutina(rutina.id_rutina, nuevoNombre);

    if (id) {
      this.snackBar.open('Plantilla duplicada', 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Error al duplicar', 'OK', { duration: 3000 });
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la plantilla "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id_rutina);
    if (success) {
      this.snackBar.open('Plantilla eliminada', 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Error al eliminar', 'OK', { duration: 3000 });
    }
  }

  async cambiarVisibilidadRutina(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'publico' : 'privado';
    const success = await this.rutinasService.updateRutina(rutina.id_rutina, {
      visibilidad: nuevaVisibilidad,
    });

    if (success) {
      this.snackBar.open(
        `Plantilla ahora es ${nuevaVisibilidad === 'publico' ? 'publica' : 'privada'}`,
        'OK',
        { duration: 2000 }
      );
    } else {
      this.snackBar.open('Error al cambiar visibilidad', 'OK', { duration: 3000 });
    }
  }

  // === Utilidades ===
  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }

  formatDateLong(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  avatarUrl(id: string | null | undefined): string {
    if (!id) return 'assets/default-avatar.png';
    return `${env.DIRECTUS_URL}/assets/${id}?width=60&height=60&fit=cover&format=webp`;
  }

  assetUrl(id: string | null | undefined, w = 60, h = 60): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }
}
