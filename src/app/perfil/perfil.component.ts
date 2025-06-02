import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    MatIconModule,
    MatMenuModule,
    RouterLink,
    RouterOutlet,
    MatCardModule,
    MatButtonModule,
    RouterLinkActive,
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {}
