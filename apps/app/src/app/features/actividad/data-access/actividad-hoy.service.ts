import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import {
  ConvexExecutionRecord,
  mapConvexToPlanCompleto,
  mapConvexToRegistro,
} from '../../../shared/utils/convex-mappers';
import {
  getMadridDate,
  getMadridDiaSemana,
} from '../../../shared/utils/madrid-date.util';
import {
  PlanCompleto,
  RegistroEjercicio,
  ActividadPlanDia,
  EjercicioPlanConEstado,
} from '../../../../types/global';

export type BadgeType = 'pending' | 'completed' | 'rest' | 'loading' | null;

export type EjercicioUnificadoHoy = EjercicioPlanConEstado & {
  planId: string;
  planTitulo: string;
};

@Injectable({ providedIn: 'root' })
export class ActividadHoyService {
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private convex = inject(ConvexService);

  // ===== Suscripciones reactivas a Convex =====
  // Las queries se re-evalúan automáticamente cuando cambia `usuario()`,
  // `selectedClinicaId()`, o cuando llegan inserts/updates en
  // `plans`/`exerciseExecutions`.
  private readonly planesSub = this.convex.watchQuery(
    api.plans.queries.getActiveForPatientToday,
    () => {
      const u = this.sessionService.usuario();
      if (!u?.id) return 'skip' as const;
      const clinicId = this.clinicaActiva.selectedClinicaId();
      return {
        pacienteId: (u.convexId ?? u.id) as Id<'users'>,
        ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
      };
    },
  );

  private readonly registrosSub = this.convex.watchQuery(
    api.executions.queries.listByPacienteAndDate,
    () => {
      const u = this.sessionService.usuario();
      if (!u?.id) return 'skip' as const;
      const clinicId = this.clinicaActiva.selectedClinicaId();
      return {
        pacienteId: (u.convexId ?? u.id) as Id<'users'>,
        fecha: getMadridDate(),
        ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
      };
    },
  );

  // ===== Estado expuesto =====
  readonly planesActivos = computed<PlanCompleto[]>(() => {
    const raw = this.planesSub.value();
    if (!raw) return [];
    return (raw as Parameters<typeof mapConvexToPlanCompleto>[0][]).map((p) =>
      mapConvexToPlanCompleto(p),
    );
  });

  readonly registrosHoy = computed<RegistroEjercicio[]>(() => {
    const raw = this.registrosSub.value();
    if (!raw) return [];
    return (raw as ConvexExecutionRecord[]).map(mapConvexToRegistro);
  });

  readonly cargando = computed(
    () => this.planesSub.isLoading() || this.registrosSub.isLoading(),
  );
  /**
   * Una vez ambas suscripciones han resuelto al menos un valor (o entrado en
   * `'skip'` por falta de auth), liberamos el gate de `pageReady` para que
   * la UI no quede bloqueada en spinner. Si la query falla, Convex setea
   * `error` pero también `isLoading=false`, así que esto se libera igualmente.
   */
  readonly cargada = computed(() => !this.cargando());

  // Computed: día actual en zona Europe/Madrid (mismo huso que el backend).
  private readonly diaHoy = computed(() => getMadridDiaSemana());

  // Computed: actividad del día con estado de completado
  readonly actividadHoy = computed<ActividadPlanDia[]>(() => {
    const planes = this.planesActivos();
    const registros = this.registrosHoy();
    const hoy = this.diaHoy();

    return planes.map((plan) => {
      // Filtrar ejercicios para hoy
      const ejerciciosHoy = plan.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) {
          return true; // Sin días configurados = todos los días
        }
        return item.diasSemana.includes(hoy);
      });

      // Marcar estado de completado
      const ejerciciosConEstado: EjercicioPlanConEstado[] = ejerciciosHoy.map(
        (ej) => {
          const registrosEjercicio = registros.filter(
            (r) => r.planItemId === ej.id
          );

          return {
            ...ej,
            completadoHoy: registrosEjercicio.length >= 1,
            registroId: registrosEjercicio[0]?.id,
          };
        }
      );

      const completados = ejerciciosConEstado.filter(
        (e) => e.completadoHoy
      ).length;
      const total = ejerciciosConEstado.length;

      return {
        plan,
        ejerciciosHoy: ejerciciosConEstado,
        totalEjercicios: total,
        completados,
        progreso: total > 0 ? Math.round((completados / total) * 100) : 0,
      };
    });
  });

  readonly hayActividadHoy = computed(() =>
    this.actividadHoy().some((a) => a.ejerciciosHoy.length > 0)
  );

  readonly ejerciciosUnificadosHoy = computed<EjercicioUnificadoHoy[]>(() => {
    const actividades = this.actividadHoy();
    const out: EjercicioUnificadoHoy[] = [];
    for (const a of actividades) {
      for (const ej of a.ejerciciosHoy) {
        out.push({ ...ej, planId: a.plan.id, planTitulo: a.plan.titulo });
      }
    }
    return out;
  });

  readonly totalPendientes = computed(() =>
    this.actividadHoy().reduce(
      (acc, a) =>
        acc + a.ejerciciosHoy.filter((e) => !e.completadoHoy).length,
      0
    )
  );

  readonly todoCompletado = computed(
    () => this.hayActividadHoy() && this.totalPendientes() === 0
  );

  readonly sinPlanesActivos = computed(
    () => !this.cargando() && this.planesActivos().length === 0
  );

  // === COMPUTED PARA EL CAROUSEL ===

  readonly subtituloDinamico = computed<string>(() => {
    if (this.cargando()) return 'Cargando...';
    if (this.sinPlanesActivos()) return 'Sin planes activos';
    if (!this.hayActividadHoy()) return 'Hoy es día de descanso';
    if (this.todoCompletado()) return '¡Todo completado!';
    const n = this.totalPendientes();
    return n === 1 ? 'Tienes 1 ejercicio pendiente' : `Tienes ${n} ejercicios pendientes`;
  });

  readonly badgeType = computed<BadgeType>(() => {
    if (this.cargando()) return 'loading';
    if (this.sinPlanesActivos() || !this.hayActividadHoy()) return 'rest';
    if (this.todoCompletado()) return 'completed';
    return 'pending';
  });

  readonly badgeCount = computed<number>(() => {
    if (this.badgeType() === 'pending') return this.totalPendientes();
    return 0;
  });

  // Progreso total del día (completados / total)
  readonly progresoTotal = computed(() => {
    const actividad = this.actividadHoy();
    const total = actividad.reduce((acc, a) => acc + a.totalEjercicios, 0);
    const completados = actividad.reduce((acc, a) => acc + a.completados, 0);
    return { completados, total };
  });

  // Total de series del día
  readonly totalSeriesHoy = computed(() => {
    const actividad = this.actividadHoy();
    return actividad.reduce(
      (acc, a) =>
        acc + a.ejerciciosHoy.reduce((sum, ej) => sum + (ej.series ?? 3), 0),
      0
    );
  });

  // Tiempo estimado de la sesión del día
  readonly tiempoEstimadoHoy = computed(() => {
    const actividad = this.actividadHoy();
    let totalSegundos = 0;

    for (const plan of actividad) {
      for (const item of plan.ejerciciosHoy) {
        const series = item.series ?? 3;
        const descanso = item.descansoSeg ?? 60;

        if (item.duracionSeg) {
          totalSegundos += item.duracionSeg * series;
        } else {
          const reps = item.repeticiones ?? 12;
          totalSegundos += reps * 3 * series;
        }

        totalSegundos += descanso * (series - 1);
      }
    }

    const minutos = Math.round(totalSegundos / 60);
    if (minutos < 60) {
      return `${minutos} min`;
    }
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
  });

  // Nombre del primer ejercicio pendiente
  readonly primerEjercicioPendiente = computed<string | null>(() => {
    const actividad = this.actividadHoy();
    for (const plan of actividad) {
      const pendiente = plan.ejerciciosHoy.find((e) => !e.completadoHoy);
      if (pendiente) {
        return pendiente.ejercicio?.nombre ?? 'Ejercicio';
      }
    }
    return null;
  });
}
