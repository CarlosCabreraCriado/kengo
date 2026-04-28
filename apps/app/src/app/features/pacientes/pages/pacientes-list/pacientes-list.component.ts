import {
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { assetUrl } from '../../../../core/utils/asset-url';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/services/auth.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

//Componente Add-Paciente:
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';

//Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { MetricasPacientesService } from '../../data-access/metricas-pacientes.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { DialogService } from '../../../../shared';

import { Usuario, AsignacionResponsable, MetricasPacientesBulk } from '../../../../../types/global';
import { useResponsive, BackButtonComponent, AvatarComponent } from '../../../../shared';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

type FiltroActividad = 'todos' | 'activos' | 'inactivos';
type OrdenPacientes = 'nombre' | 'adherencia_desc' | 'adherencia_asc' | 'dolor_desc' | 'dolor_asc';
const STORAGE_KEY_FILTRO = 'kengo:mis-pacientes:filtro';

@Component({
  selector: 'app-pacientes-list',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    EmptyStateComponent,
    BackButtonComponent,
    AvatarComponent,
  ],
  templateUrl: './pacientes-list.component.html',
  styleUrl: './pacientes-list.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PacientesListComponent {
  private sessionService = inject(SessionService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  public planBuilderService = inject(PlanBuilderService);
  private planesService = inject(PlanesService);
  private authService = inject(AuthService);
  private asignacionesService = inject(AsignacionesService);
  private metricasService = inject(MetricasPacientesService);
  private clinicasService = inject(ClinicasService);
  private convex = inject(ConvexService);

  // Signal para alternar vista card/lista
  public vista = signal<'card' | 'lista'>('card');

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

  readonly ordenLabel = computed(() => {
    const labels: Record<OrdenPacientes, string> = {
      nombre: 'Nombre',
      adherencia_desc: 'Mayor adherencia',
      adherencia_asc: 'Menor adherencia',
      dolor_desc: 'Más dolor',
      dolor_asc: 'Menos dolor',
    };
    return labels[this.ordenActual()];
  });

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
  // El backend dedupelica por userId cuando un paciente pertenece a varias.
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

  setFiltro(filtro: FiltroActividad) {
    this.filtroActividad.set(filtro);
    try {
      localStorage.setItem(STORAGE_KEY_FILTRO, filtro);
    } catch { /* ignore */ }
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
    // Cargar asignaciones de la primera clínica
    this.asignacionesService.listarAsignaciones(String(cid[0])).subscribe({
      next: (asignaciones) => {
        const m = new Map<string, AsignacionResponsable>();
        for (const a of asignaciones) {
          m.set(a.idPaciente, a);
        }
        this.asignacionesMap.set(m);
      },
      error: () => {}, // silently ignore
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

  // Helpers
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

  verPlanes(p: Usuario) {
    this.planesService.clearFilters();
    this.planesService.setFiltroPaciente(p.id);
    this.router.navigate(['/planes']);
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

  adherenciaTier(value: number): 'alta' | 'media' | 'baja' {
    if (value >= 70) return 'alta';
    if (value >= 40) return 'media';
    return 'baja';
  }

  dolorTier(value: number): 'baja' | 'media' | 'alta' {
    if (value <= 3) return 'alta';   // dolor bajo → verde (bueno)
    if (value <= 6) return 'media';  // dolor medio → ámbar
    return 'baja';                   // dolor alto → rojo (malo)
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
      error: () => {},
    });
  }
}
