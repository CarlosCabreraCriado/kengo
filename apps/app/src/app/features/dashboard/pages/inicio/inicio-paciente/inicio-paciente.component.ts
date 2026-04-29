import { Component, ChangeDetectionStrategy, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ActividadHoyService, EjercicioUnificadoHoy } from '../../../../actividad/data-access/actividad-hoy.service';
import { RachaPacienteService } from '../../../data-access/racha-paciente.service';
import { AsignacionesService } from '../../../../pacientes/data-access/asignaciones.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import { SesionStateService } from '../../../../sesion/data-access/sesion-state.service';
import type {
  AsignacionResponsable,
  Clinica,
  ConfigSesionMultiPlan,
  EjercicioSesionMultiPlan,
} from '../../../../../../types/global';
import { rawAssetUrl, thumbnailUrl } from '../../../../../core/utils/asset-url';
import {
  Ui2ActivityDay,
  Ui2AchievementListItem,
  Ui2AppointmentVm,
  Ui2ClinicHeroCardComponent,
  Ui2CtaBarComponent,
  Ui2ExerciseCardComponent,
  Ui2FisioMessageCardComponent,
  Ui2HorizontalScrollerComponent,
  Ui2MiniStatComponent,
  Ui2NextAppointmentComponent,
  Ui2ProgressRingComponent,
  Ui2SectionComponent,
  Ui2WebAchievementsListComponent,
  Ui2WebActivityChartComponent,
} from '../../../../../shared/ui-v2';

interface ExerciseVm {
  id: string;
  nombre: string;
  sets: string;
  imageUrl: string | null;
  done: boolean;
}

function formatSets(ej: EjercicioUnificadoHoy): string {
  if (ej.duracionSeg && ej.duracionSeg > 0) {
    return ej.duracionSeg >= 60 ? `${Math.round(ej.duracionSeg / 60)} min` : `${ej.duracionSeg} seg`;
  }
  const series = ej.series ?? 3;
  const reps = ej.repeticiones ?? 12;
  return `${series}×${reps}`;
}

@Component({
  selector: 'app-inicio-paciente',
  standalone: true,
  imports: [
    Ui2ClinicHeroCardComponent,
    Ui2CtaBarComponent,
    Ui2ExerciseCardComponent,
    Ui2FisioMessageCardComponent,
    Ui2HorizontalScrollerComponent,
    Ui2MiniStatComponent,
    Ui2NextAppointmentComponent,
    Ui2ProgressRingComponent,
    Ui2SectionComponent,
    Ui2WebAchievementsListComponent,
    Ui2WebActivityChartComponent,
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
  private registroService = inject(SesionStateService);
  private destroyRef = inject(DestroyRef);

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);

  hayActividadHoy = this.actividadHoyService.hayActividadHoy;
  todoCompletado = this.actividadHoyService.todoCompletado;
  tiempoEstimadoHoy = this.actividadHoyService.tiempoEstimadoHoy;

  fisioAsignado = signal<AsignacionResponsable | null>(null);
  cargandoFisio = signal(true);

  private clinicaPaciente = computed(() => {
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    return clinicas.find((c) => c.puesto === 'paciente')?.clinicId ?? null;
  });

  // --- Hero ---
  userName = computed(() => this.sessionService.usuario()?.first_name ?? 'Hola');

  progreso = computed(() => this.actividadHoyService.progresoTotal());

  progresoRatio = computed(() => {
    const p = this.progreso();
    return p.total > 0 ? p.completados / p.total : 0;
  });

  rachaActual = computed(() => this.rachaService.rachaActual());

  heroTitle = computed(() => {
    const t = this.actividadHoyService.badgeType();
    if (t === 'completed') return '¡BIEN HECHO!';
    if (t === 'rest') return 'A DESCANSAR';
    if (t === 'loading') return '';
    return 'VAMOS ALLÁ 💪';
  });

  heroSub = computed<string>(() => {
    const t = this.actividadHoyService.badgeType();
    if (t === 'loading') return 'Cargando…';
    const racha = this.rachaActual();
    if (t === 'completed') return '¡Disfruta del día!';
    if (t === 'rest') return 'Hoy descansas. Vuelve mañana.';
    if (racha > 0) {
      const dias = racha === 1 ? '1 día' : `${racha} días`;
      return `Llevas <b>${dias}</b> de racha.<br>Sigue así.`;
    }
    return 'Empieza tu sesión de hoy.';
  });

  // --- Ejercicios de hoy ---
  ejerciciosHoy = computed<ExerciseVm[]>(() => {
    const ejercicios = this.actividadHoyService.ejerciciosUnificadosHoy();
    return ejercicios.map((ej, i) => {
      const portada = ej.ejercicio?.portada;
      return {
        id: ej.id ?? `${ej.planId}-${i}`,
        nombre: ej.ejercicio?.nombre ?? 'Ejercicio',
        sets: formatSets(ej),
        imageUrl: portada ? thumbnailUrl(portada, 240, 160) : null,
        done: ej.completadoHoy,
      };
    });
  });

  // --- Fisio ---
  fisioAvatarUrl = computed(() => {
    const avatar = this.fisioAsignado()?.avatarFisio;
    return avatar ? rawAssetUrl(avatar) : null;
  });

  fisioNombreCompleto = computed(() => {
    const fisio = this.fisioAsignado();
    if (!fisio) return 'Tu fisio';
    return [fisio.nombreFisio, fisio.apellidoFisio].filter(Boolean).join(' ').trim() || 'Tu fisio';
  });

  mensajeFisio = signal<string>(
    '¿Cómo te has sentido hoy con los ejercicios? Cuéntame y ajusto el plan si lo necesitas.',
  );

  // --- Clínica ---
  clinicaActual = computed<Clinica | null>(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    const id = this.clinicaPaciente();
    if (!id) return null;
    return clinicas.find((c) => c.id === id) ?? null;
  });

  clinicaImagenUrl = computed<string | null>(() => {
    const fileId = this.clinicaActual()?.imagenes?.[0]?.fileId;
    return fileId ? rawAssetUrl(fileId) : null;
  });

  // ============================================================
  // Datos mockeados para vista desktop — reemplazar cuando haya backend
  // (adherencia, dolor, actividad histórica, logros, próxima cita).
  // ============================================================

  readonly adherencia = signal<number>(87);
  readonly dolorActual = signal<number>(3);
  readonly dolorAnterior = signal<number>(6);

  readonly dolorSub = computed<string>(() => {
    const actual = this.dolorActual();
    const anterior = this.dolorAnterior();
    if (anterior > actual) return `↓ desde ${anterior}`;
    if (anterior < actual) return `↑ desde ${anterior}`;
    return 'sin cambios';
  });

  readonly actividad10dias = signal<Ui2ActivityDay[]>([
    { label: 'L', value: 1.0 },
    { label: 'M', value: 0.85 },
    { label: 'X', value: 0.6 },
    { label: 'J', value: 1.0 },
    { label: 'V', value: 0.9 },
    { label: 'S', value: 0 },
    { label: 'D', value: 0.4 },
    { label: 'L', value: 1.0 },
    { label: 'M', value: 0.85 },
    { label: 'X', value: 0.33, today: true },
  ]);

  readonly logros = signal<Ui2AchievementListItem[]>([
    { emoji: '🔥', title: '12 días de racha', sub: '¡Sigue así!', color: '#f59e0b', earned: true },
    { emoji: '💪', title: '50 ejercicios', sub: 'Completados', color: '#22c55e', earned: true },
    { emoji: '🎯', title: 'Mes perfecto', sub: 'Faltan 4 días', color: '#6366f1', earned: false },
  ]);

  readonly proximaCita = signal<Ui2AppointmentVm>({
    weekday: 'LUN',
    day: '28',
    month: 'ABR',
    titulo: 'Revisión hombro',
    meta: '17:30 · 30 min · Presencial',
    ubicacion: 'Myo Active Orotava',
  });

  readonly heroSubDesktop = computed<string>(() => {
    const racha = this.rachaActual();
    const total = this.progreso().total;
    const completados = this.progreso().completados;
    const restantes = total - completados;
    if (this.todoCompletado()) return '¡Sesión de hoy completada! Disfruta del descanso.';
    if (this.actividadHoyService.badgeType() === 'rest') return 'Hoy descansas. Vuelve mañana con energía.';
    const rachaTxt = racha > 0 ? `Llevas <b>${racha} días de racha</b>. ` : '';
    if (restantes > 0) return `${rachaTxt}Solo te quedan ${restantes} ejercicios para terminar la sesión de hoy.`;
    return 'Empieza tu sesión de hoy.';
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

  iniciarSesionHoy(): void {
    const actividades = this.actividadHoyService.actividadHoy();

    const ejercicios: EjercicioSesionMultiPlan[] = [];
    const planesInvolucrados: {
      planId: string;
      titulo: string;
      cantidadEjercicios: number;
    }[] = [];

    for (const actividad of actividades) {
      if (actividad.ejerciciosHoy.length === 0) continue;

      planesInvolucrados.push({
        planId: actividad.plan.id,
        titulo: actividad.plan.titulo,
        cantidadEjercicios: actividad.ejerciciosHoy.length,
      });

      for (const ej of actividad.ejerciciosHoy) {
        ejercicios.push({
          ...ej,
          planId: actividad.plan.id,
          planTitulo: actividad.plan.titulo,
          planItemId: ej.id!,
        });
      }
    }

    if (ejercicios.length === 0) return;

    const config: ConfigSesionMultiPlan = {
      titulo: 'Tu actividad de hoy',
      fecha: new Date(),
      esFechaProgramada: true,
      ejercicios,
      planesInvolucrados,
      skipResumen: true,
    };

    this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }
}
