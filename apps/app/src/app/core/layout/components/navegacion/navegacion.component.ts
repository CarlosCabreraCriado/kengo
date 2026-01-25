import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';

import { environment as env } from '../../../../../environments/environment';
import { SessionService } from '../../../auth/services/session.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.scss',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public sessionService = inject(SessionService);

  public isMovil = signal(false);
  public isInicio = signal(false);
  private currentRoute = signal('/inicio');

  // Mostrar navbar: solo en desktop (768px+)
  public showNavbar = computed(() => !this.isMovil());

  // Índice activo para la animación del indicador
  public activeIndex = computed(() => {
    const route = this.currentRoute();
    const isFisio = this.isFisio();

    // Mapeo de rutas a índices (considerando si hay sección de pacientes)
    const routeMap: Record<string, number> = {
      '/inicio': 0,
      '/': 0,
      '/ejercicios': 1,
      '/actividad-diaria': 2,
      '/mis-pacientes': isFisio ? 3 : -1,
      '/mi-clinica': isFisio ? 4 : 3,
      '/perfil': isFisio ? 5 : 4,
    };

    return routeMap[route] ?? 0;
  });

  public avatarUrl = computed(() => {
    const id_avatar = this.sessionService.usuario()?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  });

  public isPaciente = computed(
    () => this.sessionService.rolUsuario() === 'paciente',
  );

  public isFisio = computed(() => this.sessionService.rolUsuario() === 'fisio');

  ngOnInit() {
    // Detectar si es móvil
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .subscribe((result) => {
        this.isMovil.set(result.matches);
      });

    // Detectar ruta actual
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateRouteState((event as NavigationEnd).urlAfterRedirects);
      });
  }

  private updateRouteState(url: string) {
    // Extraer la ruta base (sin query params)
    const baseRoute = url.split('?')[0];
    this.currentRoute.set(baseRoute);
    this.isInicio.set(baseRoute === '/inicio' || baseRoute === '/');
  }

  logout() {
    console.warn('Realizando Logout...');
    this.router.navigate(['/login']);
  }
}
