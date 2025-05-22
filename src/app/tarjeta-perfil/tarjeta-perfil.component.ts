import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-perfil.component.html',
  styleUrls: ['./tarjeta-perfil.component.scss'],
})
export class TarjetaPerfilComponent {}
