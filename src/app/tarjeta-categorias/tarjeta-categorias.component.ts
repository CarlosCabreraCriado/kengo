import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-categorias',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-categorias.component.html',
  styleUrls: ['./tarjeta-categorias.component.scss'],
})
export class TarjetaCategoriasComponent {}
