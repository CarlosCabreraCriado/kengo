import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Event as RouterEvent } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
} from '../../../../shared/ui-v2';

const TABS: Ui2SegmentedOption[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'estadisticas', label: 'Estadísticas' },
];

@Component({
  selector: 'app-actividad-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Ui2SegmentedComponent, Ui2SectionComponent],
  templateUrl: './actividad-shell.component.html',
  styleUrl: './actividad-shell.component.css',
  host: {
    class: 'block w-full',
  },
})
export class ActividadShellComponent {
  private readonly router = inject(Router);

  readonly tabs = TABS;

  /** URL actual reactiva al router. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((evt: RouterEvent): evt is NavigationEnd => evt instanceof NavigationEnd),
      map((evt) => evt.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Tab activo derivado del path actual. Default `hoy`. */
  readonly activeTab = computed<string>(() => {
    const url = this.currentUrl();
    if (url.includes('/actividad-personal/calendario')) return 'calendario';
    if (url.includes('/actividad-personal/estadisticas')) return 'estadisticas';
    return 'hoy';
  });

  onTabChange(id: string): void {
    void this.router.navigate(['/actividad-personal', id]);
  }
}
