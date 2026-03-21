import { Component, computed, ElementRef, HostListener, inject, OnInit, signal } from '@angular/core';
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
import { AuthService } from '../../../auth/services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { NotificacionesService } from '../../../services/notificaciones.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import type { NotificacionApp } from '../../../../../types/global';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.css',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  public notificacionesService = inject(NotificacionesService);
  private elementRef = inject(ElementRef);

  // Signals de logo desde ThemeService
  logoUrl = this.themeService.logoUrl;
  logoIconUrl = this.themeService.logoIconUrl;

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
      '/galeria': 1,
      '/actividad-personal': 2,
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

  // Estado del menú de usuario
  menuAbierto = signal(false);

  // Estado del panel de notificaciones
  notificacionesAbiertas = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.notificacionesAbiertas() && !this.elementRef.nativeElement.contains(event.target)) {
      this.cerrarNotificaciones();
    }
  }

  toggleMenu(): void {
    this.cerrarNotificaciones();
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  toggleNotificaciones(): void {
    this.cerrarMenu();
    this.notificacionesAbiertas.update((v) => !v);
  }

  cerrarNotificaciones(): void {
    this.notificacionesAbiertas.set(false);
  }

  marcarRevisada(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
  }

  marcarTodasRevisadas(): void {
    this.notificacionesService.marcarTodasRevisadas();
  }

  irANotificacion(n: NotificacionApp): void {
    this.cerrarNotificaciones();
    // Si ya estamos en una ruta hija del mismo prefijo, forzar recarga
    // navegando primero a la ruta padre y luego al destino
    const currentUrl = this.router.url.split('?')[0];
    const destino = n.ruta_destino;
    const mismoContexto =
      currentUrl.startsWith('/mis-pacientes/') && destino.startsWith('/mis-pacientes/');

    if (mismoContexto && currentUrl !== destino) {
      this.router.navigateByUrl('/mis-pacientes', { skipLocationChange: true }).then(() => {
        this.router.navigate([destino]);
      });
    } else {
      this.router.navigate([destino]);
    }
  }

  avatarUrlEmisor(avatar: string | null): string | null {
    return avatar
      ? `${env.DIRECTUS_URL}/assets/${avatar}?fit=cover&width=64&height=64&quality=80`
      : null;
  }

  formatearFechaNotificacion(fecha: string): string {
    const d = new Date(fecha);
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const ayer = new Date(hoy.getTime() - 86400000);

    if (d >= hoy) return 'Hoy';
    if (d >= ayer) return 'Ayer';

    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  irAPerfil(): void {
    this.cerrarMenu();
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    this.cerrarMenu();
    await this.authService.logout();
  }

  onLogoError(): void {
    this.themeService.resetLogo();
  }
}
