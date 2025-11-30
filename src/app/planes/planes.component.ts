import { Component, inject, computed, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PlanesService } from '../services/planes.service';
import { Plan, Usuario, EstadoPlan } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [
    NgClass,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
  ],
  templateUrl: './planes.component.html',
  styleUrl: './planes.component.css',
})
export class PlanesComponent implements OnInit {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  planesService = inject(PlanesService);

  busqueda = '';
  filtroEstado: 'todos' | EstadoPlan = 'todos';

  planes = computed(() => this.planesService.planes());
  isLoading = computed(() => this.planesService.isLoading());
  total = computed(() => this.planesService.total());

  estadoLabels: Record<EstadoPlan, string> = {
    borrador: 'Borrador',
    activo: 'Activo',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  estadoColors: Record<EstadoPlan, string> = {
    borrador: 'bg-zinc-100 text-zinc-600',
    activo: 'bg-green-100 text-green-700',
    completado: 'bg-blue-100 text-blue-700',
    cancelado: 'bg-red-100 text-red-600',
  };

  ngOnInit() {
    this.planesService.reload();
  }

  onBusquedaChange(value: string) {
    this.busqueda = value;
    this.planesService.setBusqueda(value);
  }

  onFiltroEstadoChange(value: 'todos' | EstadoPlan) {
    this.filtroEstado = value;
    this.planesService.setFiltroEstado(value);
  }

  reload() {
    this.planesService.reload();
  }

  crearNuevoPlan() {
    this.router.navigate(['/mis-pacientes']);
  }

  verResumen(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'resumen']);
  }

  editarPlan(plan: Plan) {
    this.router.navigate(['/planes', plan.id_plan, 'editar']);
  }

  async cambiarEstado(plan: Plan, nuevoEstado: EstadoPlan) {
    const success = await this.planesService.updateEstado(plan.id_plan, nuevoEstado);
    if (success) {
      this.snackBar.open(`Estado cambiado a ${this.estadoLabels[nuevoEstado]}`, 'OK', {
        duration: 2000,
      });
    } else {
      this.snackBar.open('Error al cambiar estado', 'OK', { duration: 3000 });
    }
  }

  getPacienteNombre(plan: Plan): string {
    const p = plan.paciente;
    if (typeof p === 'string') return 'Paciente';
    return `${p.first_name} ${p.last_name}`;
  }

  getPacienteAvatar(plan: Plan): string {
    const p = plan.paciente;
    if (typeof p === 'string') return '';
    return (p as Usuario).avatar || '';
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }

  avatarUrl(id: string | null | undefined): string {
    if (!id) return 'assets/default-avatar.png';
    return `${env.DIRECTUS_URL}/assets/${id}?width=60&height=60&fit=cover&format=webp`;
  }
}
