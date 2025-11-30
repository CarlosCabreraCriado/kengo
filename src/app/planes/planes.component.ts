import { Component, inject, computed, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PlanesService } from '../services/planes.service';
import { PlanBuilderService } from '../services/plan-builder.service';
import { Plan, Usuario, EstadoPlan } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './planes.component.html',
  styleUrl: './planes.component.css',
})
export class PlanesComponent implements OnInit {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);

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
    this.planesService.setBusqueda(value);
  }

  onFiltroEstadoChange(value: 'todos' | EstadoPlan) {
    this.planesService.setFiltroEstado(value);
  }

  clearFilters() {
    this.busqueda = '';
    this.filtroEstado = 'todos';
    this.planesService.clearFilters();
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
