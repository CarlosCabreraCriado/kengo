import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { Ui2EmptyStateComponent } from '../../../../shared/ui-v2';
import { useResponsive } from '../../../../shared/composables/use-responsive';
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

  private readonly responsive = useResponsive();
  protected readonly esDesktop = this.responsive.esDesktop;
  protected readonly esMobile = this.responsive.esMobile;

  /** Sincroniza :id de la URL hijo con activeConversationId. */
  private readonly activeIdFromUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot.paramMap.get('id') ?? null),
    ),
    { initialValue: this.route.firstChild?.snapshot.paramMap.get('id') ?? null },
  );

  protected readonly mostrarDetalle = computed(
    () => !!this.mensajes.activeConversationId(),
  );

  constructor() {
    effect(() => {
      const id = this.activeIdFromUrl();
      this.mensajes.selectConversation(id);
    });
  }

  onSelect(id: string): void {
    this.router.navigate(['/mensajes', id]);
  }
}
