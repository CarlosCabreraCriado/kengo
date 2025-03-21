import { Component } from '@angular/core';
import { NavegacionComponent } from '../navegacion/navegacion.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ejercicios',
  standalone: true,
  imports: [NavegacionComponent, RouterLink],
  templateUrl: './ejercicios.component.html',
  styleUrl: './ejercicios.component.css',
})
export class EjerciciosComponent {
  public ejercicios = [
    {
      id: 1,
      nombreCategoria: 'Ejercicio 1',
    },
    {
      id: 2,
      nombreCategoria: 'Manguito Rotador',
    },
    {
      id: 3,
      nombreCategoria: 'Hombro Pocho',
    },
    {
      id: 4,
      nombreCategoria: 'Cuello Vertebrado ',
    },
    {
      id: 5,
      nombreCategoria: 'Retraso agudo',
    },
  ];
}
