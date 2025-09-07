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
} from '@angular/core';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';

import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlanBuilderService } from '../services/plan-builder.service';

import { MatButtonModule } from '@angular/material/button';

import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-carrito-ejercicios',
  standalone: true,
  imports: [MatSidenavModule, MatIconModule, MatButtonModule],
  templateUrl: './carrito-ejercicios.component.html',
  styleUrls: ['./carrito-ejercicios.component.css'],
})
export class CarritoEjerciciosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatSidenav;

  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private injector = inject(Injector);

  readonly svc = inject(PlanBuilderService);

  drawerAbierto = signal(false);
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
        if (!this.drawer) return; // por si acaso
        const shouldOpen = this.svc.drawerOpen();

        // Evita llamadas redundantes (menos animaciones innecesarias)
        if (shouldOpen && !this.drawer.opened) this.drawer.open();
        else if (!shouldOpen && this.drawer.opened) this.drawer.close();
      },
      { injector: this.injector },
    );

    //Lee de localStorage el último paciente seleccionado
    const lastPacienteId = localStorage.getItem('carrito:last_paciente_id');
    const lastFisioId = localStorage.getItem('carrito:last_fisio_id');
    if (lastPacienteId && lastFisioId) {
      this.svc.tryRestoreFor(lastPacienteId, lastFisioId);
    }
  }

  ngOnDestroy() {
    this.drawerEff?.destroy(); // no es obligatorio: al pasar 'injector' ya se limpia solo
  }

  open() {
    this.drawer?.open();
  }

  close() {
    this.drawer?.close();
  }

  toggle() {
    if (this.drawerAbierto()) {
      this.svc.closeDrawer();
    } else {
      this.svc.openDrawer();
    }
  }

  abrirDrawer() {
    //this.svc.openDrawer();
    this.drawerAbierto.set(true);
  }
  cerrarDrawer() {
    //this.svc.closeDrawer();
    this.drawerAbierto.set(false);
  }

  eliminar(ejercicioId: number) {
    this.svc.removeEjercicio(ejercicioId);
  }

  cambiarPaciente() {
    // Limpia el carrito y des-selecciona paciente
    this.svc.cambiarPaciente(null);
    this.snack.open('Selecciona un paciente para continuar', 'OK', {
      duration: 2500,
    });
  }

  // Ir a la pantalla de configuración del plan (manteniendo el carrito en el service)
  async configurarPlan() {
    if (!this.svc.paciente()) {
      this.snack.open('Selecciona un paciente primero.', 'OK', {
        duration: 2000,
      });
      return;
    }
    if (this.svc.items().length === 0) {
      this.snack.open('Añade ejercicios al plan.', 'OK', { duration: 2000 });
      return;
    }
    const id = this.svc.paciente()!.id;
    // Si usas el guard y la ruta propuesta en la respuesta anterior:
    await this.router.navigate(['/inicio/planes/nuevo'], {
      queryParams: { paciente: id },
    });

    this.svc.closeDrawer();
  }

  // (Opcional) URL para miniaturas de los ejercicios
  assetUrl(id: string | null | undefined, w = 160, h = 90) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }
}
