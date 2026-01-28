import {
  Component,
  ViewChild,
  inject,
  signal,
  computed,
  Input,
  AfterViewInit,
  effect,
  EffectRef,
  Injector,
  OnDestroy,
  ElementRef,
} from '@angular/core';

import { Dialog } from '@angular/cdk/dialog';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';

import { environment as env } from '../../../../../environments/environment';
import { Usuario } from '../../../../../types/global';

@Component({
  selector: 'app-carrito-ejercicios',
  standalone: true,
  imports: [],
  templateUrl: './carrito-ejercicios.component.html',
  styleUrls: ['./carrito-ejercicios.component.css'],
})
export class CarritoEjerciciosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('drawerEl') drawerEl!: ElementRef<HTMLElement>;

  private router = inject(Router);
  private toastService = inject(ToastService);
  private injector = inject(Injector);
  private dialog = inject(Dialog);

  readonly svc = inject(PlanBuilderService);

  drawerAbierto = signal(false);
  ocultarTab = signal(false);
  @Input() autoOpen = false;

  // Derived
  readonly pacienteNombre = computed(() => {
    const p = this.svc.paciente();
    return p ? `${p.first_name} ${p.last_name}` : 'Paciente no seleccionado';
  });
  readonly total = computed(() => this.svc.totalItems());
  readonly perfilUrl = computed(() => {
    const avatar = this.svc.paciente()?.avatar;
    if (!avatar) return null;
    return `${env.DIRECTUS_URL}/assets/${avatar}?fit=cover&width=120&height=120&quality=80`;
  });
  private drawerEff!: EffectRef;

  ngAfterViewInit() {
    if (this.autoOpen) this.open();
    this.drawerEff = effect(
      () => {
        const shouldOpen = this.svc.drawerOpen();
        this.drawerAbierto.set(shouldOpen);
      },
      { injector: this.injector },
    );

    // Verificar ruta actual y ocultar tab si estamos en /planes
    this.checkRouteForTab(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkRouteForTab((event as NavigationEnd).urlAfterRedirects);
      });

    //Lee de localStorage el último paciente seleccionado
    const lastPacienteId = localStorage.getItem('carrito:last_paciente_id');
    const lastFisioId = localStorage.getItem('carrito:last_fisio_id');
    if (lastPacienteId && lastFisioId) {
      this.svc.tryRestoreFor(lastPacienteId, lastFisioId);
    }
  }

  private checkRouteForTab(url: string) {
    this.ocultarTab.set(url.startsWith('/planes'));
  }

  ngOnDestroy() {
    this.drawerEff?.destroy();
  }

  open() {
    this.drawerAbierto.set(true);
  }

  close() {
    this.drawerAbierto.set(false);
  }

  toggle() {
    if (this.drawerAbierto()) {
      this.svc.closeDrawer();
    } else {
      this.svc.openDrawer();
    }
  }

  abrirDrawer() {
    this.drawerAbierto.set(true);
  }
  cerrarDrawer() {
    this.drawerAbierto.set(false);
  }

  eliminar(ejercicioId: number) {
    this.svc.removeEjercicio(ejercicioId);
  }

  eliminarAsignacion() {
    localStorage.removeItem('carrito:last_paciente_id');
    localStorage.removeItem('carrito:last_fisio_id');
    this.svc.resetAll();
    this.toastService.show('Asignación eliminada');
  }

  async cambiarPaciente() {
    const { SelectorPacienteComponent } =
      await import('../../../../shared/ui/selector-paciente/selector-paciente.component');

    const dialogRef = this.dialog.open<Usuario>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });

    dialogRef.closed.subscribe((paciente) => {
      if (paciente) {
        // Establecer el nuevo paciente (mantiene los ejercicios del carrito)
        this.svc.paciente.set(paciente);
        localStorage.setItem('carrito:last_paciente_id', paciente.id);
        const fisioId = this.svc.fisioId();
        if (fisioId) {
          localStorage.setItem('carrito:last_fisio_id', fisioId);
        }
        this.toastService.show(
          `Paciente cambiado a ${paciente.first_name} ${paciente.last_name}`
        );
      }
    });
  }

  irAEjercicios() {
    this.svc.closeDrawer();
    // Pequeño delay para permitir que el drawer se cierre antes de navegar
    // Esto evita conflictos con el scroll restoration
    setTimeout(() => {
      this.router.navigate(['/galeria/ejercicios']);
    }, 100);
  }

  // Ir a la pantalla de configuración del plan (manteniendo el carrito en el service)
  async configurarPlan() {
    if (!this.svc.paciente()) {
      this.toastService.show('Selecciona un paciente primero.');
      return;
    }
    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios al plan.');
      return;
    }
    const id = this.svc.paciente()!.id;
    await this.router.navigate(['/planes/nuevo'], {
      queryParams: { paciente: id },
    });

    this.svc.closeDrawer();
  }

  // (Opcional) URL para miniaturas de los ejercicios
  assetUrl(id: string | null | undefined, w = 160, h = 90) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }

  // Cargar una rutina (plantilla) existente
  async cargarRutina() {
    if (!this.svc.paciente()) {
      this.toastService.show('Selecciona un paciente primero.');
      return;
    }

    const { SelectorRutinaComponent } =
      await import('../../../rutinas/components/selector-rutina/selector-rutina.component');

    const dialogRef = this.dialog.open<number>(SelectorRutinaComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'selector-rutina-dialog',
    });

    dialogRef.closed.subscribe(async (rutinaId) => {
      if (rutinaId) {
        const success = await this.svc.loadFromRutina(rutinaId);
        if (success) {
          this.toastService.show('Rutina cargada correctamente');
        } else {
          this.toastService.show('Error al cargar la rutina', 'error');
        }
      }
    });
  }
}
