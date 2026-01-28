import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
  readonly tabs: Tab[] = [
    { path: 'ejercicios', label: 'Ejercicios', icon: 'fitness_center' },
    { path: 'rutinas', label: 'Rutinas', icon: 'bookmarks' },
  ];
}
