import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { Ui2EmptyStateComponent } from '../../../../shared/ui-v2';
import { useResponsive } from '../../../../shared/composables/use-responsive';
import { ClinicaActivaService, SessionService } from '../../../../core';
import { MensajesService } from '../../data-access/mensajes.service';
import { MensajesInboxComponent } from '../mensajes-inbox/mensajes-inbox.component';

@Component({
  selector: 'app-mensajes-shell',
  standalone: true,
  imports: [RouterOutlet, Ui2EmptyStateComponent, MensajesInboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-shell.component.html',
  styleUrl: './mensajes-shell.component.css',
})
export class MensajesShellComponent {
  protected mensajes = inject(MensajesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private session = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);

  private readonly responsive = useResponsive();
  protected readonly esDesktop = this.responsive.esDesktop;
  protected readonly esMobile = this.responsive.esMobile;

  /** Sincroniza :id de la URL hijo con activeConversationId.
   * Usa `route.snapshot.firstChild` (el snapshot del padre nunca es undefined)
   * en lugar de `route.firstChild?.snapshot`, que puede romper al navegar
   * directamente a `/mensajes/<id>` desde otra ruta. */
  private readonly activeIdFromUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.paramMap.get('id') ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.paramMap.get('id') ?? null },
  );

  protected readonly mostrarDetalle = computed(
    () => !!this.mensajes.activeConversationId(),
  );

  constructor() {
    effect(() => {
      const id = this.activeIdFromUrl();
      this.mensajes.selectConversation(id);
    });

    // Resetea el flag de auto-start cuando cambia la clínica activa para
    // que un paciente multiclinica pueda auto-arrancar conversación con un
    // fisio en cada clínica donde aún no la tenga.
    effect(() => {
      this.clinicaActiva.selectedClinicaId();
      untracked(() => this.mensajes.resetAutoStartAttempted());
    });

    effect(async () => {
      if (!this.session.enModoPaciente()) return;
      if (this.mensajes.isLoading()) return;
      if (this.mensajes.autoStartAttempted()) return;
      if (!this.clinicaActiva.selectedClinicaId()) return;
      // Solo cuenta como "ya tiene conversación" si existe en la clínica
      // activa actual. Si solo tiene en otras clínicas, igualmente
      // queremos arrancar una para la activa.
      if (this.mensajes.conversations().some((c) => c.isActiveClinic)) return;

      this.mensajes.markAutoStartAttempted();
      const id = await this.mensajes.startConversationWithFisio();
      if (id) this.router.navigate(['/mensajes', id]);
    });
  }

  onSelect(id: string): void {
    this.router.navigate(['/mensajes', id]);
  }
}
