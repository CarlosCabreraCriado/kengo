import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ActividadHoyService, BadgeType } from '../../../../actividad/data-access/actividad-hoy.service';
import { RachaPacienteService, DiaSemanaCalendario } from '../../../data-access/racha-paciente.service';
import { KENGO_BREAKPOINTS } from '../../../../../shared';

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

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);

  constructor() {
    effect(() => {
      const userId = this.sessionService.usuario()?.id;
      if (userId) {
        this.rachaService.cargarSiNecesario(userId);
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
