import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import { SessionService } from '../../../core/auth/services/session.service';
import type { ResumenFisioDashboard } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class DashboardFisioService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);

  readonly cargando = signal<boolean>(false);
  readonly resumen = signal<ResumenFisioDashboard | null>(null);
  private datosCargados = signal<boolean>(false);

  readonly pacientesActivos = computed(() => this.resumen()?.pacientes_activos ?? 0);
  readonly adherenciaPromedio = computed(() => this.resumen()?.adherencia_promedio ?? 0);
  readonly planesProximosAExpirar = computed(() => this.resumen()?.planes_por_vencer ?? []);

  constructor() {
    effect(() => {
      const usuario = this.sessionService.usuario();
      const esFisio = this.sessionService.rolUsuario() === 'fisio';

      if (usuario?.id && esFisio && !this.datosCargados() && !this.cargando()) {
        this.cargar();
      }
    });
  }

  private async cargar(): Promise<void> {
    if (this.datosCargados() || this.cargando()) return;

    this.cargando.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<ResumenFisioDashboard>(
          `${env.API_URL}/dashboard/fisio/resumen`,
          { withCredentials: true },
        ),
      );
      this.resumen.set(data);
      this.datosCargados.set(true);
    } catch (err) {
      console.error('Error al cargar resumen fisio:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  async recargar(): Promise<void> {
    this.datosCargados.set(false);
    await this.cargar();
  }
}
