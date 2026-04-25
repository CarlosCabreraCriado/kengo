import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardFisioService } from '../../../data-access/dashboard-fisio.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';
import type { NotificacionApp } from '../../../../../../types/global';
import { assetUrl } from '../../../../../core/utils/asset-url';

@Component({
  selector: 'app-inicio-fisio',
  standalone: true,
  imports: [],
  templateUrl: './inicio-fisio.component.html',
  styleUrl: './inicio-fisio.component.css',
})
export class InicioFisioComponent {
  private router = inject(Router);

  dashboardService = inject(DashboardFisioService);
  notificacionesService = inject(NotificacionesService);

  // KPI: adherencia tier
  adherenciaTier = computed(() => {
    const v = this.dashboardService.adherenciaPromedio();
    if (v >= 70) return 'alta';
    if (v >= 40) return 'media';
    return 'baja';
  });

  adherenciaLabel = computed(() => {
    const tier = this.adherenciaTier();
    if (tier === 'alta') return 'Excelente';
    if (tier === 'media') return 'Puede mejorar';
    return 'Necesita atención';
  });

  // Resumen del día
  resumenDia = computed(() => {
    const pacientes = this.dashboardService.pacientesActivos();
    const planes = this.dashboardService.planesProximosAExpirar().length;
    const notifs = this.notificacionesService.pendientes();

    if (pacientes === 0 && planes === 0 && notifs === 0) {
      return 'Todo al día. ¡Buen trabajo!';
    }

    const partes: string[] = [];
    if (pacientes > 0) partes.push(`${pacientes} paciente${pacientes > 1 ? 's' : ''} activo${pacientes > 1 ? 's' : ''}`);
    if (planes > 0) partes.push(`${planes} plan${planes > 1 ? 'es' : ''} por vencer`);
    if (notifs > 0) partes.push(`${notifs} notificación${notifs > 1 ? 'es' : ''} sin leer`);

    return `Tienes ${partes.join(', ')}.`;
  });

  // Notificaciones recientes
  notificacionesRecientes = computed(() =>
    this.notificacionesService.notificaciones()
      .filter(n => !n.leida)
      .slice(0, 3),
  );

  hayNotificacionesRecientes = computed(() => this.notificacionesRecientes().length > 0);

  // Planes por vencer
  planesCount = computed(() => this.dashboardService.planesProximosAExpirar().length);

  diasParaVencer(fechaFin: string): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  avatarUrl(avatar: string | null): string | null {
    if (!avatar) return null;
    return `${assetUrl(avatar, { key: 'avatar' })}`;
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

  irANotificacion(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
    this.router.navigate([n.ruta_destino]);
  }

  irACrearPlan(): void {
    this.router.navigate(['/planes/nuevo']);
  }

  irAPaciente(pacienteId: string): void {
    this.router.navigate(['/mis-pacientes', pacienteId]);
  }

  irAGaleria(): void {
    this.router.navigate(['/galeria']);
  }

  irAPacientes(): void {
    this.router.navigate(['/mis-pacientes']);
  }

  irAClinica(): void {
    this.router.navigate(['/mi-clinica']);
  }
}
