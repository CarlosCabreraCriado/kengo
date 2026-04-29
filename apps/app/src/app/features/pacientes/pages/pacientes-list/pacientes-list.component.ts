import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { assetUrl } from '../../../../core/utils/asset-url';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

// Componente Add-Paciente:
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';

// Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { MetricasPacientesService } from '../../data-access/metricas-pacientes.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { DialogService, useResponsive } from '../../../../shared';

import { Usuario, AsignacionResponsable, MetricasPacientesBulk } from '../../../../../types/global';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2EmptyStateComponent,
  Ui2ListRowComponent,
  Ui2PillComponent,
  Ui2SearchBoxComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
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
    Ui2AvatarComponent,
    Ui2ButtonComponent,
    Ui2EmptyStateComponent,
    Ui2ListRowComponent,
    Ui2PillComponent,
    Ui2SearchBoxComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './pacientes-list.component.html',
  styleUrl: './pacientes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacientesListComponent {
  private sessionService = inject(SessionService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  public planBuilderService = inject(PlanBuilderService);
  private authService = inject(AuthService);
  private asignacionesService = inject(AsignacionesService);
  private metricasService = inject(MetricasPacientesService);
  private clinicasService = inject(ClinicasService);
  private convex = inject(ConvexService);

  // Vista (toggle entre cuadrícula y lista)
  public vista = signal<Vista>('card');
  readonly vistaOptions: Ui2SegmentedOption[] = [
    { id: 'card', label: 'Cuadrícula', icon: 'grid_view' },
    { id: 'lista', label: 'Lista', icon: 'view_list' },
  ];

  isMovil = useResponsive().esMobile;

  public idsClinicas = computed(() => {
    if (this.sessionService.usuario() == null) return null;
    return this.sessionService.usuario()?.clinicas.map((c) => c.clinicId) || [];
  });

  // Asignaciones de fisio responsable
  readonly asignacionesMap = signal<Map<string, AsignacionResponsable>>(new Map());

  // Es admin en alguna clínica (delegado en SessionService)
  readonly esAdmin = this.sessionService.esAdmin;

  private readonly busqueda = signal('');
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

  // Suscripción reactiva a planes activos del fisio para derivar IDs de pacientes activos
  private readonly planesActivosQuery = this.convex.watchQuery(
    api.plans.queries.listByFisio,
    () => {
      const cid = this.idsClinicas();
      if (!cid || cid.length === 0) return 'skip';
      return { estado: 'activo' as const };
    },
  );

  readonly idsPacientesActivos = computed(() => {
    const planes = this.planesActivosQuery.value() ?? [];
    return new Set(
      planes
        .map((p) => p.pacienteId as unknown as string)
        .filter(Boolean),
    );
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
    value: computed<Usuario[]>(() => {
      const result = this.pacientesQuery.value();
      if (!result) return [];
      const usuarios = result.results.map((u) =>
        this.sessionService.transformarUsuarioConvex(u),
      );
      // Disparar carga de datos complementarios cuando llegan los pacientes
      queueMicrotask(() => {
        this.cargarAsignaciones();
        this.cargarMetricas();
      });
      return usuarios;
    }),
    isLoading: this.pacientesQuery.isLoading,
    error: this.pacientesQuery.error,
    reload: () => {
      // No-op: Convex watchQuery se actualiza automáticamente
    },
  };

  avatarUrl(p: Usuario): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${assetUrl(id_avatar, { fit: 'cover', width: 96, height: 96, quality: 80 })}`
      : null;
  }

  onBuscar = (term: string) => {
    this.busqueda.set((term ?? '').trim());
  };

  seleccionarPaciente(p: Usuario) {
    this.planBuilderService.prepareForPaciente(p);
    this.planBuilderService.navigateAndOpenDrawer();
  }

  openAddPaciente() {
    const dialogRef = this.dialogService.open(AddPacienteDialogComponent, {
      maxWidth: '520px',
      data: { idsClinicas: this.idsClinicas() },
    });

    dialogRef.closed.subscribe((r: unknown) => {
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
      data: { idsClinicas: this.idsClinicas(), usuario: p },
    });

    dialogRef.closed.subscribe((r: unknown) => {
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
    this.asignacionesService.listarAsignaciones(String(cid[0])).subscribe({
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
    this.metricasService.getMetricasBulk().subscribe({
      next: (metricas) => this.metricasMap.set(metricas),
      error: () => undefined,
    });
  }
}
