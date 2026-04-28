import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { useResponsive } from '../../../../shared';

interface Tab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-actividad-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './actividad-shell.component.html',
  styleUrl: './actividad-shell.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class ActividadShellComponent {
  protected readonly router = inject(Router);

  isMovil = useResponsive().esMobile;

  readonly tabs: Tab[] = [
    { path: 'hoy', label: 'Hoy', icon: 'today' },
    { path: 'calendario', label: 'Calendario', icon: 'calendar_month' },
    { path: 'estadisticas', label: 'Estadísticas', icon: 'analytics' },
  ];

  volverInicio(): void {
    this.router.navigate(['/inicio']);
  }
}
