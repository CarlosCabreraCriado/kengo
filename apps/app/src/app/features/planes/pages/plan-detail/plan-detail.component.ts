import { Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { assetUrl } from '../../../../core/utils/asset-url';

import { PlanesService } from '../../data-access/planes.service';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { PlanCompleto, Usuario, DiaSemana } from '../../../../../types/global';
import { DialogService, DialogoPdfComponent } from '../../../../../app/shared';
import type { DialogoPdfData } from '../../../../../app/shared';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2SectionLabelComponent,
} from '../../../../shared/ui-v2';

@Component({
  selector: 'app-plan-detail',
  standalone: true,
  imports: [
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2SectionLabelComponent,
  ],
  templateUrl: './plan-detail.component.html',
  styleUrl: './plan-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class PlanDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private planesService = inject(PlanesService);
  private planBuilderService = inject(PlanBuilderService);
  public sessionService = inject(SessionService);
  private dialogService = inject(DialogService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'plan-detail';

  plan = signal<PlanCompleto | null>(null);
  isLoading = signal(true);

  /** Datos críticos: plan cargado. */
  readonly pageReady = computed(() => !this.isLoading());

  actionType = signal<'created' | 'updated' | null>(null);

  showSuccessHero = computed(() => this.actionType() !== null);

  heroTitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'Plan creado';
    if (action === 'updated') return 'Plan actualizado';
    return '';
  });

  heroSubtitle = computed(() => {
    const action = this.actionType();
    if (action === 'created') return 'El plan ha sido asignado correctamente al paciente.';
    if (action === 'updated') return 'Los cambios se han guardado correctamente.';
    return '';
  });

  paciente = computed(() => {
    const p = this.plan();
    return p?.paciente as Usuario | null;
  });

  items = computed(() => this.plan()?.items || []);
  totalEjercicios = computed(() => this.items().length);

  backRoute = computed<unknown[]>(() => {
    if (this.sessionService.enModoPaciente()) return ['/inicio'];
    const pacId = this.paciente()?.id;
    return pacId ? ['/mis-pacientes', pacId] : ['/mis-pacientes'];
  });

  pageOverline = computed(() => {
    const total = this.totalEjercicios();
    return total > 0 ? `${total} ejercicio${total === 1 ? '' : 's'}` : 'Plan de tratamiento';
  });

  diasSemana: Record<string, string> = {
    L: 'Lun',
    M: 'Mar',
    X: 'Mie',
    J: 'Jue',
    V: 'Vie',
    S: 'Sab',
    D: 'Dom',
  };

  diasSemanaArray: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);

    const action = this.route.snapshot.queryParams['action'];
    if (action === 'created' || action === 'updated') {
      this.actionType.set(action);
    }

    const planId = this.route.snapshot.params['id'];
    if (planId) {
      this.loadPlan(planId);
    } else {
      this.router.navigate(this.backRoute());
    }
  }

  ngOnDestroy() {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  private async loadPlan(id: string) {
    this.isLoading.set(true);
    try {
      const plan = await this.planesService.getPlanById(id);
      if (plan) {
        this.plan.set(plan);
        this.planBuilderService.resetForNewPlan();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  verPerfilPaciente() {
    const pac = this.paciente();
    if (pac?.id && this.sessionService.puedeGestionarPacientes()) {
      this.router.navigate(['/mis-pacientes', pac.id]);
    }
  }

  irAInicio() {
    this.router.navigate(['/inicio']);
  }

  editarPlan() {
    const p = this.plan();
    if (p) {
      this.router.navigate(['/planes', p.id, 'editar']);
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

  assetUrl(id: string | null | undefined, w = 100, h = 100): string {
    if (!id) return '';
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }

  avatarUrl(id: string | null | undefined): string | null {
    if (!id) return null;
    return `${assetUrl(id, { width: 100, height: 100, fit: 'cover', format: 'webp' })}`;
  }

  abrirOpcionesPdf() {
    const p = this.plan();
    if (!p) return;

    const pac = this.paciente();
    const data: DialogoPdfData = {
      planConvexId: (p as unknown as { _convexId: string })._convexId,
      pacienteEmail: pac?.email ?? undefined,
      planTitulo: p.titulo,
    };

    this.dialogService.open<DialogoPdfComponent, DialogoPdfData>(
      DialogoPdfComponent,
      { data }
    );
  }
}
