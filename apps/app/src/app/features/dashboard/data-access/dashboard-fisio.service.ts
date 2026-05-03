import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type {
  ResumenFisioDashboard,
  PlanPorVencer,
} from '../../../../types/global';

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

  async recargar(): Promise<void> {
    // Reactive: la suscripción Convex se actualiza sola al mutar datos.
  }
}
