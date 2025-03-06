import { Component } from '@angular/core';
import { NavegacionComponent } from '../navegacion/navegacion.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ejercicios',
  imports: [NavegacionComponent, RouterLink],
  templateUrl: './ejercicios.component.html',
  styleUrl: './ejercicios.component.css',
})
export class EjerciciosComponent {}
