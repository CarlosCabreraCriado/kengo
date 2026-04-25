import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ActividadHoyService, BadgeType } from '../../../../actividad/data-access/actividad-hoy.service';
import { RachaPacienteService, DiaSemanaCalendario } from '../../../data-access/racha-paciente.service';
import { AsignacionesService } from '../../../../pacientes/data-access/asignaciones.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import { KENGO_BREAKPOINTS } from '../../../../../shared';
import { PUESTO_PACIENTE } from '@kengo/shared-models';
import type { AsignacionResponsable, DiaSemana } from '../../../../../../types/global';
import { assetUrl, rawAssetUrl } from '../../../../../core/utils/asset-url';

interface EjercicioStrip {
  id: number;
  nombre: string;
  portadaUrl: string | null;
  completado: boolean;
  esSiguiente: boolean;
}

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
  private clinicasService = inject(ClinicasService);
  private destroyRef = inject(DestroyRef);

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);

  fisioAsignado = signal<AsignacionResponsable | null>(null);
  cargandoFisio = signal(true);
  mostrarTooltipContacto = signal(false);

  private clinicaPaciente = computed(() => {
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    return clinicas.find(c => c.id_puesto === PUESTO_PACIENTE)?.id_clinica ?? null;
  });

  fisioAvatarUrl = computed(() => {
    const avatar = this.fisioAsignado()?.avatarFisio;
    return avatar ? `${rawAssetUrl(avatar)}` : null;
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
    return clinicas.find(c => Number(c.id_clinica) === Number(clinicaId))?.nombre ?? null;
  });

  // --- Calendario ---
  proximaSesion = computed<DiaSemanaCalendario | null>(() => {
    const semana = this.rachaService.cumplimientoSemana();
    return semana.find(d => !d.esHoy && d.estado === 'programado') ?? null;
  });

  resumenSemana = computed(() => {
    const semana = this.rachaService.cumplimientoSemana();
    return {
      completados: semana.filter(d => d.estado === 'completado').length,
      parciales: semana.filter(d => d.estado === 'parcial').length,
      fallidos: semana.filter(d => d.estado === 'fallido').length,
    };
  });

  // --- Plan ---
  private readonly DIAS_SEMANA_JS: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  planPrincipal = computed(() => {
    const planes = this.actividadHoyService.planesActivos();
    if (planes.length === 0) return null;

    const plan = planes[0];
    const hoy = new Date();
    const diaHoy = this.DIAS_SEMANA_JS[hoy.getDay()];

    let diasRestantes: number | null = null;
    if (plan.fecha_fin) {
      const fin = new Date(plan.fecha_fin);
      diasRestantes = Math.max(0, Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const ejerciciosHoy = plan.items.filter(item => {
      if (!item.dias_semana || item.dias_semana.length === 0) return true;
      return item.dias_semana.includes(diaHoy);
    }).length;

    return {
      titulo: plan.titulo,
      diasRestantes,
      totalEjercicios: plan.items.length,
      ejerciciosHoy,
    };
  });

  tienePlanesMultiples = computed(() => this.actividadHoyService.planesActivos().length > 1);
  cantidadPlanesExtra = computed(() => this.actividadHoyService.planesActivos().length - 1);

  // --- Racha ---
  mensajeMotivacional = computed(() => {
    const racha = this.rachaService.rachaActual();
    if (racha >= 7) return '¡Increíble! Una semana entera';
    if (racha >= 3) return '¡Sigue así, vas genial!';
    if (racha >= 1) return '¡Buen inicio!';
    if (this.actividadHoyService.todoCompletado()) return '¡Hoy puede ser el día 1!';
    return null;
  });

  mostrarMejorRacha = computed(() => {
    const mejor = this.rachaService.mejorRacha();
    const actual = this.rachaService.rachaActual();
    return mejor > actual && mejor > 0;
  });

  // --- Quick actions ---
  subtituloClinica = computed(() => this.clinicaNombre() ?? 'Tu centro de salud');

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

  ejerciciosStrip = computed<EjercicioStrip[]>(() => {
    const actividad = this.actividadHoyService.actividadHoy();
    let primerPendienteEncontrado = false;
    const items: EjercicioStrip[] = [];

    for (const planDia of actividad) {
      for (const ej of planDia.ejerciciosHoy) {
        const esSiguiente = !ej.completadoHoy && !primerPendienteEncontrado;
        if (esSiguiente) primerPendienteEncontrado = true;

        items.push({
          id: ej.ejercicio?.id_ejercicio ?? ej.id ?? 0,
          nombre: ej.ejercicio?.nombre_ejercicio ?? 'Ejercicio',
          portadaUrl: ej.ejercicio?.portada
            ? `${assetUrl(ej.ejercicio.portada, { width: 80, height: 80, fit: 'cover', format: 'webp' })}`
            : null,
          completado: ej.completadoHoy,
          esSiguiente,
        });
      }
    }
    return items;
  });

  tiempoRestanteMin = computed<number | null>(() => {
    const actividad = this.actividadHoyService.actividadHoy();
    let totalSeg = 0;
    let hayPendientes = false;

    for (const planDia of actividad) {
      for (const ej of planDia.ejerciciosHoy) {
        if (ej.completadoHoy) continue;
        hayPendientes = true;

        const series = ej.series ?? 1;
        if (ej.duracion_seg) {
          totalSeg += ej.duracion_seg * series;
        } else {
          const reps = ej.repeticiones ?? 10;
          totalSeg += series * reps * 3;
        }
        if (series > 1) {
          totalSeg += (ej.descanso_seg ?? 30) * (series - 1);
        }
      }
    }

    if (!hayPendientes) return null;
    return Math.max(1, Math.ceil(totalSeg / 60));
  });

  siguienteEjercicioDetalle = computed<{ nombre: string; portadaUrl: string | null } | null>(() => {
    const actividad = this.actividadHoyService.actividadHoy();
    for (const planDia of actividad) {
      const pendiente = planDia.ejerciciosHoy.find(e => !e.completadoHoy);
      if (pendiente) {
        return {
          nombre: pendiente.ejercicio?.nombre_ejercicio ?? 'Ejercicio',
          portadaUrl: pendiente.ejercicio?.portada
            ? `${assetUrl(pendiente.ejercicio.portada, { width: 96, height: 96, fit: 'cover', format: 'webp' })}`
            : null,
        };
      }
    }
    return null;
  });

  resumenCompletado = computed(() => {
    const prog = this.actividadHoyService.progresoTotal();
    const racha = this.rachaService.rachaActual();
    let rachaTexto: string | null = null;
    if (racha > 0) {
      rachaTexto = `Racha de ${racha} ${racha === 1 ? 'día' : 'días'}`;
    } else {
      rachaTexto = 'Mañana empieza tu racha';
    }
    return { total: prog.total, rachaTexto };
  });

  irAActividad(): void {
    this.router.navigate(['/actividad-personal']);
  }

  irAMiActividad(): void {
    this.router.navigate(['/actividad-personal/hoy']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }

  irACalendario(): void {
    this.router.navigate(['/actividad-personal/calendario']);
  }

  irAEjercicios(): void {
    this.router.navigate(['/galeria/ejercicios']);
  }

  onContactarFisio(): void {
    this.mostrarTooltipContacto.set(true);
    setTimeout(() => this.mostrarTooltipContacto.set(false), 3000);
  }
}
