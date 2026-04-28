import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../../core/auth/services/session.service';

interface Tab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-catalogo-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './catalogo-tabs.component.html',
  styleUrl: './catalogo-tabs.component.css',
})
export class CatalogoTabsComponent {
  private session = inject(SessionService);

  private readonly allTabs: Tab[] = [
    { path: 'ejercicios', label: 'Ejercicios', icon: 'fitness_center' },
    { path: 'rutinas', label: 'Rutinas', icon: 'bookmarks' },
  ];

  readonly tabs = computed(() =>
    this.session.puedeCrearRutinas()
      ? this.allTabs
      : this.allTabs.filter((t) => t.path !== 'rutinas'),
  );
}
