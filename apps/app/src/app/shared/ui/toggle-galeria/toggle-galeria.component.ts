import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../../core/auth/services/session.service';

interface Tab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-toggle-galeria',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './toggle-galeria.component.html',
  styleUrl: './toggle-galeria.component.css',
})
export class ToggleGaleriaComponent {
  private session = inject(SessionService);

  private readonly allTabs: Tab[] = [
    { path: 'ejercicios', label: 'Ejercicios', icon: 'fitness_center' },
    { path: 'rutinas', label: 'Rutinas', icon: 'bookmarks' },
  ];

  readonly tabs = computed(() =>
    this.session.rolUsuario() === 'fisio'
      ? this.allTabs
      : this.allTabs.filter((t) => t.path !== 'rutinas')
  );
}
