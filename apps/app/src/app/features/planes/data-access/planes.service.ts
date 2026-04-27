import {
  Injectable,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { assetUrl } from '../../../core/utils/asset-url';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { mapConvexBase, mapId } from '../../../shared/utils/convex-mappers';
import { api } from '../../../../../../../convex/_generated/api';

import {
  Plan,
  PlanCompleto,
  EjercicioPlan,
  EstadoPlan,
  Usuario,
  Ejercicio,
} from '../../../../types/global';

type FiltroEstado = 'todos' | EstadoPlan;

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroEstado: WritableSignal<FiltroEstado> = signal('todos');
  readonly filtroPaciente: WritableSignal<string | null> = signal(null);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

  private readonly plansQuery = this.convex.watchQuery(
    api.plans.queries.listByFisio,
    () => {
      const estado = this.filtroEstado();
      return {
        estado: estado === 'todos' ? undefined : (estado as any),
      };
    },
  );

  private readonly allPlanes = computed<Plan[]>(() => {
    const raw = this.plansQuery.value();
    if (!raw) return [];

    let result = (raw as any[]).map((r) => this.mapConvexToPlan(r));

    const busq = this.busqueda().toLowerCase().trim();
    if (busq) {
      result = result.filter(
        (p) =>
          p.titulo.toLowerCase().includes(busq) ||
          (typeof p.paciente === 'object' &&
            `${p.paciente.first_name} ${p.paciente.last_name}`
              .toLowerCase()
              .includes(busq)),
      );
    }

    const pacFilter = this.filtroPaciente();
    if (pacFilter) {
      result = result.filter((p) => {
        if (typeof p.paciente === 'object') {
          return p.paciente.id === pacFilter;
        }
        return p.paciente === pacFilter;
      });
    }

    return result;
  });

  private readonly paginatedPlanes = computed(() => {
    const all = this.allPlanes();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly planesRes = {
    value: computed(() => this.paginatedPlanes()),
    isLoading: this.plansQuery.isLoading,
    error: this.plansQuery.error,
    reload: () => {},
  };

  readonly planes = computed(() => this.paginatedPlanes());
  readonly isLoading = computed(() => this.plansQuery.isLoading());
  readonly total = computed(() => this.allPlanes().length);

  setBusqueda(v: string) {
    this.busqueda.set(v);
    this.page.set(1);
  }

  setFiltroEstado(v: FiltroEstado) {
    this.filtroEstado.set(v);
    this.page.set(1);
  }

  setFiltroPaciente(id: string | null) {
    this.filtroPaciente.set(id);
    this.page.set(1);
  }

  clearFilters() {
    this.busqueda.set('');
    this.filtroEstado.set('todos');
    this.filtroPaciente.set(null);
    this.page.set(1);
  }

  goToPage(p: number) {
    this.page.set(Math.max(1, p));
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
      return this.mapConvexToPlanCompleto(raw);
    } catch (error) {
      console.error('Error al obtener plan:', error);
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
      console.error('Error al actualizar estado:', error);
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
      console.error('Error al actualizar plan:', error);
      return false;
    }
  }

  async deletePlan(id: string): Promise<boolean> {
    return this.updateEstado(id, 'cancelado');
  }

  async deletePlanPermanente(id: string): Promise<boolean> {
    try {
      await this.convex.mutation(api.plans.mutations.remove, {
        planId: id as any,
      });
      return true;
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      return false;
    }
  }

  // ========= Planes por paciente =========

  async getPlanesActivosPaciente(pacienteId: string): Promise<PlanCompleto[]> {
    try {
      const raw = await this.convex.query(
        api.plans.queries.getActiveForPatientToday,
        { pacienteId },
      );
      return ((raw as any[]) || []).map((p) => this.mapConvexToPlanCompleto(p));
    } catch (error) {
      console.error('Error al obtener planes activos:', error);
      return [];
    }
  }

  async getPlanesActivosYFuturosPaciente(
    pacienteId: string,
  ): Promise<PlanCompleto[]> {
    try {
      const raw = await this.convex.query(api.plans.queries.getActiveAndFuture, {
        pacienteId,
      });
      return ((raw as any[]) || []).map((p) => this.mapConvexToPlanCompleto(p));
    } catch (error) {
      console.error('Error al obtener planes activos y futuros:', error);
      return [];
    }
  }

  async getPlanesByPaciente(pacienteId: string): Promise<Plan[]> {
    try {
      const raw = await this.convex.query(api.plans.queries.listByPaciente, {
        pacienteId,
      });
      return ((raw as any[]) || [])
        .filter((p) => p.estado !== 'cancelado')
        .map((p) => this.mapConvexToPlan(p));
    } catch (error) {
      console.error('Error al obtener planes del paciente:', error);
      return [];
    }
  }

  // ========= Mappers Convex → Domain =========

  private mapConvexToPlan(r: any): Plan {
    return {
      ...mapConvexBase(r),
      paciente: this.mapConvexToUsuarioBasico(
        r.pacienteId,
        r.pacienteNombre,
      ),
      fisio: this.mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
      titulo: r.titulo,
      descripcion: r.descripcion,
      estado: r.estado,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
    };
  }

  private mapConvexToPlanCompleto(r: any): PlanCompleto {
    return {
      ...mapConvexBase(r),
      paciente: this.mapConvexToUsuarioBasico(
        r.pacienteId,
        r.pacienteNombre,
      ),
      fisio: this.mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
      titulo: r.titulo,
      descripcion: r.descripcion,
      estado: r.estado,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      items: ((r.ejercicios || []) as any[])
        .map((e) => this.mapConvexToEjercicioPlan(e))
        .sort((a, b) => a.sort - b.sort),
    };
  }

  private mapConvexToUsuarioBasico(
    id: string,
    nombre: string | undefined,
  ): Usuario {
    const parts = (nombre || '').split(' ');
    return {
      id,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      email: '',
      email_verified: false,
      avatar: '',
      detalle: null,
      clinicas: [],
      esFisio: false,
      esPaciente: true,
    };
  }

  private mapConvexToEjercicioPlan(e: any): EjercicioPlan {
    return {
      id: mapId(e),
      sort: e.sort ?? 0,
      planId: e.planId,
      ejercicio: {
        id: mapId(e.ejercicio) || (e.exerciseId ?? ''),
        nombre: e.ejercicio?.nombreEjercicio ?? '',
        descripcion: e.ejercicio?.descripcion ?? '',
        video: e.ejercicio?.video ?? '',
        portada: e.ejercicio?.portada ?? '',
        categoria: [],
      } as Ejercicio,
      series: e.series,
      repeticiones: e.repeticiones,
      duracionSeg: e.duracionSeg,
      descansoSeg: e.descansoSeg,
      vecesDia: e.vecesDia,
      diasSemana: e.diasSemana,
      instruccionesPaciente: e.instruccionesPaciente,
      notasFisio: e.notasFisio,
    };
  }

  // ========= Helpers =========

  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
