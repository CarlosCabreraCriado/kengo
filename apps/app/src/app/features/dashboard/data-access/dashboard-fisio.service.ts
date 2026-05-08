import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
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

type ClinicSnapshot = {
  _id: string;
  clinicId: string;
  ventana: '7d' | '30d';
  pacientesActivos: number;
  adherenciaPromedio: number;
  dolorMedio?: number;
  sesionesUltimos7d: number;
  alertasPendientes: number;
};

@Injectable({ providedIn: 'root' })
export class DashboardFisioService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  // Resolver clinicIds gestionados por el fisio actual.
  private readonly clinicIdsSub = this.convex.watchQuery(
    api.me.queries.myManagedClinics,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      return {};
    },
  );

  // Snapshot de métricas de la primera clínica gestionada (caso típico: 1
  // clínica por fisio). Si gestiona varias, mostramos las métricas de la
  // primera y dejamos pendiente para una iteración futura el agregado.
  private readonly snapshotSub = this.convex.watchQuery(
    api.snapshots.queries.getClinicMetrics,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      const ids = this.clinicIdsSub.value();
      if (!ids || ids.length === 0) return 'skip' as const;
      return { clinicId: ids[0] as any, ventana: '30d' as const };
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

  // Actividad real (sesiones por día) de los últimos 10 días para la gráfica
  // del panel del fisio. Misma estrategia multi-clínica que `snapshotSub`:
  // de momento usamos `clinicIds[0]` y dejamos el agregado para más adelante.
  private readonly actividadSub = this.convex.watchQuery(
    api.dashboard.queries.getActividadDiariaClinica,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.enModoFisio()) return 'skip' as const;
      const ids = this.clinicIdsSub.value();
      if (!ids || ids.length === 0) return 'skip' as const;
      return { clinicId: ids[0] as Id<'clinics'> };
    },
  );

  readonly cargando = computed(
    () => this.snapshotSub.isLoading() || this.planesSub.isLoading(),
  );

  /**
   * Datos críticos del dashboard listos: la lista de clínicas gestionadas
   * por el fisio se ha resuelto. Las métricas/planes secundarios pueden
   * llegar más tarde y se renderizan con skeleton.
   */
  readonly cargada = computed(() => !this.clinicIdsSub.isLoading());

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

  // --- Actividad de la clínica (gráfica web) ---
  readonly actividadCargando = computed(() => this.actividadSub.isLoading());

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
