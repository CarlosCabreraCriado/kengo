import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { AsignacionResponsable, BulkAsignacionPayload, BulkAsignacionResponse } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  private convex = inject(ConvexService);

  listarAsignaciones(clinicaId: string): Observable<AsignacionResponsable[]> {
    return from(
      this.convex.query(api.assignments.queries.listByClinic, { clinicId: clinicaId as any }),
    ).pipe(
      map((assignments) =>
        (assignments ?? []).map((a): AsignacionResponsable => ({
          id: a._id,
          idPaciente: a.paciente?._id ?? a.pacienteId,
          idFisio: a.fisio?._id ?? a.fisioId,
          idClinica: clinicaId,
          nombreFisio: a.fisio?.firstName,
          apellidoFisio: a.fisio?.lastName,
          avatarFisio: undefined,
          fechaCreacion: new Date(a._creationTime).toISOString(),
        })),
      ),
    );
  }

  bulkAsignar(payload: BulkAsignacionPayload): Observable<BulkAsignacionResponse> {
    return from(this.bulkAssignImpl(payload.clinicId, payload.asignaciones));
  }

  private async bulkAssignImpl(
    clinicId: string,
    asignaciones: { pacienteId: string; fisioId: string | null }[],
  ): Promise<BulkAsignacionResponse> {
    try {
      const validAsignaciones = asignaciones.filter((a) => a.fisioId !== null);

      const resolvedAssignments = validAsignaciones.map((a) => ({
        pacienteId: a.pacienteId,
        fisioId: a.fisioId!,
      }));

      await this.convex.mutation(api.assignments.mutations.bulkAssign, {
        clinicId: clinicId as any,
        assignments: resolvedAssignments as any,
      });

      const eliminadas = asignaciones.length - validAsignaciones.length;
      return { success: true, asignadas: resolvedAssignments.length, eliminadas };
    } catch {
      return { success: false, asignadas: 0, eliminadas: 0 };
    }
  }

  getFisioResponsable(pacienteId: string, clinicaId: string): Observable<AsignacionResponsable | null> {
    return from(
      this.convex.query(api.assignments.queries.getFisioResponsable, {
        pacienteId: pacienteId as any,
        clinicId: clinicaId as any,
      }),
    ).pipe(
      map((result) => {
        if (!result) return null;
        return {
          id: result._id,
          idPaciente: pacienteId,
          idFisio: result.fisioId,
          idClinica: clinicaId,
          nombreFisio: result.fisioNombre,
          apellidoFisio: result.fisioApellido,
          avatarFisio: result.fisioAvatar,
          fechaCreacion: new Date(result._creationTime).toISOString(),
        };
      }),
    );
  }

  /**
   * Auto-asigna un fisio como responsable de un paciente si no tiene uno.
   */
  autoAsignar(pacienteId: string, fisioId: string, clinicaId: string): void {
    this.getFisioResponsable(pacienteId, clinicaId).subscribe((asignacion) => {
      if (!asignacion) {
        this.assignImpl(pacienteId, fisioId, clinicaId);
      }
    });
  }

  private async assignImpl(
    pacienteId: string,
    fisioId: string,
    clinicaId: string,
  ): Promise<void> {
    try {
      await this.convex.mutation(api.assignments.mutations.assign, {
        pacienteId: pacienteId as any,
        fisioId: fisioId as any,
        clinicId: clinicaId as any,
      });
    } catch (err) {
      console.warn('[AutoAsignacion] Error auto-asignando:', err);
    }
  }
}
