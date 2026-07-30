import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EffectRef,
  Injector,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
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
import {
  BackButtonService,
  BackHandler,
} from '../../../../core/services/back-button.service';
import { assetUrl } from '../../../../core/utils/asset-url';
import { Usuario } from '../../../../../types/global';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { CarritoPointers } from '../../data-access/internal/carrito-pointers';
import { CarritoLayoutService } from '../../data-access/carrito-layout.service';
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
export class Ui2CarritoEjerciciosComponent
  implements AfterViewInit, OnDestroy, BackHandler
{
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(Dialog);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backButton = inject(BackButtonService);

  readonly svc = inject(PlanBuilderService);
  readonly rutinaSvc = inject(RutinaBuilderService);
  private readonly carritoLayout = inject(CarritoLayoutService);

  readonly isRutinaMode = computed(() => this.rutinaSvc.isActive());
  readonly isEditMode = computed(() => this.svc.isEditMode());

  /** Guard de reentrada de `guardarRutinaDirectamente`. */
  private readonly guardandoRutina = signal(false);

  readonly drawerAbierto = signal(false);
  readonly ocultarTab = signal(false);

  /**
   * Fuente de verdad de la visibilidad de la pestaña lateral: hay sujeto
   * (paciente o modo rutina) y la ruta no la oculta. La lee el template y se
   * publica al shell vía `CarritoLayoutService` para reservar el carril derecho.
   */
  readonly tabVisible = computed(
    () => (!!this.svc.paciente() || this.isRutinaMode()) && !this.ocultarTab(),
  );

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
  private tabVisibleEff!: EffectRef;

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

    // Publica la visibilidad de la pestaña al shell para que reserve el carril
    // derecho del contenido en desktop y no la tape.
    this.tabVisibleEff = effect(
      () => this.carritoLayout.setTabVisible(this.tabVisible()),
      { injector: this.injector },
    );

    this.checkRouteForTab(this.router.url);
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.checkRouteForTab((event as NavigationEnd).urlAfterRedirects);
      });

    this.rutinaSvc.tryRestore();

    if (!this.rutinaSvc.isActive()) {
      const punteros = CarritoPointers.read();
      const currentFisioId = this.svc.fisioId();
      // Solo restauramos si el carrito persistido pertenece al fisio
      // actualmente autenticado. Si no, purgamos los punteros para no
      // exponer el paciente del usuario anterior tras logout/login.
      if (punteros && currentFisioId && punteros.fisioId === currentFisioId) {
        this.svc.tryRestoreFor(punteros.pacienteId, punteros.fisioId);
      } else if (punteros) {
        CarritoPointers.clear();
      }
    }

    this.backButton.register(this);
  }

  ngOnDestroy(): void {
    this.drawerEff?.destroy();
    this.tabVisibleEff?.destroy();
    this.carritoLayout.setTabVisible(false);
    this.backButton.unregister(this);
  }

  /** Botón atrás de Android: si el drawer está abierto, lo cierra. */
  handleBack(): boolean {
    if (!this.drawerAbierto()) return false;
    this.cerrar();
    return true;
  }

  /**
   * Oculta la pestaña dentro de los editores: ahí el contenido de la página ya
   * es la lista de ejercicios y la vía para añadir más es ir al catálogo, donde
   * la pestaña sí se ve.
   *
   * `'/rutinas/'` con barra final cubre las dos subrutas que existen (`nueva` y
   * `:id/editar`) y deja fuera la lista `/rutinas`, donde la pestaña sigue
   * siendo útil mientras se construye una rutina.
   */
  private checkRouteForTab(url: string): void {
    this.ocultarTab.set(
      url.startsWith('/planes') || url.startsWith('/rutinas/'),
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
    CarritoPointers.clear();
    this.svc.resetAll();
    this.toastService.success('Asignación eliminada');
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

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paciente) => {
        if (paciente) {
          this.svc.paciente.set(paciente);
          const fisioId = this.svc.fisioId();
          CarritoPointers.set({
            pacienteId: paciente.id,
            ...(fisioId ? { fisioId } : {}),
          });
          this.toastService.success(
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
      this.toastService.warning('Selecciona un paciente primero.');
      return;
    }
    if (this.svc.items().length === 0) {
      this.toastService.warning('Añade ejercicios al plan.');
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
      this.toastService.warning('Selecciona un paciente primero.');
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

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (rutinaId) => {
        if (rutinaId) {
          const success = this.rutinaSvc.isActive()
            ? await this.rutinaSvc.loadFromRutina(rutinaId)
            : await this.svc.loadFromRutina(rutinaId);
          if (success) {
            this.toastService.success('Rutina cargada correctamente');
          } else {
            this.toastService.error('No se pudo cargar la rutina');
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
      this.toastService.warning('Añade ejercicios primero.');
      return;
    }
    this.cerrar();
    this.router.navigate(['/rutinas/nueva']);
  }

  async guardarRutinaDirectamente(): Promise<void> {
    if (this.items().length === 0) {
      this.toastService.warning('Añade ejercicios primero.');
      return;
    }
    // Sin este guard, un doble toque abre dos diálogos y guarda dos rutinas.
    if (this.guardandoRutina()) return;

    const { DialogoGuardarRutinaComponent } = await import(
      '../../../rutinas/components/dialogo-guardar-rutina/dialogo-guardar-rutina.component'
    );

    const dialogRef = this.dialog.open(DialogoGuardarRutinaComponent, {
      width: '400px',
      data: { nombreSugerido: '' },
    });

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        const data = result as
          | { nombre: string; descripcion: string; visibilidad: 'privado' | 'clinica' }
          | undefined;
        if (!data) return;

        this.guardandoRutina.set(true);
        try {
          // Ambas ramas devuelven `GuardarRutinaResult`. Se discrimina por
          // `status` y no por truthiness: el resultado es un objeto, así que
          // `if (res)` daba siempre true y un fallo acababa mostrando "Rutina
          // guardada", destruyendo el builder y navegando fuera.
          const res = this.rutinaSvc.isActive()
            ? await this.rutinaSvc.save(data.nombre, data.descripcion, data.visibilidad)
            : await this.svc.saveAsRutina(data.nombre, data.descripcion, data.visibilidad);

          if (res.status === 'ok') {
            this.toastService.success('Rutina guardada');
            if (this.rutinaSvc.isActive()) this.rutinaSvc.exit();
            this.router.navigate(['/rutinas']);
            return;
          }

          // En fallo no se navega ni se llama a `exit()`: el carrito se queda
          // intacto para que el trabajo no se pierda.
          if (res.error.kind === 'mostrar') {
            await this.dialogService.confirm({
              title: res.error.title,
              message: res.error.message,
              confirmText: 'Entendido',
              hideCancel: true,
              confirmVariant: 'primary',
            });
          }
        } finally {
          this.guardandoRutina.set(false);
        }
      });
  }

  thumbUrl(id: string | null | undefined, w = 160, h = 90): string {
    if (!id) return '';
    return assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' });
  }

  dosificacion(it: {
    tipo?: 'repeticiones' | 'duracion';
    series?: number;
    repeticiones?: number;
    duracionSeg?: number;
  }): string {
    const parts: string[] = [];
    parts.push(`${it.series ?? '—'} series`);
    if (it.tipo === 'duracion') {
      parts.push(`${it.duracionSeg ?? '—'}s`);
    } else {
      parts.push(`${it.repeticiones ?? '—'} reps`);
    }
    return parts.join(' · ');
  }
}
