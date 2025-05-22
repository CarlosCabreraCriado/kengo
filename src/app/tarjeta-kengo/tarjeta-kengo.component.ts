import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-kengo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-kengo.component.html',
  styleUrls: ['./tarjeta-kengo.component.scss'],
})
export class TarjetaKengoComponent {}
