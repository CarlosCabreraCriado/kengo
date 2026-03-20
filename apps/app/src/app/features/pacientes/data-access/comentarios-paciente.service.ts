import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import type { ComentariosPacienteResponse } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class ComentariosPacienteService {
  private http = inject(HttpClient);

  async getComentarios(pacienteId: string): Promise<ComentariosPacienteResponse> {
    return firstValueFrom(
      this.http.get<ComentariosPacienteResponse>(
        `${env.API_URL}/paciente/${pacienteId}/comentarios`,
        { withCredentials: true },
      ),
    );
  }

  async marcarRevisada(notificacionId: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${env.API_URL}/notificacion/${notificacionId}/revisar`,
        {},
        { withCredentials: true },
      ),
    );
  }

  async marcarTodasRevisadas(pacienteId: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${env.API_URL}/paciente/${pacienteId}/comentarios/revisar-todos`,
        {},
        { withCredentials: true },
      ),
    );
  }
}
