import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-ejercicios',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-ejercicios.component.html',
  styleUrls: ['./tarjeta-ejercicios.component.scss'],
})
export class TarjetaEjerciciosComponent {}
