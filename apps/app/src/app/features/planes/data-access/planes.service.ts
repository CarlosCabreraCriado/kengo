import {
  Injectable,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { assetUrl } from '../../../core/utils/asset-url';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { LoggerService } from '../../../core/services/logger.service';
import {
  mapConvexBase,
  mapConvexToPlanCompleto,
  mapConvexToUsuarioBasico,
} from '../../../shared/utils/convex-mappers';
import { createFilteredList } from '../../../shared/data-access/create-filtered-list';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';

import {
  Plan,
  PlanCompleto,
  EstadoPlan,
} from '../../../../types/global';

type FiltroEstado = 'todos' | EstadoPlan;

/** Resultado de `plans.mutations.remove`. */
export interface RemovePlanResult {
  /** `true` si el plan tenía actividad y se conservó como cancelado. */
  softDeleted: boolean;
  /** Id de la versión anterior restaurada, si el plan era una versión sucesora. */
  predecesorRestaurado: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private logger = inject(LoggerService);

  readonly filtroEstado: WritableSignal<FiltroEstado> = signal('todos');
  readonly filtroPaciente: WritableSignal<string | null> = signal(null);

  private readonly plansQuery = this.convex.watchQuery(
    api.plans.queries.listByFisio,
    () => {
      if (!this.sessionService.usuario()?.id) return 'skip' as const;
      const estado = this.filtroEstado();
      return {
        estado: estado === 'todos' ? undefined : (estado as any),
      };
    },
  );

  private readonly rawPlanes = computed<Plan[]>(() => {
    const raw = this.plansQuery.value();
    if (!raw) return [];
    return (raw as any[]).map((r) => this.mapConvexToPlan(r));
  });

  private readonly _list = createFilteredList<Plan>({
    source: this.rawPlanes,
    searchPredicate: (plan, q) =>
      plan.titulo.toLowerCase().includes(q) ||
      (typeof plan.paciente === 'object' &&
        `${plan.paciente.first_name} ${plan.paciente.last_name}`
          .toLowerCase()
          .includes(q)),
    applyDomainFilters: (planes) => {
      const pacFilter = this.filtroPaciente();
      if (!pacFilter) return planes;
      return planes.filter((p) =>
        typeof p.paciente === 'object'
          ? p.paciente.id === pacFilter
          : p.paciente === pacFilter,
      );
    },
  });

  readonly busqueda = this._list.busqueda;
  readonly page = this._list.page;
  readonly pageSize = this._list.pageSize;
  readonly total = this._list.total;
  readonly totalPages = this._list.totalPages;

  readonly planesRes = {
    value: this._list.items,
    isLoading: this.plansQuery.isLoading,
    error: this.plansQuery.error,
    reload: () => {},
  };

  readonly planes = this._list.items;
  readonly isLoading = computed(() => this.plansQuery.isLoading());

  setBusqueda(v: string) {
    this._list.setBusqueda(v);
  }

  setFiltroEstado(v: FiltroEstado) {
    this.filtroEstado.set(v);
    this._list.resetPage();
  }

  setFiltroPaciente(id: string | null) {
    this.filtroPaciente.set(id);
    this._list.resetPage();
  }

  clearFilters() {
    this._list.busqueda.set('');
    this.filtroEstado.set('todos');
    this.filtroPaciente.set(null);
    this._list.resetPage();
  }

  goToPage(p: number) {
    this._list.goToPage(p);
  }

  reload() {
    // No-op
  }

  // ========= CRUD Methods =========

  async getPlanById(id: string): Promise<PlanCompleto | null> {
    try {
      const raw = await this.convex.query(api.plans.queries.getById, {
        planId: id as any,
      });
      if (!raw) return null;
      return mapConvexToPlanCompleto(raw);
    } catch (error) {
      this.logger.error('Error al obtener plan:', error);
      return null;
    }
  }

  async updateEstado(id: string, estado: EstadoPlan): Promise<boolean> {
    try {
      await this.convex.mutation(api.plans.mutations.updateEstado, {
        planId: id as any,
        estado: estado as any,
      });
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar estado:', error);
      return false;
    }
  }

  async updatePlan(
    id: string,
    payload: Partial<{
      titulo: string;
      descripcion: string;
      fechaInicio: string | null;
      fechaFin: string | null;
      estado: EstadoPlan;
    }>,
  ): Promise<boolean> {
    try {
      await this.convex.mutation(api.plans.mutations.update, {
        planId: id as any,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        fechaInicio: payload.fechaInicio ?? undefined,
        fechaFin: payload.fechaFin ?? undefined,
      });
      return true;
    } catch (error) {
      this.logger.error('Error al actualizar plan:', error);
      return false;
    }
  }

  /**
   * Elimina (o cancela, si tiene actividad) un plan. Si el plan era una
   * versión sucesora, el backend restaura la versión anterior y devuelve su
   * id en `predecesorRestaurado`.
   */
  async removePlan(id: string): Promise<RemovePlanResult | null> {
    try {
      const raw = await this.convex.mutation(api.plans.mutations.remove, {
        planId: id as Id<'plans'>,
      });
      return {
        softDeleted: !!raw?.softDeleted,
        predecesorRestaurado: raw?.predecesorRestaurado
          ? String(raw.predecesorRestaurado)
          : null,
      };
    } catch (error) {
      this.logger.error('Error al eliminar plan:', error);
      return null;
    }
  }

  /**
   * Comprueba en el backend si el plan tiene ejecuciones registradas. Es el
   * mismo criterio que usa `plans.remove` para decidir entre cancelar y
   * borrar. Re-lanza el error para que el caller aplique su propio fallback.
   */
  async checkPlanHasActivity(id: string): Promise<boolean> {
    const has = await this.convex.query(api.plans.queries.checkPlanHasActivity, {
      planId: id as Id<'plans'>,
    });
    return !!has;
  }

  // ========= Planes por paciente =========

  async getPlanesActivosPaciente(pacienteId: string): Promise<PlanCompleto[]> {
    try {
      const raw = await this.convex.query(
        api.plans.queries.getActiveForPatientToday,
        { pacienteId, clinicId: this.activeClinicArg() },
      );
      return ((raw as any[]) || []).map((p) => mapConvexToPlanCompleto(p));
    } catch (error) {
      this.logger.error('Error al obtener planes activos:', error);
      return [];
    }
  }

  async getPlanesActivosYFuturosPaciente(
    pacienteId: string,
  ): Promise<PlanCompleto[]> {
    try {
      const raw = await this.convex.query(api.plans.queries.getActiveAndFuture, {
        pacienteId,
        clinicId: this.activeClinicArg(),
      });
      return ((raw as any[]) || []).map((p) => mapConvexToPlanCompleto(p));
    } catch (error) {
      this.logger.error('Error al obtener planes activos y futuros:', error);
      return [];
    }
  }

  async getPlanesByPaciente(pacienteId: string): Promise<Plan[]> {
    try {
      const raw = await this.convex.query(api.plans.queries.listByPaciente, {
        pacienteId,
        clinicId: this.activeClinicArg(),
      });
      return ((raw as any[]) || [])
        .filter((p) => p.estado !== 'cancelado' && p.estado !== 'modificado')
        .map((p) => this.mapConvexToPlan(p));
    } catch (error) {
      this.logger.error('Error al obtener planes del paciente:', error);
      return [];
    }
  }

  /** Lee el id de la clínica activa como argumento Convex (undefined si no
   * hay), para filtrar listados al contexto multiclínica vigente. */
  private activeClinicArg(): Id<'clinics'> | undefined {
    const id = this.clinicaActiva.selectedClinicaId();
    return id ? (id as Id<'clinics'>) : undefined;
  }

  // ========= Mappers Convex → Domain =========

  private mapConvexToPlan(r: any): Plan {
    return {
      ...mapConvexBase(r),
      paciente: mapConvexToUsuarioBasico(r.pacienteId, r.pacienteNombre),
      fisio: mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
      titulo: r.titulo,
      descripcion: r.descripcion,
      estado: r.estado,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      planAnterior: r.planAnterior ?? null,
      planSucesor: r.planSucesor ?? null,
      sucesorExiste: r.sucesorExiste ?? false,
      version: r.version,
    };
  }

  // ========= Helpers =========

  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
