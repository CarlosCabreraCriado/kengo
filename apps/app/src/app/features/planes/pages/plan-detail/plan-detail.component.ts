import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';

import { PlanesService } from '../../data-access/planes.service';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { PlanCompleto, Usuario, DiaSemana } from '../../../../../types/global';
import { environment as env } from '../../../../../environments/environment';
import { KENGO_BREAKPOINTS } from '../../../../../app/shared';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    RouterLink,
  ],
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PlanDetailComponent implements OnInit {
  private location = inject(Location);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  private breakpointObserver = inject(BreakpointObserver);

  // Detectar si es móvil (< 768px) - alineado con breakpoint de navegación
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  plan = signal<PlanCompleto | null>(null);
  isLoading = signal(true);
  descargandoPdf = signal(false);

  // Action type from queryParams (created, updated, or null for view-only)
  actionType = signal<'created' | 'updated' | null>(null);

  // Computed for success hero visibility
  showSuccessHero = computed(() => this.actionType() !== null);

  heroTitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'Plan Creado';
    if (action === 'updated') return 'Plan Actualizado';
    return '';
  });

  heroSubtitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'El plan ha sido asignado correctamente al paciente';
    if (action === 'updated') return 'Los cambios se han guardado correctamente';
    return '';
  });

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

  // Array tipado para el template
  diasSemanaArray: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  ngOnInit() {
    // Read action from queryParams
    const action = this.route.snapshot.queryParams['action'];
    if (action === 'created' || action === 'updated') {
      this.actionType.set(action);
    }

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
    const pac = this.paciente();
    if (pac?.id) {
      this.router.navigate(['/mis-pacientes', pac.id]);
    }
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

  async descargarPdf() {
    const p = this.plan();
    if (!p || this.descargandoPdf()) return;

    this.descargandoPdf.set(true);

    try {
      const response = await firstValueFrom(
        this.http.get(`${env.API_URL}/plan/${p.id_plan}/pdf`, {
          responseType: 'blob',
          observe: 'response',
          withCredentials: true,
        })
      );

      if (response.body) {
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `plan_${p.id_plan}.pdf`;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
          if (match?.[1]) {
            filename = match[1];
          }
        }

        const blob = new Blob([response.body], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Error descargando PDF:', err);

      let errorMessage = 'Error al descargar el PDF';

      if (err.error instanceof Blob) {
        try {
          const errorText = await err.error.text();
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // No se pudo parsear el error
        }
      } else if (err.error?.error) {
        errorMessage = err.error.error;
      }

      alert(errorMessage);
    } finally {
      this.descargandoPdf.set(false);
    }
  }
}
