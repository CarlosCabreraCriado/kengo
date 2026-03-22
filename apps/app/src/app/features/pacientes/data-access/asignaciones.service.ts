import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import type { AsignacionResponsable, BulkAsignacionPayload, BulkAsignacionResponse } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  private http = inject(HttpClient);

  listarAsignaciones(clinicaId: number): Observable<AsignacionResponsable[]> {
    return this.http.get<AsignacionResponsable[]>(
      `${env.API_URL}/clinica/${clinicaId}/asignaciones`,
      { withCredentials: true }
    );
  }

  bulkAsignar(payload: BulkAsignacionPayload): Observable<BulkAsignacionResponse> {
    return this.http.put<BulkAsignacionResponse>(
      `${env.API_URL}/clinica/${payload.id_clinica}/asignaciones/bulk`,
      payload,
      { withCredentials: true }
    );
  }

  getFisioResponsable(pacienteId: string, clinicaId: number): Observable<AsignacionResponsable | null> {
    return this.http.get<AsignacionResponsable | null>(
      `${env.API_URL}/paciente/${pacienteId}/fisio-responsable`,
      {
        params: { clinicaId: clinicaId.toString() },
        withCredentials: true,
      }
    );
  }

  /**
   * Auto-asigna un fisio como responsable de un paciente si no tiene uno.
   * Fire-and-forget: no bloquea el flujo principal.
   */
  autoAsignar(pacienteId: string, fisioId: string, clinicaId: number): void {
    this.getFisioResponsable(pacienteId, clinicaId).subscribe(asignacion => {
      if (!asignacion) {
        const payload: BulkAsignacionPayload = {
          id_clinica: clinicaId,
          asignaciones: [{ id_paciente: pacienteId, id_fisio: fisioId }],
        };
        this.bulkAsignar(payload).subscribe({
          next: () => console.log('[AutoAsignacion] Fisio auto-asignado como responsable'),
          error: (err) => console.warn('[AutoAsignacion] Error auto-asignando:', err),
        });
      }
    });
  }
}
