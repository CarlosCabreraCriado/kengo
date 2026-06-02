import { Component, ChangeDetectionStrategy, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { DashboardFisioService } from '../../../data-access/dashboard-fisio.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import { PlanBuilderService } from '../../../../planes/data-access/plan-builder.service';
import { RutinaBuilderService } from '../../../../rutinas/data-access/rutina-builder.service';
import { PageLoaderService } from '../../../../../core/services/page-loader.service';
import type { NotificacionApp, PlanPorVencer, Usuario } from '../../../../../../types/global';
import { rawAssetUrl, assetUrl } from '../../../../../core/utils/asset-url';
import {
  daysBetweenYMD,
  getMadridDate,
  offsetMadridDate,
  ymdMadridFromInstant,
} from '../../../../../shared/utils/madrid-date.util';
import {
  Ui2CardComponent,
  Ui2ClinicHeroCardComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2KpiCardComponent,
  Ui2ListRowComponent,
  Ui2MiniStatComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2WebActivityChartComponent,
} from '../../../../../shared/ui-v2';

@Component({
  selector: 'app-inicio-fisio',
  standalone: true,
  imports: [
    Ui2CardComponent,
    Ui2ClinicHeroCardComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2KpiCardComponent,
    Ui2ListRowComponent,
    Ui2MiniStatComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2WebActivityChartComponent,
  ],
  templateUrl: './inicio-fisio.component.html',
  styleUrl: './inicio-fisio.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioFisioComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private clinicasService = inject(ClinicasService);
  private dialog = inject(Dialog);
  private planBuilderService = inject(PlanBuilderService);
  private rutinaBuilderService = inject(RutinaBuilderService);
  private pageLoader = inject(PageLoaderService);
  private destroyRef = inject(DestroyRef);
  private readonly PAGE_LOADER_KEY = 'inicio-fisio';

  dashboardService = inject(DashboardFisioService);
  notificacionesService = inject(NotificacionesService);

  /** Datos críticos: clínicas gestionadas resueltas. */
  readonly pageReady = computed(() => this.dashboardService.cargada());

  // --- Saludo / hero ---
  firstName = computed(() => this.sessionService.usuario()?.first_name ?? '');

  alertasCount = this.notificacionesService.pendientes;

  planesCount = computed(() => this.dashboardService.planesProximosAExpirar().length);

  /** Hay al menos un plan que vence en ≤2 días (urgencia alta). */
  hayPlanesUrgentes = computed(() =>
    this.dashboardService
      .planesProximosAExpirar()
      .some((p) => this.diasParaVencer(p.fechaFin) <= 2),
  );

  /** Estado general para decidir título y CTA del hero. */
  estadoSituacion = computed<'urgente' | 'pendiente' | 'tranquilo' | 'cargando'>(() => {
    if (this.dashboardService.cargando()) return 'cargando';
    if (this.hayPlanesUrgentes() || this.alertasCount() > 0) return 'urgente';
    if (this.planesCount() > 0) return 'pendiente';
    return 'tranquilo';
  });

  heroTitle = computed(() => {
    const e = this.estadoSituacion();
    if (e === 'cargando') return '';
    return 'PANEL DEL FISIO';
  });

  heroSub = computed<string>(() => {
    if (this.estadoSituacion() === 'cargando') return 'Cargando…';
    const partes: string[] = [];
    const pacientes = this.dashboardService.pacientesActivos();
    if (pacientes > 0) {
      partes.push(`<b>${pacientes}</b> ${pacientes === 1 ? 'paciente activo' : 'pacientes activos'}`);
    }
    if (this.alertasCount() > 0) {
      partes.push(
        `<b>${this.alertasCount()}</b> ${this.alertasCount() === 1 ? 'alerta' : 'alertas'}`,
      );
    }
    if (this.planesCount() > 0) {
      partes.push(
        `<b>${this.planesCount()}</b> ${this.planesCount() === 1 ? 'plan por vencer' : 'planes por vencer'}`,
      );
    }
    return partes.length > 0 ? partes.join(' · ') : 'Sin alertas. Disfruta del día.';
  });

  heroSubDesktop = computed<string>(() => {
    if (this.estadoSituacion() === 'cargando') return 'Cargando…';
    return 'Crea planes, asigna rutinas y sigue la adherencia de tus pacientes en tiempo real.';
  });

  // --- KPIs ---
  adherenciaTier = computed(() => {
    const v = this.dashboardService.adherenciaPromedio();
    if (v >= 70) return 'alta';
    if (v >= 40) return 'media';
    return 'baja';
  });

  adherenciaDelta = computed(() => {
    const t = this.adherenciaTier();
    if (t === 'alta') return '↑ excelente';
    if (t === 'media') return 'puede mejorar';
    return '↓ atención';
  });

  adherenciaDeltaColor = computed(() => {
    const t = this.adherenciaTier();
    if (t === 'alta') return 'var(--success)';
    if (t === 'media') return 'var(--warning)';
    return 'var(--danger)';
  });

  // --- Notificaciones recientes ---
  notificacionesRecientes = computed(() =>
    this.notificacionesService.notificaciones()
      .filter((n) => !n.leida)
      .slice(0, 5),
  );

  hayNotificacionesRecientes = computed(() => this.notificacionesRecientes().length > 0);

  // --- Planes por vencer ---
  planesPorVencer = this.dashboardService.planesProximosAExpirar;

  diasParaVencer(fechaFin: string): number {
    // `fechaFin` viene como YYYY-MM-DD (calendario Madrid). `daysBetweenYMD`
    // cuenta días enteros del calendario, estable frente a DST.
    return daysBetweenYMD(getMadridDate(), fechaFin);
  }

  textoVencimiento(plan: PlanPorVencer): string {
    const dias = this.diasParaVencer(plan.fechaFin);
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Vence en ${dias} días`;
  }

  iconoUrgencia(plan: PlanPorVencer): string {
    return this.diasParaVencer(plan.fechaFin) <= 2 ? 'warning' : 'schedule';
  }

  colorUrgencia(plan: PlanPorVencer): string {
    return this.diasParaVencer(plan.fechaFin) <= 2 ? 'var(--danger)' : 'var(--warning)';
  }

  formatearTiempoRelativo(fecha: string): string {
    // `fecha` es un instante absoluto (ISO con `Z`). Las primeras
    // ramas (Ahora / Hace X min / Hace Xh) son sobre tiempo absoluto, así
    // que `Date.now() - new Date(fecha).getTime()` es correcto.
    const ahora = Date.now();
    const diff = ahora - new Date(fecha).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const horas = Math.floor(mins / 60);
    if (horas < 24) return `Hace ${horas}h`;

    // A partir de "Ayer" estamos comparando días calendario Madrid.
    const fechaYMD = ymdMadridFromInstant(fecha);
    const ayerYMD = offsetMadridDate(-1);
    if (fechaYMD === ayerYMD) return 'Ayer';
    return new Date(fecha).toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: 'numeric',
      month: 'short',
    });
  }

  emisorAvatarUrl(avatar: string | null): string | null {
    if (!avatar) return null;
    return assetUrl(avatar, { key: 'avatar' });
  }

  // --- Clínica ---
  clinicaActual = this.clinicasService.selectedClinica;

  clinicaImagenUrl = computed<string | null>(() => {
    const fileId = this.clinicaActual()?.imagenes?.[0]?.fileId;
    return fileId ? rawAssetUrl(fileId) : null;
  });

  // ============================================================
  // Datos mockeados (TODO: cablear con backend real)
  // ============================================================

  /** Sesiones que el fisio espera/registra hoy. TODO: cablear con snapshots.sesionesHoy. */
  readonly sesionesHoyMock = signal<number>(0);

  ngOnInit(): void {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  // --- Navegación ---
  irANotificacion(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
    this.router.navigate([n.rutaDestino]);
  }

  irACrearPlan(): void {
    if (this.rutinaBuilderService.isActive()) {
      this.rutinaBuilderService.openDrawer();
      return;
    }
    if (this.planBuilderService.paciente()) {
      this.planBuilderService.openDrawer();
      return;
    }
    void this.iniciarCreacionPlan();
  }

  private async iniciarCreacionPlan(): Promise<void> {
    const paciente = await this.seleccionarPaciente();
    if (!paciente) return;

    this.planBuilderService.paciente.set(paciente);
    localStorage.setItem('carrito:last_paciente_id', paciente.id);
    const fisioId = this.planBuilderService.fisioId();
    if (fisioId) {
      localStorage.setItem('carrito:last_fisio_id', fisioId);
    }
    this.planBuilderService.openDrawer();
  }

  private async seleccionarPaciente(): Promise<Usuario | null> {
    const { SelectorPacienteComponent } = await import(
      '../../../../../shared/ui/selector-paciente/selector-paciente.component'
    );

    const dialogRef = this.dialog.open<Usuario>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });

    return new Promise((resolve) => {
      dialogRef.closed
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((paciente) => resolve(paciente ?? null));
    });
  }

  irAPaciente(pacienteId: string): void {
    this.router.navigate(['/mis-pacientes', pacienteId]);
  }

  irAPacientes(): void {
    this.router.navigate(['/mis-pacientes']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }

  /** CTA primary del hero — varía según el estado: alertas urgentes, planes, etc. */
  ctaPrincipal(): void {
    if (this.estadoSituacion() === 'urgente' || this.estadoSituacion() === 'pendiente') {
      this.irAPacientes();
    } else {
      this.irACrearPlan();
    }
  }
}
