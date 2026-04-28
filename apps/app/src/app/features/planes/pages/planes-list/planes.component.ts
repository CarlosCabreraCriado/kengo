import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { assetUrl } from '../../../../core/utils/asset-url';

import { PlanesService } from '../../data-access/planes.service';
import { RutinasService } from '../../../rutinas/data-access/rutinas.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { Plan, Usuario, EstadoPlan, Rutina, EjercicioRutina } from '../../../../../types/global';
import {
  useResponsive,
  MenuComponent,
  BackButtonComponent,
  StatusBadgeComponent,
  VisibilityBadgeComponent,
  SkeletonComponent,
  type MenuItem,
} from '../../../../shared';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

type TabType = 'mis-planes' | 'planes-pacientes' | 'rutinas';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    EmptyStateComponent,
    MenuComponent,
    BackButtonComponent,
    StatusBadgeComponent,
    VisibilityBadgeComponent,
    SkeletonComponent,
  ],
  templateUrl: './planes.component.html',
  styleUrl: './planes.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PlanesComponent implements OnInit {
  private router = inject(Router);
  private toastService = inject(ToastService);
  planesService = inject(PlanesService);
  rutinasService = inject(RutinasService);
  sessionService = inject(SessionService);

  isMovil = useResponsive().esMobile;

  // Tab activa
  tabActiva = signal<TabType>('mis-planes');
  tabIndex = signal(0);

  // Usuario y rol
  usuario = computed(() => this.sessionService.usuario());

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
  filtroVisibilidad: 'todas' | 'privadas' | 'clinica' = 'todas';
  rutinas = computed(() => this.rutinasService.rutinas());
  isLoadingRutinas = computed(() => this.rutinasService.isLoading());

  // Preview de ejercicios en rutinas
  expandedRutinaId = signal<string | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  // Menu state for custom dropdowns
  menuEstadoOpen = false;
  openPlanMenuId: string | null = null;
  openRutinaMenuId: string | null = null;

  estadoLabels: Record<EstadoPlan, string> = {
    borrador: 'Borrador',
    activo: 'Activo',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  ngOnInit() {
    // Cargar datos segun el rol inicial
    if (this.sessionService.puedeCrearPlanes()) {
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

    // Fisio: [mis-planes, planes-pacientes, rutinas]
    // Paciente: solo [mis-planes]
    let tab: TabType;
    if (this.sessionService.puedeCrearPlanes()) {
      const tabs: TabType[] = ['mis-planes', 'planes-pacientes', 'rutinas'];
      tab = tabs[index];
    } else {
      tab = 'mis-planes';
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
    this.router.navigate(['/planes', plan.id]);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id, 'editar']);
  }

  async cambiarEstado(plan: Plan, nuevoEstado: EstadoPlan) {
    const success = await this.planesService.updateEstado(plan.id, nuevoEstado);
    if (success) {
      this.toastService.show(`Estado cambiado a ${this.estadoLabels[nuevoEstado]}`);
    } else {
      this.toastService.show('Error al cambiar estado', 'error');
    }
  }

  planMenuItems(plan: Plan): MenuItem[] {
    const items: MenuItem[] = [];
    if (plan.estado !== 'activo') {
      items.push({ id: 'activo', label: 'Marcar activo', icon: 'play_circle' });
    }
    if (plan.estado !== 'completado') {
      items.push({ id: 'completado', label: 'Marcar completado', icon: 'check_circle' });
    }
    if (plan.estado !== 'cancelado') {
      items.push({ id: 'cancelado', label: 'Cancelar plan', icon: 'cancel', danger: true });
    }
    return items;
  }

  onPlanMenuAction(item: MenuItem, plan: Plan) {
    void this.cambiarEstado(plan, item.id as EstadoPlan);
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

  onFiltroVisibilidadChange(value: 'todas' | 'privadas' | 'clinica') {
    this.filtroVisibilidad = value;
    this.rutinasService.setFiltroVisibilidad(value);
  }

  async togglePreview(rutina: Rutina) {
    if (this.expandedRutinaId() === rutina.id) {
      this.expandedRutinaId.set(null);
      this.previewEjercicios.set([]);
      return;
    }

    this.expandedRutinaId.set(rutina.id);
    this.loadingPreview.set(true);

    try {
      const completa = await this.rutinasService.getRutinaById(rutina.id);
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
    const id = await this.rutinasService.duplicarRutina(rutina.id, nuevoNombre);

    if (id) {
      this.toastService.show('Plantilla duplicada');
    } else {
      this.toastService.show('Error al duplicar', 'error');
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la plantilla "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id);
    if (success) {
      this.toastService.show('Plantilla eliminada');
    } else {
      this.toastService.show('Error al eliminar', 'error');
    }
  }

  async cambiarVisibilidadRutina(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'clinica' : 'privado';
    const success = await this.rutinasService.updateRutina(rutina.id, {
      visibilidad: nuevaVisibilidad,
    });

    if (success) {
      this.toastService.show(
        nuevaVisibilidad === 'clinica' ? 'Plantilla compartida con la clínica' : 'Plantilla ahora es privada'
      );
    } else {
      this.toastService.show('Error al cambiar visibilidad', 'error');
    }
  }

  // === Menu helpers ===
  togglePlanMenu(planId: string) {
    this.openPlanMenuId = this.openPlanMenuId === planId ? null : planId;
    this.openRutinaMenuId = null;
  }

  toggleRutinaMenu(rutinaId: string) {
    this.openRutinaMenuId = this.openRutinaMenuId === rutinaId ? null : rutinaId;
    this.openPlanMenuId = null;
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
    return `${assetUrl(id, { width: 60, height: 60, fit: 'cover', format: 'webp' })}`;
  }

  assetUrl(id: string | null | undefined, w = 60, h = 60): string {
    if (!id) return '';
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }
}
