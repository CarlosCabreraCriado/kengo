import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardFisioService } from '../../../data-access/dashboard-fisio.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { ClinicasService } from '../../../../clinica/data-access/clinicas.service';
import type { Clinica, NotificacionApp, PlanPorVencer } from '../../../../../../types/global';
import { rawAssetUrl, assetUrl } from '../../../../../core/utils/asset-url';
import {
  Ui2ActivityDay,
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
export class InicioFisioComponent {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private clinicasService = inject(ClinicasService);

  dashboardService = inject(DashboardFisioService);
  notificacionesService = inject(NotificacionesService);

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
    if (e === 'urgente') return 'REVISA LO URGENTE';
    if (e === 'pendiente') return 'VAMOS A POR HOY';
    return 'TODO BAJO CONTROL 🌿';
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
    const pacientes = this.dashboardService.pacientesActivos();
    const adherencia = this.dashboardService.adherenciaPromedio();
    const alertas = this.alertasCount();
    const planes = this.planesCount();

    if (pacientes === 0) {
      return 'Aún no tienes pacientes activos. Empieza añadiendo uno desde Mi Clínica.';
    }
    const adhTxt = `adherencia media <b>${adherencia}%</b>`;
    if (alertas > 0 && planes > 0) {
      return `Tienes <b>${pacientes} pacientes</b> · ${adhTxt} · <b>${alertas} alertas</b> y <b>${planes} planes</b> por revisar.`;
    }
    if (alertas > 0) {
      return `Tienes <b>${pacientes} pacientes</b> · ${adhTxt}. <b>${alertas} alertas</b> requieren tu atención.`;
    }
    if (planes > 0) {
      return `Tienes <b>${pacientes} pacientes</b> · ${adhTxt}. <b>${planes} planes</b> por vencer en los próximos días.`;
    }
    return `Tienes <b>${pacientes} pacientes</b> · ${adhTxt}. Sin alertas pendientes.`;
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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
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
    const ahora = Date.now();
    const diff = ahora - new Date(fecha).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const horas = Math.floor(mins / 60);
    if (horas < 24) return `Hace ${horas}h`;
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(0, 0, 0, 0);
    if (new Date(fecha) >= ayer) return 'Ayer';
    return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  emisorAvatarUrl(avatar: string | null): string | null {
    if (!avatar) return null;
    return assetUrl(avatar, { key: 'avatar' });
  }

  // --- Clínica ---
  clinicaActual = computed<Clinica | null>(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    if (clinicas.length === 0) return null;
    return clinicas[0];
  });

  clinicaImagenUrl = computed<string | null>(() => {
    const fileId = this.clinicaActual()?.imagenes?.[0]?.fileId;
    return fileId ? rawAssetUrl(fileId) : null;
  });

  // ============================================================
  // Datos mockeados (TODO: cablear con backend real)
  // ============================================================

  /** Sesiones que el fisio espera/registra hoy. TODO: cablear con snapshots.sesionesHoy. */
  readonly sesionesHoyMock = signal<number>(0);

  /** Actividad agregada de la clínica en los últimos 10 días. TODO: cablear endpoint real. */
  readonly actividad10dias = signal<Ui2ActivityDay[]>([
    { label: 'L', value: 0.7 },
    { label: 'M', value: 0.85 },
    { label: 'X', value: 0.6 },
    { label: 'J', value: 0.9 },
    { label: 'V', value: 0.95 },
    { label: 'S', value: 0.3 },
    { label: 'D', value: 0.2 },
    { label: 'L', value: 0.8 },
    { label: 'M', value: 0.75 },
    { label: 'X', value: 0.5, today: true },
  ]);

  // --- Navegación ---
  irANotificacion(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
    this.router.navigate([n.rutaDestino]);
  }

  irACrearPlan(): void {
    this.router.navigate(['/planes/nuevo']);
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
