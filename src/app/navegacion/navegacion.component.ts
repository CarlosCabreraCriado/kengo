import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { environment as env } from '../../environments/environment';

// Angular Material (solo para menú):
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

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
    MatDividerModule,
  ],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.scss',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public appService = inject(AppService);

  public isMovil = signal(false);
  public isInicio = signal(false);

  // Mostrar navbar: siempre en desktop, solo en /inicio en móvil
  public showNavbar = computed(() => !this.isMovil() || this.isInicio());

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
    // Detectar si es móvil
    this.breakpointObserver
      .observe(['(max-width: 767.98px)'])
      .subscribe((result) => {
        this.isMovil.set(result.matches);
      });

    // Detectar ruta actual
    this.checkIfInicio(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.checkIfInicio((event as NavigationEnd).urlAfterRedirects);
      });
  }

  private checkIfInicio(url: string) {
    this.isInicio.set(url === '/inicio' || url === '/');
  }

  logout() {
    console.warn('Realizando Logout...');
    this.router.navigate(['/login']);
  }
}
