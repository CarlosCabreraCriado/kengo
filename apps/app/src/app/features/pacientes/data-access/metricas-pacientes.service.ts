import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { MetricasPacientesBulk } from '../../../../types/global';

type SnapshotDoc = {
  _id: string;
  pacienteId: string;
  clinicId: string;
  fisioId: string;
  ventana: '7d' | '30d';
  adherencia: number;
  dolorPromedio?: number;
  ultimaActividad?: string;
  inactividadDias: number;
  rachaActual: number;
  riskScore: number;
};

@Injectable({ providedIn: 'root' })
export class MetricasPacientesService {
  private convex = inject(ConvexService);

  /**
   * Obtiene el bulk de métricas indexadas por `pacienteId` (Convex Id).
   * Lee `patientMetricsSnapshot` (ventana 30d por defecto) de todas las
   * clínicas gestionadas por el usuario actual.
   */
  getMetricasBulk(ventana: '7d' | '30d' = '30d'): Observable<MetricasPacientesBulk> {
    return from(this.fetchBulk(ventana));
  }

  private async fetchBulk(ventana: '7d' | '30d'): Promise<MetricasPacientesBulk> {
    const clinicIds = (await this.convex.query(
      api.me.queries.myManagedClinics,
      {},
    )) as string[];

    if (!clinicIds || clinicIds.length === 0) return {};

    const all: SnapshotDoc[] = [];
    for (const clinicId of clinicIds) {
      const snaps = (await this.convex.query(
        api.snapshots.queries.getPatientMetrics,
        {
          clinicId: clinicId as any,
          ventana,
          ordenarPor: 'adherencia',
          limit: 200,
        },
      )) as SnapshotDoc[];
      for (const s of snaps) all.push(s);
    }

    const out: MetricasPacientesBulk = {};
    for (const s of all) {
      out[s.pacienteId] = {
        adherencia: s.adherencia,
        dolorPromedio: s.dolorPromedio ?? null,
      };
    }
    return out;
  }
}
