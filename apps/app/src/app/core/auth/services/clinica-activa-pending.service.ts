import { Injectable, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClinicaActivaService } from './clinica-activa.service';
import { ToastService } from '../../../shared/services/toast/toast.service';

/**
 * Difiere el cambio de "clínica activa" desencadenado por
 * `ClinicaActivaResourceGuard` hasta que la navegación finalice
 * (`NavigationEnd`). Sin esto, el `set()` se aplicaría durante `canActivate`
 * mientras el componente origen sigue visible — esto dispara watchQuery
 * globales (Dashboard/Actividad/Estadísticas) que reaccionan al signal y
 * provocan un parpadeo visual en la página que aún se está abandonando.
 *
 * Si la navegación se cancela o falla (`NavigationCancel` / `NavigationError`),
 * el pending se descarta sin aplicar — la clínica activa no debe cambiar si
 * el usuario terminó en otra ruta distinta a la que disparó el guard.
 *
 * El toast informativo del cambio también se emite aquí, sincronizado con la
 * entrada del nuevo componente.
 */
@Injectable({ providedIn: 'root' })
export class ClinicaActivaPendingService {
  private clinicaActiva = inject(ClinicaActivaService);
  private toast = inject(ToastService);
  private router = inject(Router);

  private pending: { clinicId: string; clinicName: string | null } | null =
    null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.apply();
        return;
      }
      if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.pending = null;
      }
    });
  }

  setPending(clinicId: string, clinicName: string | null): void {
    this.pending = { clinicId, clinicName };
  }

  clearPending(): void {
    this.pending = null;
  }

  private apply(): void {
    const next = this.pending;
    this.pending = null;
    if (!next) return;
    if (next.clinicId === this.clinicaActiva.selectedClinicaId()) return;
    this.clinicaActiva.set(next.clinicId);
    const nombre = next.clinicName?.trim();
    this.toast.info(
      nombre
        ? `Has cambiado a la clínica «${nombre}».`
        : 'Has cambiado de clínica activa.',
    );
  }
}
