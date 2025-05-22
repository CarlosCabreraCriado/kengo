import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-clinica',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-clinica.component.html',
  styleUrls: ['./tarjeta-clinica.component.scss'],
})
export class TarjetaClinicaComponent {}
