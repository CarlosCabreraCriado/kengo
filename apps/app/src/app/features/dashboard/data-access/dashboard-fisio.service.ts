import { Injectable, computed, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { ResumenFisioDashboard } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class DashboardFisioService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  private readonly suscripcion = this.convex.watchQuery(
    api.dashboard.queries.fisioSummary,
    () => {
      const usuario = this.sessionService.usuario();
      const esFisio = this.sessionService.rolUsuario() === 'fisio';
      if (!usuario?.id || !esFisio) return 'skip' as const;
      return {};
    },
  );

  readonly cargando = this.suscripcion.isLoading;
  readonly resumen = computed<ResumenFisioDashboard | null>(() => {
    const data = this.suscripcion.value();
    return data ? (data as unknown as ResumenFisioDashboard) : null;
  });

  readonly pacientesActivos = computed(() => this.resumen()?.pacientes_activos ?? 0);
  readonly adherenciaPromedio = computed(() => this.resumen()?.adherencia_promedio ?? 0);
  readonly planesProximosAExpirar = computed(() => this.resumen()?.planes_por_vencer ?? []);

  async recargar(): Promise<void> {
    // Reactive: la suscripción Convex se actualiza sola al mutar datos.
  }
}
