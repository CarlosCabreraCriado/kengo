import {
  Injectable,
  computed,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { assetUrl } from '../../../core/utils/asset-url';
import { ConvexService } from '../../../core/convex/convex.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { mapConvexBase, mapId } from '../../../shared/utils/convex-mappers';
import {
  createFilteredList,
  type FilteredList,
} from '../../../shared/data-access/create-filtered-list';
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
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private logger = inject(LoggerService);

  readonly filtroVisibilidad: WritableSignal<FiltroVisibilidad> = signal('todas');

  private readonly routinesQuery = this.convex.watchQuery(
    api.routines.queries.list,
    () => {
      if (!this.sessionService.usuario()?.id) return 'skip' as const;
      const vis = this.filtroVisibilidad();
      const visibilidad =
        vis === 'privadas' ? ('privado' as const) :
        vis === 'clinica' ? ('clinica' as const) :
        undefined;
      return { visibilidad, search: this.busqueda().trim() || undefined };
    },
  );

  private readonly rawRutinas: Signal<Rutina[]> = computed<Rutina[]>(() => {
    const raw: unknown = this.routinesQuery.value();
    if (!raw) return [];

    return (raw as any[]).map((r) => ({
      ...mapConvexBase(r),
      nombre: r.nombre,
      descripcion: r.descripcion,
      autor: r.autorId,
      visibilidad: r.visibilidad,
    }));
  });

  // Caso server-side: la búsqueda viaja en el query Convex; el factory
  // sólo aporta paginación y signals base. No se pasa `searchPredicate`.
  private readonly _list: FilteredList<Rutina> = createFilteredList<Rutina>({
    source: this.rawRutinas,
  });

  readonly busqueda: WritableSignal<string> = this._list.busqueda;
  readonly page: WritableSignal<number> = this._list.page;
  readonly pageSize: WritableSignal<number> = this._list.pageSize;
  readonly total: Signal<number> = this._list.total;
  readonly totalPages: Signal<number> = this._list.totalPages;

  readonly rutinasRes = {
    value: this._list.items,
    isLoading: this.routinesQuery.isLoading,
    error: this.routinesQuery.error,
    reload: () => {},
  };

  readonly rutinas = this._list.items;
  readonly isLoading = computed(() => this.routinesQuery.isLoading());

  setBusqueda(v: string) {
    this._list.setBusqueda(v);
  }

  setFiltroVisibilidad(v: FiltroVisibilidad) {
    this.filtroVisibilidad.set(v);
    this._list.resetPage();
  }

  goToPage(p: number) {
    this._list.goToPage(p);
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
      this.logger.error('Error al obtener rutina:', error);
      return null;
    }
  }

  async createRutina(payload: CreateRutinaPayload): Promise<string | null> {
    try {
      const ejercicios = payload.ejercicios.map((item, idx) => ({
        exerciseId: item.ejercicio as any,
        sort: item.sort ?? idx + 1,
        tipo: item.tipo,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracionSeg,
        descansoSeg: item.descansoSeg,
        diasSemana: item.diasSemana as any,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
      }));

      const visibilidad = payload.visibilidad as 'privado' | 'clinica';
      // Aislamiento por clínica (Bloque E): si la rutina es "de clínica",
      // enviamos `clinicId` de la clínica activa; el backend valida que
      // esa clínica tenga suscripción activa antes de aceptar la creación.
      const clinicId =
        visibilidad === 'clinica'
          ? this.clinicaActiva.selectedClinicaId()
          : null;

      if (visibilidad === 'clinica' && !clinicId) {
        this.logger.error(
          'Error al crear rutina: visibilidad "clinica" sin clínica activa seleccionada',
        );
        return null;
      }

      const id = await this.convex.mutation(api.routines.mutations.create, {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        visibilidad,
        clinicId: (clinicId ?? undefined) as never,
        ejercicios,
      });

      return (id as string) ?? null;
    } catch (error) {
      this.logger.error('Error al crear rutina:', error);
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
      this.logger.error('Error al actualizar rutina:', error);
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
        tipo: item.tipo,
        series: item.series,
        repeticiones: item.repeticiones,
        duracionSeg: item.duracionSeg,
        descansoSeg: item.descansoSeg,
        diasSemana: item.diasSemana as any,
        instruccionesPaciente: item.instruccionesPaciente,
        notasFisio: item.notasFisio,
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
      this.logger.error('Error al actualizar rutina completa:', error);
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
      this.logger.error('Error al eliminar rutina:', error);
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
      this.logger.error('Error al duplicar rutina:', error);
      return null;
    }
  }

  private mapConvexToRutinaCompleta(raw: any): RutinaCompleta {
    const autor = raw.autor;

    return {
      ...mapConvexBase(raw),
      nombre: raw.nombre,
      descripcion: raw.descripcion,
      visibilidad: raw.visibilidad,
      autor: autor
        ? {
            id: mapId(autor),
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
      id: mapId(re),
      sort: re.sort ?? 0,
      rutinaId,
      ejercicio: ej
        ? ({
            id: mapId(ej),
            nombre: ej.nombreEjercicio ?? '',
            descripcion: ej.descripcion ?? '',
            portada: ej.portada ?? '',
            video: ej.video ?? '',
            tipo: ej.tipo,
            seriesDefecto: ej.seriesDefecto,
            repeticionesDefecto: ej.repeticionesDefecto,
            duracionDefectoSeg: ej.duracionDefectoSeg,
            categoria: ej.categorias ?? [],
          } as Ejercicio)
        : ({} as Ejercicio),
      tipo: re.tipo ?? re.ejercicio?.tipo,
      series: re.series,
      repeticiones: re.repeticiones,
      duracionSeg: re.duracionSeg,
      descansoSeg: re.descansoSeg,
      diasSemana: re.diasSemana,
      instruccionesPaciente: re.instruccionesPaciente,
      notasFisio: re.notasFisio,
    };
  }

  getAssetUrl(id?: string, width = 200, height = 200) {
    return id
      ? assetUrl(id, { width, height, fit: 'cover', format: 'webp' })
      : '';
  }
}
