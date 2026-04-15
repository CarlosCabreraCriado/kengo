import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import type { MetricasPacientesBulk } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class MetricasPacientesService {
  private http = inject(HttpClient);

  getMetricasBulk(): Observable<MetricasPacientesBulk> {
    return this.http.get<MetricasPacientesBulk>(
      `${env.API_URL}/pacientes/metricas`,
      { withCredentials: true },
    );
  }
}
