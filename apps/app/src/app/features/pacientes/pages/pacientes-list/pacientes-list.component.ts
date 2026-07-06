import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  HostListener,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { assetUrl } from '../../../../core/utils/asset-url';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { api } from '../../../../../../../../convex/_generated/api';

// Componente Add-Paciente:
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';

// Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { SubscriptionService } from '../../../../core/billing/subscription.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { MetricasPacientesService } from '../../data-access/metricas-pacientes.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { DialogService, useResponsive } from '../../../../shared';

import { Usuario, AsignacionResponsable, MetricasPacientesBulk } from '../../../../../types/global';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2ListRowComponent,
  Ui2PillComponent,
  Ui2SearchBoxComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SkeletonComponent,
} from '../../../../shared/ui-v2';

type FiltroActividad = 'todos' | 'activos' | 'inactivos';
type OrdenPacientes = 'nombre' | 'adherencia_desc' | 'adherencia_asc' | 'dolor_desc' | 'dolor_asc';
type Vista = 'card' | 'lista';

const STORAGE_KEY_FILTRO = 'kengo:mis-pacientes:filtro';

interface OrdenOption {
  value: OrdenPacientes;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-pacientes-list',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    Ui2AvatarComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2ListRowComponent,
    Ui2PillComponent,
    Ui2SearchBoxComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2SkeletonComponent,
  ],
  templateUrl: './pacientes-list.component.html',
  styleUrl: './pacientes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacientesListComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private subs = inject(SubscriptionService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  public planBuilderService = inject(PlanBuilderService);
  private authService = inject(AuthService);
  private asignacionesService = inject(AsignacionesService);
  private metricasService = inject(MetricasPacientesService);
  private clinicasService = inject(ClinicasService);
  private convex = inject(ConvexService);
  private pageLoader = inject(PageLoaderService);
  private destroyRef = inject(DestroyRef);
  private readonly PAGE_LOADER_KEY = 'pacientes-list';

  /**
   * Una vez la lista de pacientes ha cargado por primera vez, considera la
   * página lista para siempre. Los refetches posteriores (cambio de búsqueda,
   * de filtro o de clínica activa) NO deben reactivar el overlay global; el
   * feedback visual del refetch se da con skeletons locales en el listado.
   */
  private readonly hasLoadedOnce = signal(false);

  readonly pageReady = computed(() => {
    if (this.idsClinicas() === null) return false; // sesión aún no resuelta
    return this.hasLoadedOnce();
  });

  /** Refetch en curso tras la primera carga — se muestra solo en la lista. */
  readonly listaCargando = computed(
    () => this.hasLoadedOnce() && this.pacientesRes.isLoading(),
  );

  // Vista (toggle entre cuadrícula y lista)
  public vista = signal<Vista>('card');
  readonly vistaOptions: Ui2SegmentedOption[] = [
    { id: 'card', label: 'Cuadrícula', icon: 'grid_view' },
    { id: 'lista', label: 'Lista', icon: 'view_list' },
  ];

  readonly pacientesTabs: Ui2SegmentedOption[] = [
    { id: 'pacientes', label: 'Pacientes' },
    { id: 'asignacion', label: 'Asignación' },
  ];

  isMovil = useResponsive().esMobile;

  // Operamos siempre sobre la clínica activa. La lista de pacientes se filtra
  // a esa clínica y los `assignments`/métricas también. Se mantiene el helper
  // como array de un único id para conservar compatibilidad con las queries
  // Convex que aceptan `clinicIds: Id<"clinics">[]`.
  public idsClinicas = computed<string[] | null>(() => {
    if (this.sessionService.usuario() == null) return null;
    const id = this.clinicaActiva.selectedClinicaId();
    return id ? [id] : [];
  });

  // Asignaciones de fisio responsable
  readonly asignacionesMap = signal<Map<string, AsignacionResponsable>>(new Map());

  // Es admin en alguna clínica (delegado en SessionService)
  readonly esAdmin = this.sessionService.esAdmin;

  // Datos del usuario actual para la card "Auto-asignarme" — el fisio puede
  // abrir su propia ficha clínica como si fuera un paciente más.
  readonly me = this.sessionService.usuario;
  readonly miNombre = this.sessionService.nombreCompleto;
  readonly miAvatarUrl = computed<string | null>(() => {
    const a = this.sessionService.usuario()?.avatar;
    return a
      ? assetUrl(a, { fit: 'cover', width: 96, height: 96, quality: 80 })
      : null;
  });

  /**
   * Bloqueo de operaciones de escritura del fisio cuando la suscripción de su
   * clínica activa está suspendida. Pacientes no se ven afectados.
   */
  readonly bloqueoEscritura = computed(
    () => this.sessionService.enModoFisio() && this.subs.bloqueada(),
  );

  private readonly busqueda = signal('');
  readonly busquedaControl = new FormControl<string>('', { nonNullable: true });
  readonly filtroActividad = signal<FiltroActividad>(this.leerFiltroGuardado());
  readonly metricasMap = signal<MetricasPacientesBulk>({});
  readonly ordenActual = signal<OrdenPacientes>('nombre');
  readonly sortMenuAbierto = signal(false);

  readonly ordenOptions: OrdenOption[] = [
    { value: 'nombre',           label: 'Nombre',            icon: 'sort_by_alpha' },
    { value: 'adherencia_desc',  label: 'Mayor adherencia',  icon: 'trending_up' },
    { value: 'adherencia_asc',   label: 'Menor adherencia',  icon: 'trending_down' },
    { value: 'dolor_asc',        label: 'Menos dolor',       icon: 'sentiment_satisfied' },
    { value: 'dolor_desc',       label: 'Más dolor',         icon: 'sentiment_stressed' },
  ];

  readonly ordenLabel = computed(() => {
    const opt = this.ordenOptions.find((o) => o.value === this.ordenActual());
    return opt?.label ?? 'Nombre';
  });

  readonly filtroOptions = computed<Ui2SegmentedOption[]>(() => [
    { id: 'todos',     label: `Todos · ${this.totalPacientes()}` },
    { id: 'activos',   label: `Activos · ${this.conteoActivos()}` },
    { id: 'inactivos', label: `Inactivos · ${this.conteoInactivos()}` },
  ]);

  // Suscripción reactiva: pacientes con plan en curso dentro de mis clínicas.
  // "En curso" = estado='activo' AND fechas vigentes (hoy en zona Madrid).
  // Cubre planes creados por cualquier fisio del equipo, no solo el actual.
  private readonly pacientesActivosQuery = this.convex.watchQuery(
    api.plans.queries.listEnCursoPacientesInClinics,
    () => {
      const cid = this.idsClinicas();
      if (!cid || cid.length === 0) return 'skip';
      return { clinicIds: cid as never };
    },
  );

  readonly idsPacientesActivos = computed(() => {
    const ids = this.pacientesActivosQuery.value() ?? [];
    return new Set(ids as unknown as string[]);
  });

  readonly totalPacientes = computed(() => this.pacientesRes.value()?.length ?? 0);

  readonly conteoActivos = computed(() => {
    const todos = this.pacientesRes.value() ?? [];
    const activos = this.idsPacientesActivos();
    return todos.filter((p) => activos.has(p.convexId ?? p.id)).length;
  });

  readonly conteoInactivos = computed(() => this.totalPacientes() - this.conteoActivos());

  readonly pacientes = computed(() => {
    let lista = this.pacientesRes.value() ?? [];
    const filtro = this.filtroActividad();
    if (filtro !== 'todos') {
      const activos = this.idsPacientesActivos();
      lista = filtro === 'activos'
        ? lista.filter((p) => activos.has(p.convexId ?? p.id))
        : lista.filter((p) => !activos.has(p.convexId ?? p.id));
    }

    const orden = this.ordenActual();
    if (orden === 'nombre') return lista;

    const metricas = this.metricasMap();
    return [...lista].sort((a, b) => {
      const ma = metricas[a.id];
      const mb = metricas[b.id];
      switch (orden) {
        case 'adherencia_desc':
          return (mb?.adherencia ?? -1) - (ma?.adherencia ?? -1);
        case 'adherencia_asc':
          return (ma?.adherencia ?? 999) - (mb?.adherencia ?? 999);
        case 'dolor_desc':
          return (mb?.dolorPromedio ?? -1) - (ma?.dolorPromedio ?? -1);
        case 'dolor_asc':
          return (ma?.dolorPromedio ?? 999) - (mb?.dolorPromedio ?? 999);
        default:
          return 0;
      }
    });
  });

  // Suscripción reactiva a pacientes de TODAS las clínicas del fisio.
  private readonly pacientesQuery = this.convex.watchQuery(
    api.users.queries.listPatientsByClinic,
    () => {
      const cid = this.idsClinicas();
      if (!cid || cid.length === 0) return 'skip';
      return {
        clinicIds: cid as never,
        search: this.busqueda().trim() || undefined,
        limit: 200,
      };
    },
  );

  readonly pacientesRes = {
    // Computed puro: solo mapea el resultado de la query. La carga de datos
    // complementarios (asignaciones + métricas) vive en un `effect()` del
    // constructor, no aquí, para no mezclar lectura con efectos de red.
    value: computed<Usuario[]>(() => {
      const result = this.pacientesQuery.value();
      if (!result) return [];
      return result.results.map((u) =>
        this.sessionService.transformarUsuarioConvex(u),
      );
    }),
    isLoading: this.pacientesQuery.isLoading,
    error: this.pacientesQuery.error,
    reload: () => {
      // No-op: Convex watchQuery se actualiza automáticamente
    },
  };

  constructor() {
    // Búsqueda con debounce: evita re-suscribir Convex en cada tecla.
    this.busquedaControl.valueChanges
      .pipe(
        map((v) => (v ?? '').trim()),
        distinctUntilChanged(),
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((v) => this.busqueda.set(v));

    // Cuando llega (o cambia) el listado de pacientes, recarga datos
    // complementarios vía HTTP. Se traquea solo `pacientesQuery.value()`;
    // las cargas van en `untracked` para no re-disparar el effect por sus
    // lecturas internas (p. ej. `idsClinicas()`).
    effect(() => {
      const result = this.pacientesQuery.value();
      if (!result) return;
      untracked(() => {
        this.cargarAsignaciones();
        this.cargarMetricas();
      });
    });

    // Marca la página como "ya cargada" la primera vez que la query
    // devuelve un resultado (o cuando no hay clínica que consultar, en cuyo
    // caso la query está en 'skip' permanente). A partir de ahí, los
    // refetches reactivos no muestran el overlay global.
    effect(() => {
      if (this.hasLoadedOnce()) return;
      const cid = this.idsClinicas();
      if (cid !== null && cid.length === 0) {
        this.hasLoadedOnce.set(true);
        return;
      }
      if (this.pacientesQuery.value() !== undefined) {
        this.hasLoadedOnce.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  /**
   * True mientras las métricas (HTTP) están cargando — para mostrar skeleton.
   * Se basa en un flag que se activa tras la primera respuesta (éxito o
   * error), no en si el mapa está vacío: una clínica sin métricas dejaría el
   * skeleton encendido para siempre.
   */
  private readonly metricasCargadas = signal(false);
  readonly metricasCargando = computed(() => !this.metricasCargadas());

  avatarUrl(p: Usuario): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${assetUrl(id_avatar, { fit: 'cover', width: 96, height: 96, quality: 80 })}`
      : null;
  }

  seleccionarPaciente(p: Usuario) {
    this.planBuilderService.prepareForPaciente(p);
    this.planBuilderService.navigateAndOpenDrawer();
  }

  /**
   * Abre la ficha clínica del propio fisio como un paciente más. Backend
   * acepta el acceso porque la membresía fisio/admin lleva
   * `tambienEsPaciente: true`. No cambia el rol activo.
   */
  verMeComoPaciente(): void {
    const u = this.sessionService.usuario();
    if (!u) return;
    this.router.navigate(['/mis-pacientes', u.id]);
  }

  openAddPaciente() {
    const dialogRef = this.dialogService.open(AddPacienteDialogComponent, {
      maxWidth: '520px',
      data: {},
    });

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r: unknown) => {
        const result = r as
          | { created?: { id: string }; updated?: boolean }
          | undefined;
        if (result?.created) {
          this.router.navigate(['/mis-pacientes', result.created.id]);
        } else if (result?.updated) {
          this.pacientesRes.reload();
        }
      });
  }

  openEditarPaciente(p: Usuario) {
    const dialogRef = this.dialogService.open(AddPacienteDialogComponent, {
      maxWidth: '520px',
      data: { usuario: p },
    });

    dialogRef.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r: unknown) => {
        const result = r as { updated?: boolean } | undefined;
        if (result?.updated) this.pacientesRes.reload();
      });
  }

  setVista(value: string) {
    if (value === 'card' || value === 'lista') {
      this.vista.set(value);
    }
  }

  setFiltro(value: string) {
    if (value === 'todos' || value === 'activos' || value === 'inactivos') {
      this.filtroActividad.set(value);
      try {
        localStorage.setItem(STORAGE_KEY_FILTRO, value);
      } catch { /* ignore */ }
    }
  }

  private leerFiltroGuardado(): FiltroActividad {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILTRO);
      if (saved === 'todos' || saved === 'activos' || saved === 'inactivos') {
        return saved;
      }
    } catch { /* ignore */ }
    return 'todos';
  }

  reload() {
    // Convex watchQuery se actualiza solo; solo refrescamos lo que va por HTTP.
    this.cargarAsignaciones();
    this.cargarMetricas();
  }

  private cargarAsignaciones() {
    const cid = this.idsClinicas();
    if (!cid || cid.length === 0) return;
    this.asignacionesService
      .listarAsignaciones(String(cid[0]))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asignaciones) => {
          const m = new Map<string, AsignacionResponsable>();
          for (const a of asignaciones) {
            m.set(a.idPaciente, a);
          }
          this.asignacionesMap.set(m);
        },
        error: () => undefined,
      });
  }

  getFisioResponsableNombre(pacienteId: string): string | null {
    const a = this.asignacionesMap().get(pacienteId);
    if (!a) return null;
    const fn = (a.nombreFisio || '').trim();
    const ln = (a.apellidoFisio || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : null;
  }

  irAsignacion() {
    this.router.navigate(['/mis-pacientes', 'asignacion']);
  }

  onPacientesTabChange(value: string) {
    if (value === 'asignacion') {
      this.router.navigate(['/mis-pacientes', 'asignacion']);
    }
  }

  fullName(u: Usuario) {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : u.email || u.id;
  }

  getInitials(u: Usuario): string {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
    if (fn) return fn.substring(0, 2).toUpperCase();
    if (ln) return ln.substring(0, 2).toUpperCase();
    if (u.email) return u.email.substring(0, 2).toUpperCase();
    return '??';
  }

  verDetalle(p: Usuario) {
    this.router.navigate(['/mis-pacientes', p.id]);
  }

  getClinicaNombre(p: Usuario): string | null {
    if (!p.clinicas || p.clinicas.length === 0) return null;
    const clinicId = p.clinicas[0].clinicId;
    const clinica = this.clinicasService
      .misClinicasRes
      .value()
      ?.find((c) => c.id === clinicId);
    return clinica?.nombre ?? null;
  }

  // Métricas de pacientes
  getAdherencia(pacienteId: string): number | null {
    const m = this.metricasMap()[pacienteId];
    return m ? m.adherencia : null;
  }

  getDolorPromedio(pacienteId: string): number | null {
    const m = this.metricasMap()[pacienteId];
    return m?.dolorPromedio ?? null;
  }

  adherenciaColor(value: number): string {
    if (value >= 70) return 'var(--success)';
    if (value >= 40) return 'var(--warning)';
    return 'var(--danger)';
  }

  dolorColor(value: number): string {
    if (value <= 3) return 'var(--success)';
    if (value <= 6) return 'var(--warning)';
    return 'var(--danger)';
  }

  dolorIcon(value: number): string {
    if (value <= 3) return 'sentiment_satisfied';
    if (value <= 6) return 'sentiment_neutral';
    return 'sentiment_stressed';
  }

  @HostListener('document:click')
  cerrarSortMenu() {
    if (this.sortMenuAbierto()) {
      this.sortMenuAbierto.set(false);
    }
  }

  setOrden(orden: OrdenPacientes) {
    this.ordenActual.set(orden);
    this.sortMenuAbierto.set(false);
  }

  private cargarMetricas() {
    this.metricasService
      .getMetricasBulk()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metricas) => {
          this.metricasMap.set(metricas);
          this.metricasCargadas.set(true);
        },
        error: () => this.metricasCargadas.set(true),
      });
  }
}
