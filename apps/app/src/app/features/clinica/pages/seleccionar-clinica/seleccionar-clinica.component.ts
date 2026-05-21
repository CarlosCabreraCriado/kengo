import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import {
  Ui2BigTitleComponent,
  Ui2CtaBarComponent,
  Ui2SectionComponent,
} from '../../../../shared/ui-v2';

interface OpcionClinica {
  clinicId: string;
  nombre: string;
  puesto: string;
}

/**
 * Pantalla a la que se redirige al usuario con varias membresías cuando no
 * hay clínica activa válida. Al elegir una, se persiste y se redirige al
 * destino original (queryParam `next`) o a `/inicio`.
 */
@Component({
  standalone: true,
  selector: 'app-seleccionar-clinica',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2BigTitleComponent, Ui2CtaBarComponent, Ui2SectionComponent],
  template: `
    <ui2-section>
      <ui2-big-title
        title="ELIGE UNA CLÍNICA"
        overline="MULTICLÍNICA"
        sub="Trabajas con varias clínicas. Elige cuál quieres usar ahora — podrás cambiar desde el selector del menú."
      ></ui2-big-title>

      <div class="flex flex-col gap-3 mt-6">
        @for (op of opciones(); track op.clinicId) {
          <ui2-cta-bar
            variant="primary"
            icon="apartment"
            [title]="op.nombre"
            [subtitle]="'Puesto: ' + puestoLabel(op.puesto)"
            (clicked)="elegir(op.clinicId)"
          ></ui2-cta-bar>
        }
      </div>
    </ui2-section>
  `,
})
export class SeleccionarClinicaComponent {
  private session = inject(SessionService);
  private clinicasService = inject(ClinicasService);
  private clinicaActiva = inject(ClinicaActivaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly opciones = computed<OpcionClinica[]>(() => {
    const clinicas = this.clinicasService.misClinicas();
    const membresias = this.session.misclinicas();
    return clinicas.map((c) => ({
      clinicId: c.id,
      nombre: c.nombre,
      puesto: membresias.find((m) => m.clinicId === c.id)?.puesto ?? '',
    }));
  });

  // Si llegamos aquí pero ya hay una clínica activa válida (race / navegación
  // directa), redirigir al destino sin obligar a re-elegir.
  private readonly autoNavega = effect(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    const ids = this.opciones().map((o) => o.clinicId);
    if (id && ids.includes(id) && ids.length > 0) {
      this.continuar();
    }
  });

  protected puestoLabel(p: string): string {
    if (p === 'admin') return 'Administrador';
    if (p === 'fisio') return 'Fisioterapeuta';
    if (p === 'paciente') return 'Paciente';
    return '—';
  }

  protected elegir(clinicId: string): void {
    this.clinicaActiva.set(clinicId);
    this.continuar();
  }

  private continuar(): void {
    const next = this.route.snapshot.queryParamMap.get('next') ?? '/inicio';
    this.router.navigateByUrl(next);
  }
}
