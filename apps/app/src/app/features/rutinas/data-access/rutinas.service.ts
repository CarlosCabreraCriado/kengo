import {
  Injectable,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { assetUrl } from '../../../core/utils/asset-url';
import { ConvexService } from '../../../core/convex/convex.service';
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

  readonly busqueda: WritableSignal<string> = signal('');
  readonly filtroVisibilidad: WritableSignal<FiltroVisibilidad> = signal('todas');
  readonly page: WritableSignal<number> = signal(1);
  readonly pageSize: WritableSignal<number> = signal(20);

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

  private readonly allRutinas = computed<Rutina[]>(() => {
    const raw = this.routinesQuery.value();
    if (!raw) return [];

    return (raw as any[]).map((r) => ({
      id_rutina: r._id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      autor: r.autorId,
      visibilidad: r.visibilidad,
      date_created: r._creationTime
        ? new Date(r._creationTime).toISOString()
        : undefined,
    }));
  });

  private readonly paginatedRutinas = computed(() => {
    const all = this.allRutinas();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly rutinasRes = {
    value: computed(() => this.paginatedRutinas()),
    isLoading: this.routinesQuery.isLoading,
    error: this.routinesQuery.error,
    reload: () => {},
  };

  readonly rutinas = computed(() => this.paginatedRutinas());
  readonly isLoading = computed(() => this.routinesQuery.isLoading());
  readonly total = computed(() => this.allRutinas().length);

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
    // No-op
  }

  // ========= CRUD Methods =========

  async getRutinaById(id: string): Promise<RutinaCompleta | null> {
    try {
      const raw = await this.convex.query(
        api.routines.queries.getById,
        { routineId: id as any },
      );
      if (!raw) return null;
      return this.mapConvexToRutinaCompleta(raw);
    } catch (error) {
      console.error('Error al obtener rutina:', error);
      return null;
    }
  }

  async createRutina(payload: CreateRutinaPayload): Promise<string | null> {
    try {
      const ejercicios = payload.ejercicios.map((item, idx) => ({
        exerciseId: item.ejercicio as any,
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

      const id = await this.convex.mutation(api.routines.mutations.create, {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        visibilidad: payload.visibilidad as 'privado' | 'clinica',
        ejercicios,
      });

      return (id as string) ?? null;
    } catch (error) {
      console.error('Error al crear rutina:', error);
      return null;
    }
  }

  async updateRutina(
    id: string,
    payload: Partial<{
      nombre: string;
      descripcion: string;
      visibilidad: VisibilidadRutina;
    }>
  ): Promise<boolean> {
    try {
      await this.convex.mutation(api.routines.mutations.update, {
        routineId: id as any,
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

  async updateRutinaCompleta(
    id: string,
    payload: Omit<CreateRutinaPayload, 'autor'>
  ): Promise<boolean> {
    try {
      const ejercicios = payload.ejercicios.map((item, idx) => ({
        exerciseId: item.ejercicio as any,
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
        routineId: id as any,
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

  async deleteRutina(id: string): Promise<boolean> {
    try {
      await this.convex.mutation(api.routines.mutations.remove, {
        routineId: id as any,
      });
      return true;
    } catch (error) {
      console.error('Error al eliminar rutina:', error);
      return false;
    }
  }

  async duplicarRutina(id: string, nuevoNombre: string): Promise<string | null> {
    try {
      const newId = await this.convex.mutation(api.routines.mutations.duplicate, {
        routineId: id as any,
        nuevoNombre,
      });
      return (newId as string) ?? null;
    } catch (error) {
      console.error('Error al duplicar rutina:', error);
      return null;
    }
  }

  private mapConvexToRutinaCompleta(raw: any): RutinaCompleta {
    const autor = raw.autor;

    return {
      id_rutina: raw._id,
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
            detalle: null,
            clinicas: [],
            esFisio: true,
            esPaciente: false,
          }
        : ({} as any),
      ejercicios: (raw.ejercicios || []).map((re: any) =>
        this.mapConvexToEjercicioRutina(re, raw._id),
      ),
    };
  }

  private mapConvexToEjercicioRutina(re: any, rutinaId: string): EjercicioRutina {
    const ej = re.ejercicio;
    return {
      id: re._id,
      sort: re.sort ?? 0,
      rutina: rutinaId,
      ejercicio: ej
        ? ({
            id_ejercicio: ej._id ?? '',
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

  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
