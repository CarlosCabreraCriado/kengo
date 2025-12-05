import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { PlanesService } from '../services/planes.service';
import { PlanBuilderService } from '../services/plan-builder.service';
import { PlanCompleto, Usuario } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-plan-resumen',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './plan-resumen.component.html',
  styleUrl: './plan-resumen.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PlanResumenComponent implements OnInit {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);

  plan = signal<PlanCompleto | null>(null);
  isLoading = signal(true);

  // Computed
  paciente = computed(() => {
    const p = this.plan();
    return p?.paciente as Usuario | null;
  });

  items = computed(() => this.plan()?.items || []);
  totalEjercicios = computed(() => this.items().length);

  diasSemana: Record<string, string> = {
    L: 'Lun',
    M: 'Mar',
    X: 'Mie',
    J: 'Jue',
    V: 'Vie',
    S: 'Sab',
    D: 'Dom',
  };

  ngOnInit() {
    const planId = this.route.snapshot.params['id'];
    if (planId) {
      this.loadPlan(+planId);
    } else {
      this.router.navigate(['/planes']);
    }
  }

  private async loadPlan(id: number) {
    this.isLoading.set(true);
    try {
      const plan = await this.planesService.getPlanById(id);
      if (plan) {
        this.plan.set(plan);
        // Limpiar el builder service
        this.planBuilderService.resetForNewPlan();
      } else {
        this.router.navigate(['/planes']);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  crearOtroPlan() {
    const paciente = this.paciente();
    if (paciente) {
      this.planBuilderService.cambiarPaciente(paciente);
    } else {
      this.router.navigate(['/mis-pacientes']);
    }
  }

  verPerfilPaciente() {
    // Por ahora ir a pacientes
    this.router.navigate(['/mis-pacientes']);
  }

  irAInicio() {
    this.router.navigate(['/inicio']);
  }

  volver() {
    this.location.back();
  }

  editarPlan() {
    const p = this.plan();
    if (p) {
      this.router.navigate(['/planes', p.id_plan, 'editar']);
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getDiasDisplay(dias: string[] | undefined): string {
    if (!dias || dias.length === 0) return '-';
    return dias.map((d) => this.diasSemana[d] || d).join(', ');
  }

  assetUrl(id: string | null | undefined, w = 100, h = 100): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }

  avatarUrl(id: string | null | undefined): string {
    if (!id) return 'assets/default-avatar.png';
    return `${env.DIRECTUS_URL}/assets/${id}?width=100&height=100&fit=cover&format=webp`;
  }
}
