import { Component, computed, inject, OnInit } from '@angular/core';

import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { environment as env } from '../../environments/environment';

// Angular Material (solo para menú):
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';

// Servicios:
import { AppService } from '../services/app.service';

import { BreakpointObserver } from '@angular/cdk/layout';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.scss',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public appService = inject(AppService);

  public isMovil = false;

  public avatarUrl = computed(() => {
    const id_avatar = this.appService.usuario()?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  });

  public isPaciente = computed(
    () => this.appService.rolUsuario() === 'paciente',
  );

  public isFisio = computed(() => this.appService.rolUsuario() === 'fisio');

  ngOnInit() {
    this.breakpointObserver
      .observe(['(max-width: 767.98px)'])
      .subscribe((result) => {
        this.isMovil = result.matches;
      });
  }

  logout() {
    console.warn('Realizando Logout...');
    this.router.navigate(['/login']);
  }
}
