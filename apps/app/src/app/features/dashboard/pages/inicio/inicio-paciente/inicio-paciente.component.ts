import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ActividadHoyService, BadgeType } from '../../../../actividad/data-access/actividad-hoy.service';
import { RachaPacienteService, DiaSemanaCalendario } from '../../../data-access/racha-paciente.service';
import { AsignacionesService } from '../../../../pacientes/data-access/asignaciones.service';
import { KENGO_BREAKPOINTS } from '../../../../../shared';
import { environment as env } from '../../../../../../environments/environment';
import { PUESTO_PACIENTE } from '@kengo/shared-models';
import type { AsignacionResponsable } from '../../../../../../types/global';

@Component({
  selector: 'app-inicio-paciente',
  standalone: true,
  imports: [],
  templateUrl: './inicio-paciente.component.html',
  styleUrl: './inicio-paciente.component.css',
})
export class InicioPacienteComponent {
  private sessionService = inject(SessionService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private asignacionesService = inject(AsignacionesService);
  private destroyRef = inject(DestroyRef);

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);

  fisioAsignado = signal<AsignacionResponsable | null>(null);
  cargandoFisio = signal(true);

  private clinicaPaciente = computed(() => {
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    return clinicas.find(c => c.id_puesto === PUESTO_PACIENTE)?.id_clinica ?? null;
  });

  fisioAvatarUrl = computed(() => {
    const avatar = this.fisioAsignado()?.avatarFisio;
    return avatar ? `${env.DIRECTUS_URL}/assets/${avatar}` : null;
  });

  fisioNombreCompleto = computed(() => {
    const fisio = this.fisioAsignado();
    if (!fisio) return '';
    return [fisio.nombreFisio, fisio.apellidoFisio].filter(Boolean).join(' ');
  });

  constructor() {
    effect(() => {
      const userId = this.sessionService.usuario()?.id;
      if (userId) {
        this.rachaService.cargarSiNecesario(userId);
      }
    });

    effect(() => {
      const userId = this.sessionService.usuario()?.id;
      const clinicaId = this.clinicaPaciente();
      if (userId && clinicaId) {
        this.cargandoFisio.set(true);
        this.asignacionesService
          .getFisioResponsable(userId, clinicaId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (asignacion) => {
              this.fisioAsignado.set(asignacion);
              this.cargandoFisio.set(false);
            },
            error: () => {
              this.fisioAsignado.set(null);
              this.cargandoFisio.set(false);
            },
          });
      }
    });
  }

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((r) => r.matches)),
    { initialValue: true },
  );

  userName = computed(() => this.sessionService.usuario()?.first_name ?? 'Usuario');

  badgeType = computed<BadgeType>(() => this.actividadHoyService.badgeType());
  badgeCount = computed(() => this.actividadHoyService.badgeCount());
  subtitulo = computed(() => this.actividadHoyService.subtituloDinamico());
  progreso = computed(() => this.actividadHoyService.progresoTotal());
  siguienteEjercicio = computed(() => this.actividadHoyService.primerEjercicioPendiente());

  irAActividad(): void {
    this.router.navigate(['/actividad-personal']);
  }

  irAMiActividad(): void {
    this.router.navigate(['/actividad-personal/hoy']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }
}
