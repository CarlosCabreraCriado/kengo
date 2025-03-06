import { Component } from '@angular/core';
import { NavegacionComponent } from '../navegacion/navegacion.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-detalle-ejercicio',
  imports: [NavegacionComponent, RouterLink],
  templateUrl: './detalle-ejercicio.component.html',
  styleUrl: './detalle-ejercicio.component.css',
})
export class DetalleEjercicioComponent {}
