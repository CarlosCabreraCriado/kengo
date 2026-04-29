import { Component, ChangeDetectionStrategy, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ActividadHoyService, BadgeType } from '../../../../actividad/data-access/actividad-hoy.service';
import { RachaPacienteService, DiaSemanaCalendario } from '../../../data-access/racha-paciente.service';
import { AsignacionesService } from '../../../../pacientes/data-access/asignaciones.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import type { AsignacionResponsable, DiaSemana } from '../../../../../../types/global';
import { rawAssetUrl } from '../../../../../core/utils/asset-url';
import {
  Ui2BigTitleComponent,
  Ui2CardComponent,
  Ui2CtaBarComponent,
  Ui2DateTileComponent,
  Ui2FisioMessageCardComponent,
  Ui2HorizontalScrollerComponent,
  Ui2KpiCardComponent,
  Ui2ListRowComponent,
  Ui2SectionComponent,
} from '../../../../../shared/ui-v2';

const MES_ABREV = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIA_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

@Component({
  selector: 'app-inicio-paciente',
  standalone: true,
  imports: [
    Ui2BigTitleComponent,
    Ui2CardComponent,
    Ui2CtaBarComponent,
    Ui2DateTileComponent,
    Ui2FisioMessageCardComponent,
    Ui2HorizontalScrollerComponent,
    Ui2KpiCardComponent,
    Ui2ListRowComponent,
    Ui2SectionComponent,
  ],
  templateUrl: './inicio-paciente.component.html',
  styleUrl: './inicio-paciente.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPacienteComponent {
  private sessionService = inject(SessionService);
  private router = inject(Router);
  private asignacionesService = inject(AsignacionesService);
  private clinicasService = inject(ClinicasService);
  private destroyRef = inject(DestroyRef);

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);

  fisioAsignado = signal<AsignacionResponsable | null>(null);
  cargandoFisio = signal(true);

  private clinicaPaciente = computed(() => {
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    return clinicas.find((c) => c.puesto === 'paciente')?.clinicId ?? null;
  });

  fisioAvatarUrl = computed(() => {
    const avatar = this.fisioAsignado()?.avatarFisio;
    return avatar ? rawAssetUrl(avatar) : null;
  });

  fisioNombreCompleto = computed(() => {
    const fisio = this.fisioAsignado();
    if (!fisio) return '';
    return [fisio.nombreFisio, fisio.apellidoFisio].filter(Boolean).join(' ');
  });

  clinicaNombre = computed(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    const clinicaId = this.clinicaPaciente();
    if (!clinicaId) return null;
    return clinicas.find((c) => c.id === clinicaId)?.nombre ?? null;
  });

  // --- Calendario ---
  proximaSesion = computed<DiaSemanaCalendario | null>(() => {
    const semana = this.rachaService.cumplimientoSemana();
    return semana.find((d) => !d.esHoy && d.estado === 'programado') ?? null;
  });

  proximasFechas = computed(() => {
    const semana = this.rachaService.cumplimientoSemana();
    const ahora = new Date();
    return semana
      .filter((d) => !d.esHoy && d.estado === 'programado')
      .slice(0, 5)
      .map((d) => {
        const fecha = d.fecha ? new Date(d.fecha) : ahora;
        return {
          weekday: DIA_SHORT[fecha.getDay()],
          day: fecha.getDate(),
          month: MES_ABREV[fecha.getMonth()],
        };
      });
  });

  // --- Plan ---
  private readonly DIAS_SEMANA_JS: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  planPrincipal = computed(() => {
    const planes = this.actividadHoyService.planesActivos();
    if (planes.length === 0) return null;
    const plan = planes[0];
    const hoy = new Date();
    const diaHoy = this.DIAS_SEMANA_JS[hoy.getDay()];
    const ejerciciosHoy = plan.items.filter((item) => {
      if (!item.diasSemana || item.diasSemana.length === 0) return true;
      return item.diasSemana.includes(diaHoy);
    }).length;
    return { titulo: plan.titulo, totalEjercicios: plan.items.length, ejerciciosHoy };
  });

  // --- Header ---
  userName = computed(() => this.sessionService.usuario()?.first_name ?? 'Hola');
  saludoOverline = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  // --- Estados de actividad ---
  badgeType = computed<BadgeType>(() => this.actividadHoyService.badgeType());
  subtitulo = computed(() => this.actividadHoyService.subtituloDinamico());
  progreso = computed(() => this.actividadHoyService.progresoTotal());

  ctaSubtitle = computed(() => {
    const t = this.badgeType();
    const prog = this.progreso();
    if (t === 'loading') return 'Cargando…';
    if (t === 'completed') return '¡Hecho! Disfruta del día.';
    if (t === 'rest') return 'Hoy descansas.';
    if (prog.total > 0) return `${prog.completados}/${prog.total} ejercicios · pulsa para continuar`;
    return 'Empieza tu sesión de hoy';
  });

  ctaTitle = computed(() => {
    const t = this.badgeType();
    if (t === 'completed') return 'COMPLETADO';
    if (t === 'rest') return 'DESCANSO';
    return 'CONTINUAR';
  });

  ctaIcon = computed(() => {
    const t = this.badgeType();
    if (t === 'completed') return 'check';
    if (t === 'rest') return 'self_improvement';
    return 'play_arrow';
  });

  rachaActual = computed(() => this.rachaService.rachaActual());
  mejorRacha = computed(() => this.rachaService.mejorRacha());

  userNameUpper = computed(() => (this.userName() || 'Hola').toUpperCase());

  porcentajeHoy = computed<string | null>(() => {
    const p = this.progreso();
    if (!p.total) return null;
    return `${Math.round((p.completados / p.total) * 100)}% completado`;
  });

  rachaDelta = computed<string | null>(() => {
    const m = this.mejorRacha();
    const a = this.rachaActual();
    return m > a ? `Mejor: ${m}` : null;
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

  irAActividad(): void {
    this.router.navigate(['/actividad-personal']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }

  irACalendario(): void {
    this.router.navigate(['/actividad-personal/calendario']);
  }

  irAEstadisticas(): void {
    this.router.navigate(['/actividad-personal/estadisticas']);
  }

  irAPerfil(): void {
    this.router.navigate(['/perfil']);
  }
}
