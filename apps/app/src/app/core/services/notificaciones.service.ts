import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../../environments/environment';
import { SessionService } from '../auth/services/session.service';
import type {
  NotificacionApp,
  NotificacionesAppResponse,
} from '../../../types/global';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private sessionService = inject(SessionService);

  readonly notificaciones = signal<NotificacionApp[]>([]);
  readonly pendientes = signal(0);
  readonly cargando = signal(false);
  private datosCargados = signal(false);

  readonly hayPendientes = computed(() => this.pendientes() > 0);

  constructor() {
    // Auto-load cuando el usuario está disponible y es fisio
    effect(() => {
      const usuario = this.sessionService.usuario();
      const rol = this.sessionService.rolUsuario();

      if (usuario?.id && rol === 'fisio' && !this.datosCargados() && !this.cargando()) {
        this.cargar();
      }
    });

    // Recargar al navegar a /mis-pacientes
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/mis-pacientes') && this.datosCargados()) {
          this.recargar();
        }
      });
  }

  async recargar(): Promise<void> {
    this.datosCargados.set(false);
    await this.cargar();
  }

  async marcarRevisada(n: NotificacionApp): Promise<void> {
    if (n.leida) return;

    // Update optimista
    const prev = this.notificaciones();
    const prevPendientes = this.pendientes();
    this.notificaciones.set(
      prev.map((item) => (item.id === n.id ? { ...item, leida: true } : item)),
    );
    this.pendientes.set(Math.max(0, prevPendientes - 1));

    try {
      await firstValueFrom(
        this.http.patch(`${env.API_URL}/notificacion/${n.id}/revisar`, {}, {
          withCredentials: true,
        }),
      );
    } catch {
      // Revertir
      this.notificaciones.set(prev);
      this.pendientes.set(prevPendientes);
    }
  }

  async marcarTodasRevisadas(): Promise<void> {
    // Update optimista
    const prev = this.notificaciones();
    const prevPendientes = this.pendientes();
    this.notificaciones.set(prev.map((n) => ({ ...n, leida: true })));
    this.pendientes.set(0);

    try {
      await firstValueFrom(
        this.http.patch(`${env.API_URL}/notificaciones/revisar-todas`, {}, {
          withCredentials: true,
        }),
      );
    } catch {
      // Revertir
      this.notificaciones.set(prev);
      this.pendientes.set(prevPendientes);
    }
  }

  private async cargar(): Promise<void> {
    if (this.cargando()) return;

    this.cargando.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<NotificacionesAppResponse>(
          `${env.API_URL}/notificaciones/mis-notificaciones`,
          { withCredentials: true },
        ),
      );
      this.notificaciones.set(res.notificaciones);
      this.pendientes.set(res.pendientes);
      this.datosCargados.set(true);
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      this.cargando.set(false);
    }
  }
}
