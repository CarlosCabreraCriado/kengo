import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardFisioService } from '../../../data-access/dashboard-fisio.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';

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

  diasParaVencer(fechaFin: string): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setHours(0, 0, 0, 0);
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
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

  irARutinas(): void {
    this.router.navigate(['/galeria/rutinas']);
  }
}
