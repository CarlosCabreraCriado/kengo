import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EffectRef,
  Injector,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { filter } from 'rxjs/operators';

import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
} from '../../../../shared/ui-v2';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { assetUrl } from '../../../../core/utils/asset-url';
import { Usuario } from '../../../../../types/global';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { RutinaBuilderService } from '../../../rutinas/data-access/rutina-builder.service';

@Component({
  selector: 'ui2-carrito-ejercicios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgOptimizedImage,
    Ui2AvatarComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
  ],
  templateUrl: './carrito-ejercicios-v2.component.html',
  styleUrls: ['./carrito-ejercicios-v2.component.css'],
})
export class Ui2CarritoEjerciciosComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(Dialog);

  readonly svc = inject(PlanBuilderService);
  readonly rutinaSvc = inject(RutinaBuilderService);

  readonly isRutinaMode = computed(() => this.rutinaSvc.isActive());
  readonly isEditMode = computed(() => this.svc.isEditMode());

  readonly drawerAbierto = signal(false);
  readonly ocultarTab = signal(false);

  readonly pacienteNombre = computed(() => {
    const p = this.svc.paciente();
    return p ? `${p.first_name} ${p.last_name}` : 'Paciente no seleccionado';
  });

  readonly items = computed(() =>
    this.rutinaSvc.isActive() ? this.rutinaSvc.items() : this.svc.items(),
  );

  readonly total = computed(() =>
    this.rutinaSvc.isActive() ? this.rutinaSvc.totalItems() : this.svc.totalItems(),
  );

  readonly perfilUrl = computed(() => {
    const avatar = this.svc.paciente()?.avatar;
    if (!avatar) return null;
    return assetUrl(avatar, { fit: 'cover', width: 120, height: 120, quality: 80 });
  });

  readonly tabLabel = computed(() => (this.isRutinaMode() ? 'Rutina' : 'Asignar'));

  readonly headerTitle = computed(() => {
    if (this.isRutinaMode()) return 'Nueva rutina';
    return this.isEditMode() ? 'Editando plan' : 'Plan de ejercicios';
  });

  readonly subjectSubtitle = computed(() => {
    const n = this.total();
    return `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'} seleccionados`;
  });

  readonly canConfigurarPlan = computed(
    () => !!this.svc.paciente() && this.items().length > 0,
  );

  readonly canGuardarRutina = computed(() => this.items().length > 0);

  private drawerEff!: EffectRef;

  ngAfterViewInit(): void {
    this.drawerEff = effect(
      () => {
        const shouldOpen = this.rutinaSvc.isActive()
          ? this.rutinaSvc.drawerOpen()
          : this.svc.drawerOpen();
        this.drawerAbierto.set(shouldOpen);
      },
      { injector: this.injector },
    );

    this.checkRouteForTab(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkRouteForTab((event as NavigationEnd).urlAfterRedirects);
      });

    this.rutinaSvc.tryRestore();

    if (!this.rutinaSvc.isActive()) {
      const lastPacienteId = localStorage.getItem('carrito:last_paciente_id');
      const lastFisioId = localStorage.getItem('carrito:last_fisio_id');
      if (lastPacienteId && lastFisioId) {
        this.svc.tryRestoreFor(lastPacienteId, lastFisioId);
      }
    }
  }

  ngOnDestroy(): void {
    this.drawerEff?.destroy();
  }

  private checkRouteForTab(url: string): void {
    this.ocultarTab.set(
      url.startsWith('/planes') || url.startsWith('/rutinas/nueva'),
    );
  }

  toggle(): void {
    const target = this.rutinaSvc.isActive() ? this.rutinaSvc : this.svc;
    if (this.drawerAbierto()) {
      target.closeDrawer();
    } else {
      target.openDrawer();
    }
  }

  cerrar(): void {
    const target = this.rutinaSvc.isActive() ? this.rutinaSvc : this.svc;
    target.closeDrawer();
  }

  eliminar(ejercicioId: string): void {
    if (this.rutinaSvc.isActive()) {
      this.rutinaSvc.remove(ejercicioId);
    } else {
      this.svc.removeEjercicio(ejercicioId);
    }
  }

  eliminarAsignacion(): void {
    localStorage.removeItem('carrito:last_paciente_id');
    localStorage.removeItem('carrito:last_fisio_id');
    this.svc.resetAll();
    this.toastService.show('Asignación eliminada');
  }

  async cambiarPaciente(): Promise<void> {
    const { SelectorPacienteComponent } = await import(
      '../../../../shared/ui/selector-paciente/selector-paciente.component'
    );

    const dialogRef = this.dialog.open<Usuario>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });

    dialogRef.closed.subscribe((paciente) => {
      if (paciente) {
        this.svc.paciente.set(paciente);
        localStorage.setItem('carrito:last_paciente_id', paciente.id);
        const fisioId = this.svc.fisioId();
        if (fisioId) {
          localStorage.setItem('carrito:last_fisio_id', fisioId);
        }
        this.toastService.show(
          `Paciente cambiado a ${paciente.first_name} ${paciente.last_name}`,
        );
      }
    });
  }

  irAEjercicios(): void {
    this.cerrar();
    setTimeout(() => {
      this.router.navigate(['/ejercicios']);
    }, 100);
  }

  async configurarPlan(): Promise<void> {
    if (!this.svc.paciente()) {
      this.toastService.show('Selecciona un paciente primero.');
      return;
    }
    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios al plan.');
      return;
    }

    if (this.svc.isEditMode()) {
      await this.router.navigate(['/planes', this.svc.planId(), 'editar']);
    } else {
      const id = this.svc.paciente()!.id;
      await this.router.navigate(['/planes/nuevo'], {
        queryParams: { paciente: id },
      });
    }

    this.svc.closeDrawer();
  }

  async cargarRutina(): Promise<void> {
    if (!this.isRutinaMode() && !this.svc.paciente()) {
      this.toastService.show('Selecciona un paciente primero.');
      return;
    }

    const { SelectorRutinaComponent } = await import(
      '../../../rutinas/components/selector-rutina/selector-rutina.component'
    );

    const dialogRef = this.dialog.open<string>(SelectorRutinaComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'selector-rutina-dialog',
    });

    dialogRef.closed.subscribe(async (rutinaId) => {
      if (rutinaId) {
        const success = this.rutinaSvc.isActive()
          ? await this.rutinaSvc.loadFromRutina(rutinaId)
          : await this.svc.loadFromRutina(rutinaId);
        if (success) {
          this.toastService.show('Rutina cargada correctamente');
        } else {
          this.toastService.show('Error al cargar la rutina', 'error');
        }
      }
    });
  }

  salirModoRutina(): void {
    this.rutinaSvc.exit();
    this.router.navigate(['/rutinas']);
  }

  configurarRutina(): void {
    if (this.items().length === 0) {
      this.toastService.show('Añade ejercicios primero.');
      return;
    }
    this.cerrar();
    this.router.navigate(['/rutinas/nueva']);
  }

  async guardarRutinaDirectamente(): Promise<void> {
    if (this.items().length === 0) {
      this.toastService.show('Añade ejercicios primero.');
      return;
    }

    const { DialogoGuardarRutinaComponent } = await import(
      '../../../rutinas/components/dialogo-guardar-rutina/dialogo-guardar-rutina.component'
    );

    const dialogRef = this.dialog.open(DialogoGuardarRutinaComponent, {
      width: '400px',
      data: { nombreSugerido: '' },
    });

    dialogRef.closed.subscribe(async (result) => {
      const data = result as
        | { nombre: string; descripcion: string; visibilidad: 'privado' | 'clinica' }
        | undefined;
      if (data) {
        const rutinaId = this.rutinaSvc.isActive()
          ? await this.rutinaSvc.save(data.nombre, data.descripcion, data.visibilidad)
          : await this.svc.saveAsRutina(data.nombre, data.descripcion, data.visibilidad);

        if (rutinaId) {
          this.toastService.show('Rutina guardada');
          if (this.rutinaSvc.isActive()) this.rutinaSvc.exit();
          this.router.navigate(['/rutinas']);
        } else {
          this.toastService.show('Error al guardar rutina', 'error');
        }
      }
    });
  }

  thumbUrl(id: string | null | undefined, w = 160, h = 90): string {
    if (!id) return '';
    return assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' });
  }

  dosificacion(it: {
    series?: number;
    repeticiones?: number;
    duracionSeg?: number;
  }): string {
    const parts: string[] = [];
    parts.push(`${it.series ?? '—'} series`);
    parts.push(`${it.repeticiones ?? '—'} reps`);
    if (it.duracionSeg) parts.push(`${it.duracionSeg}s`);
    return parts.join(' · ');
  }
}
