import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { KENGO_BREAKPOINTS } from '../../../../shared';

interface Tab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-actividad-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './actividad-shell.component.html',
  styleUrl: './actividad-shell.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class ActividadShellComponent {
  protected readonly router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true }
  );

  readonly tabs: Tab[] = [
    { path: 'hoy', label: 'Hoy', icon: 'today' },
    { path: 'calendario', label: 'Calendario', icon: 'calendar_month' },
    { path: 'estadisticas', label: 'Estadísticas', icon: 'analytics' },
  ];

  volverInicio(): void {
    this.router.navigate(['/inicio']);
  }
}
