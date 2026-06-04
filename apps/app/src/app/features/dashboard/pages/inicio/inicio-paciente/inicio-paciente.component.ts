import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../../core/auth/services/clinica-activa.service';
import { PageLoaderService } from '../../../../../core/services/page-loader.service';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ToastService } from '../../../../../shared/services/toast/toast.service';
import {
  ActividadHoyService,
  EjercicioUnificadoHoy,
} from '../../../../actividad/data-access/actividad-hoy.service';
import { EstadisticasService } from '../../../../actividad/data-access/estadisticas.service';
import { NextSessionService } from '../../../../actividad/data-access/next-session.service';
import { RachaPacienteService } from '../../../data-access/racha-paciente.service';
import { AsignacionesService } from '../../../../pacientes/data-access/asignaciones.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import { MensajesService } from '../../../../mensajes/data-access/mensajes.service';
import { SesionStateService } from '../../../../sesion/data-access/sesion-state.service';
import type {
  AsignacionResponsable,
  Clinica,
  ConfigSesionMultiPlan,
  EjercicioSesionMultiPlan,
} from '../../../../../../types/global';
import { rawAssetUrl, thumbnailUrl } from '../../../../../core/utils/asset-url';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2ClinicaSwitchTriggerComponent,
  Ui2ClinicHeroCardComponent,
  Ui2CtaBarComponent,
  Ui2ExerciseCardComponent,
  Ui2HorizontalScrollerComponent,
  Ui2MiniStatComponent,
  Ui2NextAppointmentComponent,
  Ui2ProgressRingComponent,
  Ui2SectionComponent,
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
    return ej.duracionSeg >= 60
      ? `${Math.round(ej.duracionSeg / 60)} min`
      : `${ej.duracionSeg} seg`;
  }
  const series = ej.series ?? 3;
  const reps = ej.repeticiones ?? 12;
  return `${series}×${reps}`;
}

@Component({
  selector: 'app-inicio-paciente',
  standalone: true,
  imports: [
    Ui2AvatarComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2ClinicaSwitchTriggerComponent,
    Ui2ClinicHeroCardComponent,
    Ui2CtaBarComponent,
    Ui2ExerciseCardComponent,
    Ui2HorizontalScrollerComponent,
    Ui2MiniStatComponent,
    Ui2NextAppointmentComponent,
    Ui2ProgressRingComponent,
    Ui2SectionComponent,
    Ui2WebActivityChartComponent,
  ],
  templateUrl: './inicio-paciente.component.html',
  styleUrl: './inicio-paciente.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPacienteComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private router = inject(Router);
  private asignacionesService = inject(AsignacionesService);
  private clinicasService = inject(ClinicasService);
  private mensajesService = inject(MensajesService);
  private registroService = inject(SesionStateService);
  private destroyRef = inject(DestroyRef);
  private pageLoader = inject(PageLoaderService);
  private themeService = inject(ThemeService);
  private toast = inject(ToastService);
  private readonly PAGE_LOADER_KEY = 'inicio-paciente';

  actividadHoyService = inject(ActividadHoyService);
  rachaService = inject(RachaPacienteService);
  private estadisticasService = inject(EstadisticasService);
  private nextSessionService = inject(NextSessionService);

  /** Datos críticos cargados: actividad del día (planes + registros). */
  readonly pageReady = computed(
    () =>
      this.sessionService.usuario() != null &&
      this.actividadHoyService.cargada(),
  );

  hayActividadHoy = this.actividadHoyService.hayActividadHoy;
  todoCompletado = this.actividadHoyService.todoCompletado;
  tiempoEstimadoHoy = this.actividadHoyService.tiempoEstimadoHoy;
  sinPlanesActivos = this.actividadHoyService.sinPlanesActivos;
  esDescanso = computed(() => this.actividadHoyService.badgeType() === 'rest');

  fisioAsignado = signal<AsignacionResponsable | null>(null);
  cargandoFisio = signal(true);

  private clinicaPaciente = computed(() => {
    const activeId = this.clinicaActiva.selectedClinicaId();
    if (!activeId) return null;
    const membresia = this.sessionService
      .usuario()
      ?.clinicas?.find((c) => c.clinicId === activeId);
    return membresia?.puesto === 'paciente' ? membresia.clinicId : null;
  });

  // Clínica a mostrar en la card "Mi clínica" del paciente. Preferimos la
  // clínica donde el usuario está registrado como paciente; si no existe
  // (caso de un fisio que ha activado el modo paciente y solo tiene puesto
  // 'fisio'/'admin'), caemos a la primera clínica disponible.
  private clinicaActualId = computed(() => {
    const pacienteId = this.clinicaPaciente();
    if (pacienteId) return pacienteId;
    const clinicas = this.sessionService.usuario()?.clinicas ?? [];
    return clinicas[0]?.clinicId ?? null;
  });

  // --- Hero ---
  userName = computed(
    () => this.sessionService.usuario()?.first_name ?? 'Hola',
  );

  progreso = computed(() => this.actividadHoyService.progresoTotal());

  progresoRatio = computed(() => {
    const p = this.progreso();
    return p.total > 0 ? p.completados / p.total : 0;
  });

  rachaActual = computed(() => this.rachaService.rachaActual());

  heroTitle = computed(() => {
    const t = this.actividadHoyService.badgeType();
    if (t === 'loading') return '';
    if (this.sinPlanesActivos()) return 'SIN PLAN ACTIVO';
    if (t === 'completed') return '¡BIEN HECHO!';
    if (t === 'rest') return 'Hoy descansas';
    return 'VAMOS ALLÁ';
  });

  heroSub = computed<string>(() => {
    const t = this.actividadHoyService.badgeType();
    if (t === 'loading') return 'Cargando…';
    if (this.sinPlanesActivos()) {
      return 'Aún no tienes ningún plan asignado.<br>Contacta con tu fisio para empezar.';
    }
    const racha = this.rachaActual();
    if (t === 'completed') return '¡Disfruta del día!';
    if (t === 'rest')
      return 'Revisa tu plan para ver cuando toca la siguiente sesión.';
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
    return (
      [fisio.nombreFisio, fisio.apellidoFisio]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Tu fisio'
    );
  });

  // --- Clínica ---
  clinicaActual = computed<Clinica | null>(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    const id = this.clinicaActualId();
    if (!id) return null;
    return clinicas.find((c) => c.id === id) ?? null;
  });

  clinicaImagenUrl = computed<string | null>(() => {
    const fileId = this.clinicaActual()?.imagenes?.[0]?.fileId;
    return fileId ? rawAssetUrl(fileId) : null;
  });

  // ============================================================
  // Vista desktop: adherencia, dolor y actividad histórica leen del
  // EstadisticasService (singleton root, mismo origen que /actividad-personal/estadisticas).
  // ============================================================

  readonly actividad10dias = this.estadisticasService.actividadSerie;
  readonly periodoLabel = this.estadisticasService.periodoLabel;

  readonly adherenciaDeltaTexto = computed<string | null>(
    () => this.estadisticasService.adherenciaDelta()?.texto ?? null,
  );

  readonly adherenciaDeltaColor = computed<string>(() => {
    const delta = this.estadisticasService.adherenciaDelta();
    if (!delta) return 'var(--ink-500)';
    if (delta.valor > 0) return 'var(--success)';
    if (delta.valor < 0) return 'var(--danger)';
    return 'var(--ink-500)';
  });

  readonly adherenciaTexto = computed<string>(() => {
    const v = this.estadisticasService.adherencia();
    return v == null ? '—' : `${v}%`;
  });

  readonly dolorActualTexto = computed<string>(() => {
    const v = this.estadisticasService.dolorActual();
    return v == null ? '—' : `${v}/10`;
  });

  readonly dolorSub = computed<string>(() => {
    const actual = this.estadisticasService.dolorActual();
    const inicial = this.estadisticasService.dolorInicial();
    if (actual == null || inicial == null) return '';
    if (inicial > actual) return `↓ desde ${inicial}`;
    if (inicial < actual) return `↑ desde ${inicial}`;
    return 'sin cambios';
  });

  readonly proximaSesion = this.nextSessionService.nextSessionVm;

  readonly heroSubDesktop = computed<string>(() => {
    if (this.sinPlanesActivos()) {
      return 'Aún no tienes ningún plan asignado. Contacta con tu fisio para empezar.';
    }
    const racha = this.rachaActual();
    const total = this.progreso().total;
    const completados = this.progreso().completados;
    const restantes = total - completados;
    if (this.todoCompletado())
      return '¡Sesión de hoy completada! Disfruta del descanso.';
    if (this.actividadHoyService.badgeType() === 'rest')
      return 'Revisa tu plan para ver cuando toca la siguiente sesión.';
    const rachaTxt = racha > 0 ? `Llevas <b>${racha} días de racha</b>. ` : '';
    if (restantes > 0)
      return `${rachaTxt}Solo te quedan ${restantes} ejercicios para terminar la sesión de hoy.`;
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
      if (!userId || !clinicaId) {
        // Sin contexto de paciente (p. ej. fisio en modo paciente sin puesto
        // 'paciente') no hay asignación que buscar. Liberamos el gate de carga
        // para que la UI no quede bloqueada esperando indefinidamente.
        this.fisioAsignado.set(null);
        this.cargandoFisio.set(false);
        return;
      }
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
    });
  }

  ngOnInit(): void {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  irAActividad(): void {
    this.router.navigate(['/actividad-personal']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }

  onClinicaCambiada(clinica: Clinica): void {
    this.themeService.aplicarTemaClinica(clinica);
    const puesto = this.sessionService
      .misclinicas()
      .find((c) => c.clinicId === clinica.id)?.puesto;
    const etiquetaPuesto =
      puesto === 'admin'
        ? 'Administrador'
        : puesto === 'fisio'
          ? 'Fisioterapeuta'
          : 'Paciente';
    this.toast.success(`Estás en ${clinica.nombre} (${etiquetaPuesto})`);
    this.router.navigateByUrl('/inicio');
  }

  async enviarMensajeAFisio(): Promise<void> {
    const idFisio = this.fisioAsignado()?.idFisio;
    if (!idFisio) return;

    const existing = this.mensajesService
      .conversations()
      .find((c) => c.participantId === idFisio);
    if (existing) {
      this.router.navigate(['/mensajes', existing.id]);
      return;
    }

    const conversationId =
      await this.mensajesService.startConversationWithFisio();
    if (conversationId) {
      this.router.navigate(['/mensajes', conversationId]);
    } else {
      this.router.navigate(['/mensajes']);
    }
  }

  irAPlan(): void {
    this.router.navigate(['/actividad-personal']);
  }

  async iniciarSesionHoy(): Promise<void> {
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

    // Esperamos a la rehidratación antes de navegar para que
    // RealizarPlanComponent vea el `ejercicioActualIndex` correcto.
    await this.registroService.iniciarSesionMultiPlan(config);
    this.router.navigate(['/mi-plan']);
  }
}
