import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { MetricasPacientesBulk } from '../../../../types/global';

type SnapshotDoc = {
  _id: string;
  pacienteId: string;
  pacienteLegacyId?: string;
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
   * Obtiene el bulk de métricas indexadas por id de paciente.
   *
   * Modelo nuevo (Fase 3 rediseño records):
   * - Resuelve las clínicas gestionadas por el usuario actual (`me.queries.myManagedClinics`).
   * - Por cada clínica, lee `patientMetricsSnapshot` ventana 30d (default).
   * - Construye un mapa indexado por `pacienteLegacyId` (UUID legacy) y
   *   también por `pacienteId` Convex, para soportar ambos formatos.
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

    // Mapa indexado por ambos: pacienteId Convex y pacienteLegacyId.
    const out: MetricasPacientesBulk = {};
    for (const s of all) {
      const entry = {
        adherencia: s.adherencia,
        dolor_promedio: s.dolorPromedio ?? null,
      };
      out[s.pacienteId] = entry;
      if (s.pacienteLegacyId) {
        out[s.pacienteLegacyId] = entry;
      }
    }
    return out;
  }
}
