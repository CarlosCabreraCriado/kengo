import { Component } from '@angular/core';
import { ExploradorComponent } from '../explorador/explorador.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-carrito-ejercicios',
  imports: [
    ExploradorComponent,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
  ],
  templateUrl: './carrito-ejercicios.component.html',
  styleUrl: './carrito-ejercicios.component.css',
})
export class CarritoEjerciciosComponent {
  public drawerAbierto = false;
  public ejerciciosAdjudicados = [
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

  abrirDrawer() {
    this.drawerAbierto = true;
  }
  cerrarDrawer() {
    this.drawerAbierto = false;
  }
}
