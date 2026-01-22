import { Component } from '@angular/core';
import { ExploradorComponent } from '../explorador/explorador.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [ExploradorComponent, RouterLink],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.css',
})
export class CategoriasComponent {
  public categorias = [
    {
      id: 1,
      nombreCategoria: 'Tobillo',
    },
    {
      id: 2,
      nombreCategoria: 'Rodilla',
    },
    {
      id: 3,
      nombreCategoria: 'Cadera',
    },
    {
      id: 4,
      nombreCategoria: 'Columna Lumbar',
    },
    {
      id: 5,
      nombreCategoria: 'Hombro',
    },
    {
      id: 6,
      nombreCategoria: 'Codo',
    },
    {
      id: 7,
      nombreCategoria: 'Muñeca',
    },
    {
      id: 8,
      nombreCategoria: 'Columna Dorsal',
    },
  ];
}
