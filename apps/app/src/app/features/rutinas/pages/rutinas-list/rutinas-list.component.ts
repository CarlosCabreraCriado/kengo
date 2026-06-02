import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { assetUrl } from '../../../../core/utils/asset-url';

import { RutinasService } from '../../data-access/rutinas.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { RutinaBuilderService } from '../../data-access/rutina-builder.service';
import { useResponsive } from '../../../../shared';
import {
  Ui2ButtonComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2SearchBoxComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';
import { Rutina, EjercicioRutina, Usuario } from '../../../../../types/global';

type FiltroVisibilidad = 'todas' | 'privadas' | 'clinica';

interface OpcionFiltro {
  value: FiltroVisibilidad;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-rutinas-list',
  standalone: true,
  imports: [
    NgOptimizedImage,
    Ui2ButtonComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SearchBoxComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './rutinas-list.component.html',
  styleUrl: './rutinas-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutinasListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private toastService = inject(ToastService);
  private planBuilderService = inject(PlanBuilderService);
  private rutinaBuilderService = inject(RutinaBuilderService);
  private dialog = inject(Dialog);
  private pageLoader = inject(PageLoaderService);
  private destroyRef = inject(DestroyRef);
  private readonly PAGE_LOADER_KEY = 'rutinas-list';
  rutinasService = inject(RutinasService);
  sessionService = inject(SessionService);

  /** Datos críticos: lista de rutinas resuelta. */
  readonly pageReady = computed(() => !this.rutinasService.isLoading());

  isMovil = useResponsive().esMobile;

  // Usuario
  usuario = computed(() => this.sessionService.usuario());

  // Tabs catálogo Ejercicios/Rutinas
  readonly catalogoTabs: Ui2SegmentedOption[] = [
    { id: 'ejercicios', label: 'Ejercicios' },
    { id: 'rutinas', label: 'Rutinas' },
  ];

  // Rutinas
  readonly filtroVisibilidad = signal<FiltroVisibilidad>('todas');
  rutinas = computed(() => this.rutinasService.rutinas());
  isLoadingRutinas = computed(() => this.rutinasService.isLoading());

  // Preview de ejercicios en rutinas
  expandedRutinaId = signal<string | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  // Menu state
  openRutinaMenuId = signal<string | null>(null);
  filtroMenuAbierto = signal(false);

  // Opciones del filtro de visibilidad (dropdown V2)
  readonly opcionesFiltro: OpcionFiltro[] = [
    { value: 'todas',    label: 'Todas las rutinas', icon: 'view_list' },
    { value: 'privadas', label: 'Solo privadas',     icon: 'lock' },
    { value: 'clinica',  label: 'De mi clínica',     icon: 'domain' },
  ];

  readonly hayFiltroActivo = computed(() => this.filtroVisibilidad() !== 'todas');

  constructor() {
    // Cargar rutinas al iniciar
    this.rutinasService.reload();
  }

  ngOnInit(): void {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // No cerrar si el click viene de un trigger o de dentro de un menú abierto
    if (
      target.closest('.rl-filter-menu, .rl-filter-trigger, .rl-action-menu, .rl-card__menu-btn')
    ) {
      return;
    }
    this.filtroMenuAbierto.set(false);
    this.openRutinaMenuId.set(null);
  }

  // === Tabs ===
  onCatalogoTabChange(value: string) {
    if (value === 'ejercicios') {
      this.router.navigate(['/ejercicios']);
    }
  }

  // === Rutinas ===
  onBusquedaRutinasChange(value: string) {
    this.rutinasService.setBusqueda(value);
  }

  onFiltroVisibilidadChange(value: FiltroVisibilidad) {
    this.filtroVisibilidad.set(value);
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

  async duplicarRutina(rutina: Rutina) {
    const nuevoNombre = `${rutina.nombre} (copia)`;
    const id = await this.rutinasService.duplicarRutina(rutina.id, nuevoNombre);

    if (id) {
      this.toastService.show('Rutina duplicada');
    } else {
      this.toastService.show('Error al duplicar', 'error');
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la rutina "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id);
    if (success) {
      this.toastService.show('Rutina eliminada');
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
        nuevaVisibilidad === 'clinica'
          ? 'Rutina compartida con la clínica'
          : 'Rutina ahora es privada',
      );
    } else {
      this.toastService.show('Error al cambiar visibilidad', 'error');
    }
  }

  editarRutina(rutina: Rutina) {
    this.router.navigate(['/rutinas', rutina.id, 'editar']);
  }

  toggleRutinaMenu(rutinaId: string) {
    this.openRutinaMenuId.update((current) => (current === rutinaId ? null : rutinaId));
  }

  toggleFiltroMenu() {
    this.filtroMenuAbierto.update((v) => !v);
  }

  cerrarFiltroMenu() {
    this.filtroMenuAbierto.set(false);
  }

  limpiarFiltro() {
    this.filtroVisibilidad.set('todas');
    this.rutinasService.setFiltroVisibilidad('todas');
  }

  // === Pill helpers para visibilidad ===
  visibilidadLabel(v: 'privado' | 'clinica'): string {
    return v === 'privado' ? 'Privada' : 'Clínica';
  }

  visibilidadIcon(v: 'privado' | 'clinica'): string {
    return v === 'privado' ? 'lock' : 'domain';
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
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }

  // === Asignar a Paciente ===
  async asignarAPaciente(rutina: Rutina) {
    const paciente = await this.seleccionarPaciente();
    if (!paciente) return;

    this.planBuilderService.paciente.set(paciente);

    localStorage.setItem('carrito:last_paciente_id', paciente.id);
    const fisioId = this.planBuilderService.fisioId();
    if (fisioId) {
      localStorage.setItem('carrito:last_fisio_id', fisioId);
    }

    const success = await this.planBuilderService.loadFromRutina(rutina.id);

    if (success) {
      this.planBuilderService.openDrawer();
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
      dialogRef.closed
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((paciente) => {
          resolve(paciente || null);
        });
    });
  }

  // === Crear Rutina ===
  crearRutina() {
    this.rutinaBuilderService.start();
    this.router.navigate(['/ejercicios']);
  }
}
