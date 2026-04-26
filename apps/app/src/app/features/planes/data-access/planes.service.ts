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

  // --- Filtros como signals ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroEstado: WritableSignal<FiltroEstado> = signal('todos');
  readonly filtroPaciente: WritableSignal<string | null> = signal(null);
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

  // Map interno: legacyId → convexId (para resolver IDs en mutations)
  private readonly idMap = new Map<number, string>();
  // Map inverso: convexId → legacyId
  private readonly reverseIdMap = new Map<string, number>();

  // Suscripción reactiva a planes via Convex
  private readonly plansQuery = this.convex.watchQuery(
    api.plans.queries.listByFisio,
    () => {
      const estado = this.filtroEstado();
      return {
        estado: estado === 'todos' ? undefined : (estado as any),
      };
    },
  );

  // Mapear datos Convex → tipo Plan con filtros client-side
  private readonly allPlanes = computed<Plan[]>(() => {
    const raw = this.plansQuery.value();
    if (!raw) return [];

    this.idMap.clear();
    this.reverseIdMap.clear();

    let result = (raw as any[]).map((r) => {
      const legacyId = r.legacyId ?? 0;
      this.idMap.set(legacyId, r._id);
      this.reverseIdMap.set(r._id, legacyId);
      return this.mapConvexToPlan(r);
    });

    // Filtro por búsqueda (titulo)
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

    // Filtro por paciente
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

  // Paginación client-side
  private readonly paginatedPlanes = computed(() => {
    const all = this.allPlanes();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  // Interfaz compatible con httpResource para los templates
  readonly planesRes = {
    value: computed(() => this.paginatedPlanes()),
    isLoading: this.plansQuery.isLoading,
    error: this.plansQuery.error,
    reload: () => {},
  };

  // Computed para la vista
  readonly planes = computed(() => this.paginatedPlanes());
  readonly isLoading = computed(() => this.plansQuery.isLoading());
  readonly total = computed(() => this.allPlanes().length);

  // ========= Acciones (mutadores) =========

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
    // No-op: datos en tiempo real via Convex
  }

  // ========= Resolución de IDs =========

  resolveConvexId(legacyId: number): string | undefined {
    return this.idMap.get(legacyId);
  }

  resolveLegacyId(convexId: string): number {
    return this.reverseIdMap.get(convexId) ?? 0;
  }

  // ========= CRUD Methods =========

  async getPlanById(id: number): Promise<PlanCompleto | null> {
    try {
      // Intentar resolver por idMap primero
      const convexId = this.idMap.get(id);
      let raw: any;

      if (convexId) {
        raw = await this.convex.query(api.plans.queries.getById, {
          planId: convexId as any,
        });
      } else {
        // Fallback: buscar por legacyId (navegación directa)
        raw = await this.convex.query(api.plans.queries.getByLegacyId, {
          legacyId: id,
        });
      }

      if (!raw) return null;

      // Registrar en idMap si no estaba
      if (raw.legacyId && !this.idMap.has(raw.legacyId)) {
        this.idMap.set(raw.legacyId, raw._id);
        this.reverseIdMap.set(raw._id, raw.legacyId);
      }

      return this.mapConvexToPlanCompleto(raw);
    } catch (error) {
      console.error('Error al obtener plan:', error);
      return null;
    }
  }

  async updateEstado(id: number, estado: EstadoPlan): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      await this.convex.mutation(api.plans.mutations.updateEstado, {
        planId: convexId as any,
        estado: estado as any,
      });
      return true;
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return false;
    }
  }

  async updatePlan(
    id: number,
    payload: Partial<{
      titulo: string;
      descripcion: string;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      estado: EstadoPlan;
    }>,
  ): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      await this.convex.mutation(api.plans.mutations.update, {
        planId: convexId as any,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        fechaInicio: payload.fecha_inicio ?? undefined,
        fechaFin: payload.fecha_fin ?? undefined,
      });

      return true;
    } catch (error) {
      console.error('Error al actualizar plan:', error);
      return false;
    }
  }

  async deletePlan(id: number): Promise<boolean> {
    return this.updateEstado(id, 'cancelado');
  }

  async deletePlanPermanente(id: number): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      await this.convex.mutation(api.plans.mutations.remove, {
        planId: convexId as any,
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
      id_plan: r.legacyId ?? 0,
      paciente: this.mapConvexToUsuarioBasico(
        r.pacienteId,
        r.pacienteNombre,
      ),
      fisio: this.mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
      titulo: r.titulo,
      descripcion: r.descripcion,
      estado: r.estado,
      fecha_inicio: r.fechaInicio,
      fecha_fin: r.fechaFin,
      date_created: r._creationTime
        ? new Date(r._creationTime).toISOString()
        : undefined,
      // Store Convex ID for direct access
      _convexId: r._id,
    } as Plan;
  }

  private mapConvexToPlanCompleto(r: any): PlanCompleto {
    return {
      id_plan: r.legacyId ?? 0,
      paciente: this.mapConvexToUsuarioBasico(
        r.pacienteId,
        r.pacienteNombre,
      ),
      fisio: this.mapConvexToUsuarioBasico(r.fisioId, r.fisioNombre),
      titulo: r.titulo,
      descripcion: r.descripcion,
      estado: r.estado,
      fecha_inicio: r.fechaInicio,
      fecha_fin: r.fechaFin,
      date_created: r._creationTime
        ? new Date(r._creationTime).toISOString()
        : undefined,
      items: ((r.ejercicios || []) as any[])
        .map((e) => this.mapConvexToEjercicioPlan(e))
        .sort((a, b) => a.sort - b.sort),
      _convexId: r._id,
    } as PlanCompleto;
  }

  private mapConvexToUsuarioBasico(
    id: string,
    nombre: string | undefined,
  ): Usuario {
    const parts = (nombre || '').split(' ');
    return {
      id: id as any,
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
      id: e.legacyId ?? 0,
      sort: e.sort ?? 0,
      plan: e.planId,
      ejercicio: {
        id_ejercicio: e.ejercicio?.legacyId ?? 0,
        nombre_ejercicio:
          e.ejercicio?.nombreEjercicio || e.ejercicioNombre || '',
        descripcion: e.ejercicio?.descripcion ?? '',
        video: e.ejercicio?.video ?? '',
        portada: e.ejercicio?.portada ?? '',
        _convexId: e.exerciseId,
      } as unknown as Ejercicio,
      series: e.series,
      repeticiones: e.repeticiones,
      duracion_seg: e.duracionSeg,
      descanso_seg: e.descansoSeg,
      veces_dia: e.vecesDia,
      dias_semana: e.diasSemana,
      instrucciones_paciente: e.instruccionesPaciente,
      notas_fisio: e.notasFisio,
      _convexId: e._id,
      _exerciseConvexId: e.exerciseId,
    } as EjercicioPlan;
  }

  // ========= Helpers =========

  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
