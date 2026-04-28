import { Component, computed, ElementRef, HostListener, inject, OnInit, signal } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';

import { SessionService } from '../../../auth/services/session.service';
import { assetUrl } from '../../../utils/asset-url';
import { ThemeService } from '../../../services/theme.service';
import { NotificacionesService } from '../../../services/notificaciones.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import { UserMenuComponent } from '../../../../shared/ui/user-menu/user-menu.component';
import type { NotificacionApp } from '../../../../../types/global';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, UserMenuComponent],
  templateUrl: './navegacion.component.html',
  styleUrl: './navegacion.component.css',
})
export class NavegacionComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  public sessionService = inject(SessionService);
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

  public avatarUrl = computed(() => {
    const id_avatar = this.sessionService.usuario()?.avatar;
    return id_avatar
      ? assetUrl(id_avatar, { fit: 'cover', width: 96, height: 96, quality: 80 })
      : null;
  });

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
    this.isInicio.set(
      baseRoute === '/inicio' ||
        baseRoute === '/inicio/fisio' ||
        baseRoute === '/inicio/paciente' ||
        baseRoute === '/',
    );
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
    const destino = n.rutaDestino;
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
      ? assetUrl(avatar, { fit: 'cover', width: 64, height: 64, quality: 80 })
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

  onLogoError(): void {
    this.themeService.resetLogo();
  }
}
