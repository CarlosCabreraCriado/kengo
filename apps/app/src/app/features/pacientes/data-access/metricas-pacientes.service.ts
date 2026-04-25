import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { MetricasPacientesBulk } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class MetricasPacientesService {
  private convex = inject(ConvexService);

  getMetricasBulk(): Observable<MetricasPacientesBulk> {
    return from(
      this.convex.query(api.dashboard.queries.patientMetrics, {}) as Promise<MetricasPacientesBulk>,
    );
  }
}
