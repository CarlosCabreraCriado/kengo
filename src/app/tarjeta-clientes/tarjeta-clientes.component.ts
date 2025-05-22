import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-clientes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-clientes.component.html',
  styleUrls: ['./tarjeta-clientes.component.scss'],
})
export class TarjetaClientesComponent {}
