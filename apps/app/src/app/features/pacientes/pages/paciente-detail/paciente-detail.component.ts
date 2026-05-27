import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { assetUrl } from '../../../../core/utils/asset-url';
import { useResponsive } from '../../../../shared';

// Servicios (mismos que paciente-detail actual)
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanesService } from '../../../planes/data-access/planes.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import { CumplimientoService } from '../../data-access/cumplimiento.service';
import { ComentariosPacienteService } from '../../data-access/comentarios-paciente.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { MensajesService } from '../../../mensajes/data-access/mensajes.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';
import {
  getMadridDate,
  offsetMadridDate,
} from '../../../../shared/utils/madrid-date.util';

// Diálogos
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { GestionAccesoDialogComponent } from '../../components/gestion-acceso-dialog/gestion-acceso-dialog.component';

// UI v2
import {
  Ui2CollapsibleComponent,
  Ui2EmptyStateComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

// Subcomponentes V2
import { PdHeroComponent, PdHeroMeta } from './componentes/pd-hero/pd-hero.component';
import { PdKpiStripComponent, PdKpiVm } from './componentes/pd-kpi-strip/pd-kpi-strip.component';
import { PdInactivityBannerComponent } from './componentes/pd-inactivity-banner/pd-inactivity-banner.component';
import { PdWeeklyBarsCardComponent } from './componentes/pd-weekly-bars-card/pd-weekly-bars-card.component';
import { PdActivityTimelineComponent } from './componentes/pd-activity-timeline/pd-activity-timeline.component';
import { PdActivePlanCardComponent } from './componentes/pd-active-plan-card/pd-active-plan-card.component';
import { PdPlansListComponent } from './componentes/pd-plans-list/pd-plans-list.component';
import { PdCommentsComponent } from './componentes/pd-comments/pd-comments.component';
import {
  PdPacienteDataComponent,
  PdPacienteMeta,
} from './componentes/pd-paciente-data/pd-paciente-data.component';

// Tipos
import {
  NotificacionFisio,
  Plan,
  RegistroEjercicioRecord,
  Usuario,
} from '../../../../../types/global';
import {
  EstadisticasPaciente,
  SesionAgrupada,
} from '../../data-access/paciente-detail.types';

const RANGO_DIAS = 15;

interface ConvexExecutionRecord {
  _id: string;
  planExerciseId: string;
  pacienteId: string;
  fechaHora: string;
  completado: boolean;
  repeticionesRealizadas?: number;
  duracionRealSeg?: number;
  dolorEscala?: number;
  notaPaciente?: string;
}

interface DialogClosedResult {
  updated?: boolean;
}

@Component({
  selector: 'app-paciente-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2CollapsibleComponent,
    Ui2EmptyStateComponent,
    Ui2SpinnerComponent,
    PdHeroComponent,
    PdKpiStripComponent,
    PdInactivityBannerComponent,
    PdWeeklyBarsCardComponent,
    PdActivityTimelineComponent,
    PdActivePlanCardComponent,
    PdPlansListComponent,
    PdCommentsComponent,
    PdPacienteDataComponent,
  ],
  template: `
    <section class="pd2-page" [class.pd2-page--mobile]="isMovil()">
      <main class="pd2-main" [class.pd2-main--mobile]="isMovil()">
        @if (isLoadingPaciente()) {
          <div class="pd2-state">
            <ui2-spinner />
            <p>Cargando paciente…</p>
          </div>
        } @else if (error()) {
          <ui2-empty-state
            icon="error"
            title="Algo salió mal"
            [message]="error()"
            actionLabel="Volver a pacientes"
            actionIcon="arrow_back"
            (action)="volver()"
          />
        } @else if (paciente()) {
          <app-pd-hero
            [paciente]="paciente()"
            [fullName]="fullName()"
            [avatarUrl]="avatarUrl()"
            [meta]="heroMeta()"
            [lastActivityDays]="diasUltimaActividad()"
            [enviandoMensaje]="enviandoMensaje()"
            [isMobile]="isMovil()"
            (enviarMensaje)="onEnviarMensaje()"
            (crearPlan)="crearPlan()"
            (editarPaciente)="editarPaciente()"
            (gestionarAcceso)="gestionarAcceso()"
            (volver)="volver()"
          />

          <app-pd-kpi-strip [kpis]="kpisVm()" />

          <app-pd-inactivity-banner
            [dias]="diasUltimaActividad()"
            (recordar)="onEnviarMensaje()"
          />

          @if (!isMovil()) {
            <div class="pd2-grid">
              <div class="pd2-col pd2-col--main">
                <app-pd-weekly-bars-card
                  [weeks]="estadisticas()?.adherenciaSemanal ?? []"
                  [rangoLabel]="rangoLabel"
                />
                <app-pd-activity-timeline
                  [sesiones]="sesionesVisibles()"
                  [notificacionesPorRegistro]="notificacionesPorRegistro()"
                  [fechaExpandida]="sesionExpandida()"
                  [totalSesiones]="sesiones().length"
                  [rangoLabel]="rangoLabel"
                  [diasProgramados]="diasProgramados()"
                  [diasSinActividad]="diasSinActividad()"
                  [isLoading]="isLoadingSesiones()"
                  (verSesion)="verSesion($event)"
                  (toggleComentarios)="toggleComentarios($event)"
                  (marcarComentarioRevisado)="marcarComentarioRevisado($event)"
                />
              </div>
              <aside class="pd2-col pd2-col--side">
                <app-pd-active-plan-card
                  [plan]="planActivo()"
                  (verPlan)="verPlan($event)"
                  (crearPlan)="crearPlan()"
                />
                <app-pd-plans-list
                  [planes]="planes()"
                  [isLoading]="isLoadingPlanes()"
                  (verPlan)="verPlan($event)"
                  (crearPlan)="crearPlan()"
                />
                <app-pd-comments
                  [comentarios]="comentarios()"
                  [comentariosPendientes]="comentariosPendientes()"
                  [isLoading]="isLoadingComentarios()"
                  (irASesion)="irASesionComentario($event)"
                  (marcarRevisado)="marcarComentarioRevisado($event)"
                  (marcarTodosRevisados)="marcarTodosRevisados()"
                />
              </aside>
            </div>
          } @else {
            <ui2-collapsible title="Plan activo" [defaultOpen]="true">
              <app-pd-active-plan-card
                [plan]="planActivo()"
                [bare]="true"
                (verPlan)="verPlan($event)"
                (crearPlan)="crearPlan()"
              />
            </ui2-collapsible>

            <ui2-collapsible title="Adherencia semanal" [defaultOpen]="true">
              <app-pd-weekly-bars-card
                [weeks]="estadisticas()?.adherenciaSemanal ?? []"
                [rangoLabel]="rangoLabel"
                [bare]="true"
              />
            </ui2-collapsible>

            <ui2-collapsible
              title="Actividad"
              [count]="sesiones().length"
              [defaultOpen]="false"
            >
              <app-pd-activity-timeline
                [sesiones]="sesionesVisibles()"
                [notificacionesPorRegistro]="notificacionesPorRegistro()"
                [fechaExpandida]="sesionExpandida()"
                [totalSesiones]="sesiones().length"
                [rangoLabel]="rangoLabel"
                [diasProgramados]="diasProgramados()"
                [diasSinActividad]="diasSinActividad()"
                [isLoading]="isLoadingSesiones()"
                [bare]="true"
                (verSesion)="verSesion($event)"
                (toggleComentarios)="toggleComentarios($event)"
                (marcarComentarioRevisado)="marcarComentarioRevisado($event)"
              />
            </ui2-collapsible>

            <ui2-collapsible
              title="Planes asignados"
              [count]="planes().length"
              [defaultOpen]="false"
            >
              <app-pd-plans-list
                [planes]="planes()"
                [isLoading]="isLoadingPlanes()"
                [bare]="true"
                (verPlan)="verPlan($event)"
                (crearPlan)="crearPlan()"
              />
            </ui2-collapsible>

            <ui2-collapsible
              title="Comentarios"
              [count]="comentariosPendientes() || null"
              [defaultOpen]="false"
            >
              <app-pd-comments
                [comentarios]="comentarios()"
                [comentariosPendientes]="comentariosPendientes()"
                [isLoading]="isLoadingComentarios()"
                [bare]="true"
                (irASesion)="irASesionComentario($event)"
                (marcarRevisado)="marcarComentarioRevisado($event)"
                (marcarTodosRevisados)="marcarTodosRevisados()"
              />
            </ui2-collapsible>

            <ui2-collapsible title="Datos del paciente" [defaultOpen]="false">
              <app-pd-paciente-data
                [paciente]="paciente()"
                [meta]="dataMeta()"
              />
            </ui2-collapsible>
          }
        }
      </main>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .pd2-page {
        display: flex;
        flex-direction: column;
      }

      .pd2-main {
        padding: 28px 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
      }
      .pd2-main--mobile {
        padding: 8px 16px 16px;
        gap: 12px;
      }

      .pd2-state {
        display: grid;
        place-items: center;
        gap: 12px;
        padding: 48px 16px;
      }
      .pd2-state p {
        font-size: 13px;
        color: var(--ink-500);
        margin: 0;
      }

      .pd2-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
        gap: 24px;
        align-items: flex-start;
      }
      .pd2-col {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }
      .pd2-col--side {
        position: sticky;
        top: 16px;
        align-self: flex-start;
      }
    `,
  ],
})
export class PacienteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialogService = inject(DialogService);
  private sessionService = inject(SessionService);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private cumplimientoService = inject(CumplimientoService);
  private comentariosService = inject(ComentariosPacienteService);
  private asignacionesService = inject(AsignacionesService);
  private clinicasService = inject(ClinicasService);
  private mensajesService = inject(MensajesService);
  private toast = inject(ToastService);
  private convex = inject(ConvexService);

  private readonly responsive = useResponsive();
  readonly isMovil = this.responsive.esMobile;

  // Estado
  readonly paciente = signal<Usuario | null>(null);
  readonly planes = signal<Plan[]>([]);
  readonly sesiones = signal<SesionAgrupada[]>([]);
  readonly estadisticas = signal<EstadisticasPaciente | null>(null);
  // Dolor del snapshot 15d: misma fuente que el listado /mis-pacientes,
  // tiene prioridad sobre el cálculo en cliente para que ambos KPIs coincidan.
  readonly dolorSnapshot = signal<number | null>(null);
  readonly trend = signal<{ adherence: number | null; pain: number | null }>({
    adherence: null,
    pain: null,
  });

  readonly isLoadingPaciente = signal(true);
  readonly isLoadingPlanes = signal(true);
  readonly isLoadingSesiones = signal(true);
  readonly isLoadingEstadisticas = signal(true);
  readonly isLoadingComentarios = signal(true);

  readonly comentarios = signal<NotificacionFisio[]>([]);
  readonly comentariosPendientes = signal<number>(0);

  readonly fisioResponsableNombre = signal<string | null>(null);
  readonly enviandoMensaje = signal(false);
  readonly error = signal<string | null>(null);
  readonly sesionExpandida = signal<string | null>(null);

  readonly rangoLabel = `${RANGO_DIAS} días`;

  // Computeds
  readonly idsClinicas = computed(
    () => this.sessionService.usuario()?.clinicas.map((c) => c.clinicId) ?? [],
  );

  readonly avatarUrl = computed<string | null>(() => {
    const p = this.paciente();
    if (!p?.avatar) return null;
    return assetUrl(p.avatar, { fit: 'cover', width: 128, height: 128, quality: 80 });
  });

  readonly fullName = computed<string>(() => {
    const p = this.paciente();
    if (!p) return '';
    const fn = (p.first_name || '').trim();
    const ln = (p.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : p.email || p.id;
  });

  readonly clinicaNombre = computed<string | null>(() => {
    const p = this.paciente();
    if (!p?.clinicas || p.clinicas.length === 0) return null;
    const clinicId = p.clinicas[0].clinicId;
    const clinica = this.clinicasService.misClinicasRes
      .value()
      ?.find((c) => c.id === clinicId);
    return clinica?.nombre ?? null;
  });

  readonly heroMeta = computed<PdHeroMeta>(() => ({
    fisio: this.fisioResponsableNombre(),
    clinica: this.clinicaNombre(),
  }));

  readonly dataMeta = computed<PdPacienteMeta>(() => ({
    fisio: this.fisioResponsableNombre(),
    clinica: this.clinicaNombre(),
  }));

  readonly diasUltimaActividad = computed<number | null>(
    () => this.estadisticas()?.diasDesdeUltimaSesion ?? null,
  );

  readonly planActivo = computed<Plan | null>(
    () => this.planes().find((p) => p.estado === 'activo') ?? null,
  );

  readonly sesionesEnriquecidas = computed(() =>
    this.cumplimientoService.enriquecerSesionesConNotificaciones(
      this.sesiones(),
      this.comentarios(),
    ),
  );

  readonly sesionesVisibles = computed(() => this.sesionesEnriquecidas().slice(0, 15));

  readonly notificacionesPorRegistro = computed(() => {
    const map: Record<string, NotificacionFisio> = {};
    for (const n of this.comentarios()) {
      if (n.id != null) map[String(n.id)] = n;
    }
    return map;
  });

  readonly kpisVm = computed<PdKpiVm[]>(() => {
    const stats = this.estadisticas();
    const t = this.trend();
    if (!stats) return [];
    // El valor del KPI Dolor proviene del snapshot 15d cuando está disponible
    // (misma fuente que el listado). Como fallback usamos el cálculo en
    // cliente — debería coincidir, ver buildEstadisticas en CumplimientoService.
    const dolorValor =
      this.dolorSnapshot() ?? stats.promedioDolorGeneral;
    return [
      {
        label: 'Adherencia',
        value: `${stats.adherenciaGeneral}`,
        unit: '%',
        ringValue: stats.adherenciaGeneral / 100,
        trend: t.adherence,
        trendSuffix: '%',
      },
      {
        label: 'Sesiones',
        value: `${stats.totalSesiones}`,
        ringValue: Math.min(1, stats.totalSesiones / RANGO_DIAS),
      },
      {
        label: 'Dolor',
        value: dolorValor != null ? dolorValor.toFixed(1) : '–',
        unit: dolorValor != null ? '/10' : '',
        ringValue: dolorValor != null ? dolorValor / 10 : 0,
        ringColor: this.painRingColor(dolorValor),
        trend: t.pain,
        trendInverse: true,
        trendDecimals: 1,
      },
      {
        label: 'Racha',
        value: `${stats.rachaActual}`,
        unit: stats.rachaActual === 1 ? 'día' : 'días',
        ringValue: Math.min(1, stats.rachaActual / 30),
        ringColor: stats.rachaActual > 0 ? '#f59e0b' : 'var(--ink-300)',
      },
    ];
  });

  ngOnInit(): void {
    const pacienteId = this.route.snapshot.params['id'];
    if (!pacienteId) {
      this.router.navigate(['/mis-pacientes']);
      return;
    }
    this.cargarPaciente(pacienteId);
    this.cargarPlanes(pacienteId);
    this.cargarCumplimiento(pacienteId);
    this.cargarSnapshotDolor(pacienteId);
    this.cargarComentarios(pacienteId);
    this.cargarFisioResponsable(pacienteId);
  }

  private async cargarSnapshotDolor(pacienteId: string): Promise<void> {
    try {
      const snap = (await this.convex.query(
        api.snapshots.queries.getPatientMetricsByPaciente,
        { pacienteId: pacienteId as never, ventana: '15d' },
      )) as { dolorPromedio?: number } | null;
      this.dolorSnapshot.set(snap?.dolorPromedio ?? null);
    } catch (err) {
      console.error('Error cargando snapshot de dolor:', err);
      this.dolorSnapshot.set(null);
    }
  }

  // === Carga de datos ===

  private async cargarPaciente(id: string): Promise<void> {
    this.isLoadingPaciente.set(true);
    this.error.set(null);
    try {
      const data = await this.convex.query(api.users.queries.getById, {
        userId: id as never,
      });
      if (data) {
        this.paciente.set(this.sessionService.transformarUsuarioConvex(data));
      } else {
        this.error.set('Paciente no encontrado');
        this.router.navigate(['/mis-pacientes']);
      }
    } catch (err) {
      console.error('Error cargando paciente:', err);
      this.error.set('Error al cargar el paciente');
    } finally {
      this.isLoadingPaciente.set(false);
    }
  }

  private async cargarPlanes(pacienteId: string): Promise<void> {
    this.isLoadingPlanes.set(true);
    try {
      const planes = await this.planesService.getPlanesByPaciente(pacienteId);
      const hoyYMD = getMadridDate();
      const corregidos = planes.map((plan) => {
        if (
          plan.estado === 'activo' &&
          plan.fechaFin &&
          plan.fechaFin < hoyYMD
        ) {
          return { ...plan, estado: 'completado' as const };
        }
        return plan;
      });
      this.planes.set(corregidos);
    } catch (err) {
      console.error('Error cargando planes:', err);
    } finally {
      this.isLoadingPlanes.set(false);
    }
  }

  private async cargarCumplimiento(pacienteId: string): Promise<void> {
    this.isLoadingSesiones.set(true);
    this.isLoadingEstadisticas.set(true);

    try {
      const hasta = getMadridDate();
      const desde = offsetMadridDate(-(RANGO_DIAS - 1));

      const { actual, trend } =
        await this.cumplimientoService.getCumplimientoConTendencia(
          pacienteId,
          desde,
          hasta,
        );

      this.trend.set(trend);

      const dias = actual.dias;
      const diasConActividad = dias.filter(
        (d) => d.tipo !== 'fallido' && d.tipo !== 'descanso',
      );
      const registros: RegistroEjercicioRecord[] =
        diasConActividad.length > 0
          ? await this.cargarRegistrosParaFechas(
              pacienteId,
              diasConActividad.map((d) => d.fecha),
            )
          : [];

      const sesionesAg = this.cumplimientoService.buildSesionesAgrupadas(
        dias,
        registros,
        this.comentarios(),
      );
      // Sesiones más recientes primero.
      this.sesiones.set([...sesionesAg].reverse());
      this.estadisticas.set(
        this.cumplimientoService.buildEstadisticas(dias, sesionesAg, actual.resumen),
      );
    } catch (err) {
      console.error('Error cargando cumplimiento:', err);
    } finally {
      this.isLoadingSesiones.set(false);
      this.isLoadingEstadisticas.set(false);
    }
  }

  private async cargarRegistrosParaFechas(
    pacienteId: string,
    fechas: string[],
  ): Promise<RegistroEjercicioRecord[]> {
    const sorted = [...fechas].sort();
    const desde = sorted[0];
    const hasta = sorted[sorted.length - 1];

    const records = (await this.convex.query(
      api.executions.queries.listByPacienteInRange,
      { pacienteId, desde, hasta, soloCompletados: true },
    )) as ConvexExecutionRecord[];

    return (records ?? []).map((r) => ({
      id: r._id,
      planItemId: r.planExerciseId,
      pacienteId: r.pacienteId,
      fechaHora: r.fechaHora,
      completado: r.completado,
      repeticionesRealizadas: r.repeticionesRealizadas,
      duracionRealSeg: r.duracionRealSeg,
      dolorEscala: r.dolorEscala,
      notaPaciente: r.notaPaciente,
    }));
  }

  private async cargarComentarios(pacienteId: string): Promise<void> {
    this.isLoadingComentarios.set(true);
    try {
      const response = await this.comentariosService.getComentarios(pacienteId);
      this.comentarios.set(response.comentarios);
      this.comentariosPendientes.set(response.pendientes);
    } catch (err) {
      console.error('Error cargando comentarios:', err);
    } finally {
      this.isLoadingComentarios.set(false);
    }
  }

  private cargarFisioResponsable(pacienteId: string): void {
    const clinicas = this.idsClinicas();
    if (!clinicas.length) return;
    this.asignacionesService
      .getFisioResponsable(pacienteId, String(clinicas[0]))
      .subscribe({
        next: (asignacion) => {
          if (asignacion) {
            const fn = (asignacion.nombreFisio ?? '').trim();
            const ln = (asignacion.apellidoFisio ?? '').trim();
            this.fisioResponsableNombre.set(
              fn || ln ? `${fn} ${ln}`.trim() : null,
            );
          }
        },
        error: () => undefined,
      });
  }

  // === Comentarios ===

  async marcarComentarioRevisado(comentario: NotificacionFisio): Promise<void> {
    if (comentario.revisada) return;
    this.comentarios.update((list) =>
      list.map((c) =>
        c.id === comentario.id
          ? { ...c, revisada: true, fechaRevision: new Date().toISOString() }
          : c,
      ),
    );
    this.comentariosPendientes.update((n) => Math.max(0, n - 1));
    try {
      await this.comentariosService.marcarRevisada(comentario.id);
    } catch (err) {
      console.error('Error marcando comentario:', err);
      this.comentarios.update((list) =>
        list.map((c) =>
          c.id === comentario.id
            ? { ...c, revisada: false, fechaRevision: null }
            : c,
        ),
      );
      this.comentariosPendientes.update((n) => n + 1);
    }
  }

  async marcarTodosRevisados(): Promise<void> {
    const pacienteId = this.route.snapshot.params['id'];
    if (!pacienteId) return;
    const prevComentarios = this.comentarios();
    const prevPendientes = this.comentariosPendientes();
    this.comentarios.update((list) =>
      list.map((c) => ({
        ...c,
        revisada: true,
        fechaRevision: c.fechaRevision || new Date().toISOString(),
      })),
    );
    this.comentariosPendientes.set(0);
    try {
      await this.comentariosService.marcarTodasRevisadas(pacienteId);
    } catch (err) {
      console.error('Error marcando todos:', err);
      this.comentarios.set(prevComentarios);
      this.comentariosPendientes.set(prevPendientes);
    }
  }

  // === Helpers UI ===

  toggleComentarios(fecha: string): void {
    this.sesionExpandida.update((c) => (c === fecha ? null : fecha));
  }

  diasSinActividad(): number {
    return this.sesiones().filter((s) => s.tipo === 'fallido').length;
  }

  diasProgramados(): number {
    return this.sesiones().filter((s) => s.tipo !== 'descanso').length;
  }

  private painRingColor(dolor: number | null): string {
    if (dolor == null) return 'var(--ink-300)';
    if (dolor <= 3) return '#16a34a';
    if (dolor <= 6) return '#efc048';
    return '#ef4444';
  }

  // === Acciones ===

  volver(): void {
    this.router.navigate(['/mis-pacientes']);
  }

  editarPaciente(): void {
    const p = this.paciente();
    if (!p) return;
    this.dialogService
      .open(AddPacienteDialogComponent, {
        maxWidth: '520px',
        data: { clinicIds: this.idsClinicas(), usuario: p },
      })
      .closed.subscribe((r: unknown) => {
        if ((r as DialogClosedResult | undefined)?.updated) {
          this.cargarPaciente(p.id);
        }
      });
  }

  gestionarAcceso(): void {
    const p = this.paciente();
    if (!p) return;
    this.dialogService.open(GestionAccesoDialogComponent, {
      data: { paciente: p },
      maxWidth: '400px',
    });
  }

  crearPlan(): void {
    const p = this.paciente();
    if (!p) return;
    this.planBuilderService.prepareForPaciente(p);
    this.planBuilderService.navigateAndOpenDrawer();
  }

  async onEnviarMensaje(): Promise<void> {
    const p = this.paciente();
    if (!p?.id || this.enviandoMensaje()) return;
    this.enviandoMensaje.set(true);
    try {
      const conversationId =
        await this.mensajesService.startConversationWithPatient(p.id);
      if (conversationId) {
        this.router.navigate(['/mensajes', conversationId]);
      } else {
        this.toast.error('No se pudo iniciar la conversación con este paciente.');
      }
    } finally {
      this.enviandoMensaje.set(false);
    }
  }

  verPlan(plan: Plan): void {
    this.router.navigate(['/planes', plan.id]);
  }

  verSesion(sesion: SesionAgrupada): void {
    if (sesion.tipo === 'descanso') return;
    const pacienteId = this.route.snapshot.params['id'];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', sesion.fecha]);
  }

  irASesionComentario(comentario: NotificacionFisio): void {
    const pacienteId = this.route.snapshot.params['id'];
    const fecha = comentario.fechaRegistro.split('T')[0];
    this.router.navigate(['/mis-pacientes', pacienteId, 'sesion', fecha]);
  }
}
