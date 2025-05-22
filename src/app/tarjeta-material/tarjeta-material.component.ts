import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tarjeta-material',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tarjeta-material.component.html',
  styleUrls: ['./tarjeta-material.component.scss'],
})
export class TarjetaMaterialComponent {}
