import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { assetUrl } from '../../../../core/utils/asset-url';

import { RutinasService } from '../../data-access/rutinas.service';
import type { ErrorRutina } from '../../data-access/rutina-error';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { CarritoPointers } from '../../../planes/data-access/internal/carrito-pointers';
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
    // Resetear antes de cargar: si la carga falla no deben quedar los
    // ejercicios de la rutina expandida anteriormente.
    this.previewEjercicios.set([]);
    this.loadingPreview.set(true);

    try {
      const res = await this.rutinasService.getRutinaById(rutina.id);
      if (res.status === 'ok') {
        this.previewEjercicios.set(res.rutina.ejercicios);
      } else {
        this.expandedRutinaId.set(null);
        this.toastService.error(
          res.status === 'no-acceso'
            ? 'No tienes acceso a esta rutina en la clínica activa'
            : 'No se pudo cargar la rutina',
        );
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
    const res = await this.rutinasService.duplicarRutina(rutina.id, nuevoNombre);

    if (res.status === 'ok') {
      this.toastService.success('Rutina duplicada');
    } else {
      this.avisarFallo(res.error, 'No se pudo duplicar la rutina');
    }
  }

  async eliminarRutina(rutina: Rutina) {
    if (!confirm(`¿Eliminar la rutina "${rutina.nombre}"?`)) return;

    const res = await this.rutinasService.deleteRutina(rutina.id);
    if (res.status === 'ok') {
      this.toastService.success('Rutina eliminada');
    } else {
      this.avisarFallo(res.error, 'No se pudo eliminar la rutina');
    }
  }

  async cambiarVisibilidadRutina(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'clinica' : 'privado';
    const res = await this.rutinasService.updateRutina(rutina.id, {
      visibilidad: nuevaVisibilidad,
    });

    if (res.status === 'ok') {
      this.toastService.success(
        nuevaVisibilidad === 'clinica'
          ? 'Rutina compartida con la clínica'
          : 'Rutina ahora es privada',
      );
    } else {
      this.avisarFallo(res.error, 'No se pudo cambiar la visibilidad');
    }
  }

  /**
   * Avisa de un fallo con el motivo real cuando el backend lo da, y con
   * `respaldo` cuando no.
   *
   * Calla si otra capa ya ha avisado: el gate de suscripción abre su propio
   * diálogo desde el interceptor de `ConvexService`, y un toast encima serían
   * dos avisos del mismo hecho.
   */
  private avisarFallo(error: ErrorRutina, respaldo: string): void {
    if (error.kind === 'ya-gestionado') return;
    this.toastService.error(
      error.code === 'DESCONOCIDO' ? respaldo : error.message,
    );
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

    const fisioId = this.planBuilderService.fisioId();
    CarritoPointers.set({
      pacienteId: paciente.id,
      ...(fisioId ? { fisioId } : {}),
    });

    const success = await this.planBuilderService.loadFromRutina(rutina.id);

    if (success) {
      this.planBuilderService.openDrawer();
      this.toastService.success(
        `Rutina "${rutina.nombre}" cargada para ${paciente.first_name}`,
      );
    } else {
      this.toastService.error('No se pudo cargar la rutina');
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
