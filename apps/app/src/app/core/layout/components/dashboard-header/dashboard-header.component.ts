import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
  inject,
  ElementRef,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { assetUrl } from '../../../utils/asset-url';
import { SessionService } from '../../../auth/services/session.service';
import { ThemeService } from '../../../services/theme.service';
import { NotificacionesService } from '../../../services/notificaciones.service';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import { UserMenuComponent } from '../../../../shared/ui/user-menu/user-menu.component';
import type { NotificacionApp } from '../../../../../types/global';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [UserMenuComponent],
  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHeaderComponent {
  public sessionService = inject(SessionService);
  private themeService = inject(ThemeService);
  public notificacionesService = inject(NotificacionesService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private elementRef = inject(ElementRef);

  logoUrl = this.themeService.logoUrl;

  menuAbierto = signal(false);
  notificacionesAbiertas = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificacionesAbiertas()) return;
    const container = this.elementRef.nativeElement.querySelector(
      '.notificaciones-container',
    );
    if (!container?.contains(event.target as Node)) {
      this.cerrarNotificaciones();
    }
  }

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  userName = computed(
    () => this.sessionService.usuario()?.first_name ?? 'Usuario',
  );
  userAvatar = computed(
    () => this.sessionService.usuario()?.avatar_url ?? null,
  );

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
    if (!n.leida) {
      this.notificacionesService.marcarRevisada(n);
    }
    const currentUrl = this.router.url.split('?')[0];
    const destino = n.rutaDestino;
    const mismoContexto =
      currentUrl.startsWith('/mis-pacientes/') &&
      destino.startsWith('/mis-pacientes/');

    if (mismoContexto && currentUrl !== destino) {
      this.router
        .navigateByUrl('/mis-pacientes', { skipLocationChange: true })
        .then(() => {
          this.router.navigate([destino]);
        });
    } else {
      this.router.navigate([destino]);
    }
  }

  avatarUrlEmisor(avatar: string | null): string | null {
    return avatar
      ? `${assetUrl(avatar, { fit: 'cover', width: 64, height: 64, quality: 80 })}`
      : null;
  }

  formatearFechaNotificacion(fecha: string): string {
    const d = new Date(fecha);
    const ahora = new Date();
    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    );
    const ayer = new Date(hoy.getTime() - 86400000);

    if (d >= hoy) return 'Hoy';
    if (d >= ayer) return 'Ayer';

    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  }

  onLogoError(): void {
    this.themeService.resetLogo();
  }
}
