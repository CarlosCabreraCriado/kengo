import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../convex/_generated/dataModel';
import type {
  ResumenFisioDashboard,
  PlanPorVencer,
} from '../../../../types/global';
import type { Ui2ActivityDay } from '../../../shared/ui-v2';
import {
  diaSemanaFromYMD,
  getMadridDate,
  offsetMadridDate,
} from '../../../shared/utils/madrid-date.util';

interface ActividadDia {
  fecha: string;
  label: string;
  sesiones: number;
  today: boolean;
}

interface ActividadDiariaClinica {
  days: ActividadDia[];
  deltaPct: number | null;
  totalActual: number;
  totalAnterior: number;
}

interface ClinicSnapshot {
  _id: string;
  clinicId: string;
  ventana: '7d' | '15d' | '30d';
  pacientesActivos: number;
  adherenciaPromedio: number;
  dolorMedio?: number;
  sesionesUltimos7d: number;
  alertasPendientes: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardFisioService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);

  // Snapshot de métricas de la clínica activa (un solo contexto en cada
  // momento). El `ClinicaActivaGuard` garantiza que al entrar al dashboard
  // hay un id válido.
  private readonly snapshotSub = this.convex.watchQuery(
    api.snapshots.queries.getClinicMetrics,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      const id = this.clinicaActiva.selectedClinicaId();
      if (!id) return 'skip' as const;
      return { clinicId: id as any, ventana: '15d' as const };
    },
  );

  // Planes por vencer (query independiente, se mantiene tras Fase 5).
  private readonly planesSub = this.convex.watchQuery(
    api.dashboard.queries.planesPorVencer,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      return {};
    },
  );

  // Total de pacientes registrados en la clínica (independiente de si tienen
  // plan en curso). Sirve para distinguir el empty-state "sin pacientes" vs
  // "sin pacientes activos" en el dashboard del fisio.
  private readonly totalPacientesSub = this.convex.watchQuery(
    api.users.queries.listPatientsByClinic,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      const id = this.clinicaActiva.selectedClinicaId();
      if (!id) return 'skip' as const;
      return { clinicId: id as Id<'clinics'>, limit: 1 };
    },
  );

  // Actividad real (sesiones por día) de la clínica activa para la gráfica
  // del panel del fisio.
  private readonly actividadSub = this.convex.watchQuery(
    api.dashboard.queries.getActividadDiariaClinica,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      const id = this.clinicaActiva.selectedClinicaId();
      if (!id) return 'skip' as const;
      return { clinicId: id as Id<'clinics'> };
    },
  );

  readonly cargando = computed(
    () =>
      this.snapshotSub.isLoading() ||
      this.planesSub.isLoading() ||
      this.totalPacientesSub.isLoading(),
  );

  /**
   * Datos críticos del dashboard listos: hay clínica activa resuelta. Las
   * métricas/planes secundarios pueden llegar más tarde y se renderizan con
   * skeleton.
   */
  readonly cargada = computed(
    () => this.clinicaActiva.selectedClinicaId() !== null,
  );

  readonly resumen = computed<ResumenFisioDashboard | null>(() => {
    const snap = this.snapshotSub.value() as ClinicSnapshot | null;
    const planes = (this.planesSub.value() as PlanPorVencer[] | null) ?? [];
    if (!snap && !planes.length) return null;
    return {
      pacientesActivos: snap?.pacientesActivos ?? 0,
      adherenciaPromedio: snap?.adherenciaPromedio ?? 0,
      planesPorVencer: planes,
    };
  });

  readonly pacientesActivos = computed(() => this.resumen()?.pacientesActivos ?? 0);
  readonly adherenciaPromedio = computed(() => this.resumen()?.adherenciaPromedio ?? 0);
  readonly planesProximosAExpirar = computed(() => this.resumen()?.planesPorVencer ?? []);
  readonly pacientesTotal = computed(() => {
    const value = this.totalPacientesSub.value() as { total: number } | null;
    return value?.total ?? 0;
  });

  // --- Actividad de la clínica (gráfica web) ---
  readonly actividadCargando = computed(() => this.actividadSub.isLoading());

  /** Sesiones reales que la clínica ha registrado hoy (día `today` de la actividad). */
  readonly sesionesHoy = computed<number>(() => {
    const data = this.actividadSub.value() as ActividadDiariaClinica | null;
    if (!data) return 0;
    return data.days.find((d) => d.today)?.sesiones ?? 0;
  });

  readonly actividadDiaria = computed<Ui2ActivityDay[]>(() => {
    const data = this.actividadSub.value() as ActividadDiariaClinica | null;
    if (!data || data.days.length === 0) {
      // Fallback: 10 días con value=0 mientras llegan los datos. Mantiene la
      // gráfica válida sin saltos de layout porque `data` es input.required.
      const hoy = getMadridDate();
      const days: Ui2ActivityDay[] = [];
      for (let i = -9; i <= 0; i++) {
        const fecha = offsetMadridDate(i);
        days.push({
          label: diaSemanaFromYMD(fecha),
          value: 0,
          today: fecha === hoy,
        });
      }
      return days;
    }
    const max = Math.max(1, ...data.days.map((d) => d.sesiones));
    return data.days.map((d) => ({
      label: d.label,
      value: d.sesiones === 0 ? 0 : d.sesiones / max,
      today: d.today,
    }));
  });

  readonly actividadDeltaText = computed<string | null>(() => {
    const data = this.actividadSub.value() as ActividadDiariaClinica | null;
    if (!data) return null;
    if (data.deltaPct === null) return '— sin datos previos';
    const pct = data.deltaPct;
    if (pct === 0) return '→ 0% vs 10 días anteriores';
    const arrow = pct > 0 ? '↑' : '↓';
    const sign = pct > 0 ? '+' : '';
    return `${arrow} ${sign}${pct}% vs 10 días anteriores`;
  });

  readonly actividadDeltaColor = computed<string>(() => {
    const data = this.actividadSub.value() as ActividadDiariaClinica | null;
    if (!data || data.deltaPct === null) return 'var(--ink-500)';
    if (data.deltaPct > 0) return 'var(--success)';
    if (data.deltaPct < 0) return 'var(--danger)';
    return 'var(--ink-500)';
  });

  async recargar(): Promise<void> {
    // Reactive: la suscripción Convex se actualiza sola al mutar datos.
  }
}
