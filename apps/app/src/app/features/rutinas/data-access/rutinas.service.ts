import {
  Injectable,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { assetUrl } from '../../../core/utils/asset-url';
import { ConvexService } from '../../../core/convex/convex.service';
import { EjerciciosService } from '../../ejercicios/data-access/ejercicios.service';
import { api } from '../../../../../../../convex/_generated/api';

import {
  Rutina,
  RutinaCompleta,
  EjercicioRutina,
  CreateRutinaPayload,
  VisibilidadRutina,
  Ejercicio,
} from '../../../../types/global';

type FiltroVisibilidad = 'todas' | 'privadas' | 'clinica';

@Injectable({ providedIn: 'root' })
export class RutinasService {
  private convex = inject(ConvexService);
  private ejerciciosService = inject(EjerciciosService);

  // --- Filtros como signals ---
  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroVisibilidad: WritableSignal<FiltroVisibilidad> = signal('todas');
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

  // Map interno: legacyId → convexId (para llamar mutations)
  private readonly idMap = new Map<number, string>();

  // Suscripción reactiva a rutinas via Convex
  private readonly routinesQuery = this.convex.watchQuery(
    api.routines.queries.list,
    () => {
      const vis = this.filtroVisibilidad();
      const visibilidad =
        vis === 'privadas' ? ('privado' as const) :
        vis === 'clinica' ? ('clinica' as const) :
        undefined;
      return { visibilidad, search: this.busqueda().trim() || undefined };
    },
  );

  // Mapear datos Convex → tipo Rutina
  private readonly allRutinas = computed<Rutina[]>(() => {
    const raw = this.routinesQuery.value();
    if (!raw) return [];

    this.idMap.clear();
    return (raw as any[]).map((r) => {
      const legacyId = r.legacyId ?? 0;
      this.idMap.set(legacyId, r._id);
      return {
        id_rutina: legacyId,
        nombre: r.nombre,
        descripcion: r.descripcion,
        autor: r.autorId,
        visibilidad: r.visibilidad,
        date_created: r._creationTime
          ? new Date(r._creationTime).toISOString()
          : undefined,
      } as Rutina;
    });
  });

  // Paginación client-side
  private readonly paginatedRutinas = computed(() => {
    const all = this.allRutinas();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  // Interfaz compatible con httpResource para los templates
  readonly rutinasRes = {
    value: computed(() => this.paginatedRutinas()),
    isLoading: this.routinesQuery.isLoading,
    error: this.routinesQuery.error,
    reload: () => {},
  };

  // Computed para la vista
  readonly rutinas = computed(() => this.paginatedRutinas());
  readonly isLoading = computed(() => this.routinesQuery.isLoading());
  readonly total = computed(() => this.allRutinas().length);

  // ========= Acciones (mutadores) =========

  setBusqueda(v: string) {
    this.busqueda.set(v);
    this.page.set(1);
  }

  setFiltroVisibilidad(v: FiltroVisibilidad) {
    this.filtroVisibilidad.set(v);
    this.page.set(1);
  }

  goToPage(p: number) {
    this.page.set(Math.max(1, p));
  }

  reload() {
    // No-op: datos en tiempo real via Convex
  }

  // ========= CRUD Methods =========

  /**
   * Obtener una rutina por ID con sus ejercicios
   */
  async getRutinaById(id: number): Promise<RutinaCompleta | null> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return null;

      const raw = await this.convex.query(
        api.routines.queries.getById,
        { routineId: convexId as any },
      );

      if (!raw) return null;
      return this.mapConvexToRutinaCompleta(raw);
    } catch (error) {
      console.error('Error al obtener rutina:', error);
      return null;
    }
  }

  /**
   * Crear una nueva rutina con sus ejercicios (atómico en Convex)
   */
  async createRutina(payload: CreateRutinaPayload): Promise<number | null> {
    try {
      const ejercicios = payload.ejercicios.map((item, idx) => ({
        exerciseId: this.resolveExerciseId(item.ejercicio),
        sort: item.sort ?? idx + 1,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracion_seg,
        descansoSeg: item.descanso_seg,
        vecesDia: item.veces_dia,
        diasSemana: item.dias_semana as any,
        instruccionesPaciente: item.instrucciones_paciente,
        notasFisio: item.notas_fisio,
      }));

      await this.convex.mutation(api.routines.mutations.create, {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        visibilidad: payload.visibilidad as 'privado' | 'clinica',
        ejercicios,
      });

      return 0; // El ID real se obtiene vía suscripción
    } catch (error) {
      console.error('Error al crear rutina:', error);
      return null;
    }
  }

  /**
   * Actualizar solo metadatos de una rutina
   */
  async updateRutina(
    id: number,
    payload: Partial<{
      nombre: string;
      descripcion: string;
      visibilidad: VisibilidadRutina;
    }>
  ): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      await this.convex.mutation(api.routines.mutations.update, {
        routineId: convexId as any,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        visibilidad: payload.visibilidad as 'privado' | 'clinica' | undefined,
      });

      return true;
    } catch (error) {
      console.error('Error al actualizar rutina:', error);
      return false;
    }
  }

  /**
   * Actualizar una rutina completa (datos + ejercicios, atómico en Convex)
   */
  async updateRutinaCompleta(
    id: number,
    payload: Omit<CreateRutinaPayload, 'autor'>
  ): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      const ejercicios = payload.ejercicios.map((item, idx) => ({
        exerciseId: this.resolveExerciseId(item.ejercicio),
        sort: item.sort ?? idx + 1,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracion_seg,
        descansoSeg: item.descanso_seg,
        vecesDia: item.veces_dia,
        diasSemana: item.dias_semana as any,
        instruccionesPaciente: item.instrucciones_paciente,
        notasFisio: item.notas_fisio,
      }));

      await this.convex.mutation(api.routines.mutations.update, {
        routineId: convexId as any,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        visibilidad: payload.visibilidad as 'privado' | 'clinica',
        ejercicios,
      });

      return true;
    } catch (error) {
      console.error('Error al actualizar rutina completa:', error);
      return false;
    }
  }

  /**
   * Eliminar una rutina
   */
  async deleteRutina(id: number): Promise<boolean> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return false;

      await this.convex.mutation(api.routines.mutations.remove, {
        routineId: convexId as any,
      });

      return true;
    } catch (error) {
      console.error('Error al eliminar rutina:', error);
      return false;
    }
  }

  /**
   * Duplicar una rutina (atómico en Convex)
   */
  async duplicarRutina(id: number, nuevoNombre: string): Promise<number | null> {
    try {
      const convexId = this.idMap.get(id);
      if (!convexId) return null;

      await this.convex.mutation(api.routines.mutations.duplicate, {
        routineId: convexId as any,
        nuevoNombre,
      });

      return 0; // El ID real se obtiene vía suscripción
    } catch (error) {
      console.error('Error al duplicar rutina:', error);
      return null;
    }
  }

  // ========= Mappers =========

  private mapConvexToRutinaCompleta(raw: any): RutinaCompleta {
    const autor = raw.autor;

    return {
      id_rutina: raw.legacyId ?? 0,
      nombre: raw.nombre,
      descripcion: raw.descripcion,
      visibilidad: raw.visibilidad,
      date_created: raw._creationTime
        ? new Date(raw._creationTime).toISOString()
        : undefined,
      autor: autor
        ? {
            id: autor._id,
            first_name: autor.firstName ?? '',
            last_name: autor.lastName ?? '',
            email: autor.email ?? '',
            email_verified: false,
            avatar: autor.avatar ?? null,
            clinicas: [],
            esFisio: true,
            esPaciente: false,
          }
        : ({} as any),
      ejercicios: (raw.ejercicios || []).map((re: any) =>
        this.mapConvexToEjercicioRutina(re),
      ),
    };
  }

  private mapConvexToEjercicioRutina(re: any): EjercicioRutina {
    const ej = re.ejercicio;
    return {
      id: 0,
      sort: re.sort ?? 0,
      rutina: 0,
      ejercicio: ej
        ? ({
            id_ejercicio: ej.legacyId ?? 0,
            nombre_ejercicio: ej.nombreEjercicio ?? '',
            descripcion: ej.descripcion ?? '',
            portada: ej.portada ?? '',
            video: ej.video ?? '',
            series_defecto: ej.seriesDefecto ?? '',
            repeticiones_defecto: ej.repeticionesDefecto ?? '',
            categoria: ej.categorias ?? [],
          } as Ejercicio)
        : ({} as Ejercicio),
      series: re.series,
      repeticiones: re.repeticiones,
      duracion_seg: re.duracionSeg,
      descanso_seg: re.descansoSeg,
      veces_dia: re.vecesDia,
      dias_semana: re.diasSemana,
      instrucciones_paciente: re.instruccionesPaciente,
      notas_fisio: re.notasFisio,
    };
  }

  /**
   * Resuelve un ID de ejercicio (legacy number) a Convex ID string.
   */
  private resolveExerciseId(legacyId: number): any {
    const convexId = this.ejerciciosService.legacyToConvexId().get(legacyId);
    if (!convexId) {
      throw new Error(`Ejercicio con legacyId ${legacyId} no encontrado`);
    }
    return convexId;
  }

  // ========= Helper de assets (Directus CDN durante la transición) =========
  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
