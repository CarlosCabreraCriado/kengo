import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConvexService } from '../../../core/convex/convex.service';
import { ClinicasService } from '../../clinica/data-access/clinicas.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { AsignacionResponsable, BulkAsignacionPayload, BulkAsignacionResponse } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  private convex = inject(ConvexService);
  private clinicasService = inject(ClinicasService);

  listarAsignaciones(clinicaId: number): Observable<AsignacionResponsable[]> {
    const convexClinicId = this.clinicasService.legacyToConvexClinicId().get(clinicaId);
    if (!convexClinicId) return of([]);

    return from(
      this.convex.query(api.assignments.queries.listByClinic, { clinicId: convexClinicId }),
    ).pipe(
      map((assignments) =>
        (assignments ?? []).map((a): AsignacionResponsable => ({
          id: 0,
          idPaciente: a.paciente?.legacyDirectusId ?? a.pacienteId,
          idFisio: a.fisio?.legacyDirectusId ?? a.fisioId,
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
    const convexClinicId = this.clinicasService.legacyToConvexClinicId().get(payload.id_clinica);
    if (!convexClinicId) {
      return of({ success: false, asignadas: 0, eliminadas: 0 });
    }

    // Resolver legacy IDs a Convex IDs
    return from(
      this.resolveAndBulkAssign(convexClinicId, payload.asignaciones),
    );
  }

  private async resolveAndBulkAssign(
    clinicId: string,
    asignaciones: { id_paciente: string; id_fisio: string | null }[],
  ): Promise<BulkAsignacionResponse> {
    try {
      // Only process assignments with non-null fisio
      const validAsignaciones = asignaciones.filter((a) => a.id_fisio !== null);

      const resolvedAssignments = [];
      for (const a of validAsignaciones) {
        const paciente = await this.resolveUserByLegacyId(a.id_paciente);
        const fisio = await this.resolveUserByLegacyId(a.id_fisio!);
        if (paciente && fisio) {
          resolvedAssignments.push({ pacienteId: paciente, fisioId: fisio });
        }
      }

      await this.convex.mutation(api.assignments.mutations.bulkAssign, {
        clinicId: clinicId as any,
        assignments: resolvedAssignments as any,
      });

      const eliminadas = asignaciones.length - validAsignaciones.length;
      return { success: true, asignadas: resolvedAssignments.length, eliminadas };
    } catch (err: any) {
      return { success: false, asignadas: 0, eliminadas: 0 };
    }
  }

  private async resolveUserByLegacyId(legacyId: string): Promise<string | null> {
    try {
      const user = await this.convex.query(
        api.users.queries.getByLegacyId,
        { legacyDirectusId: legacyId },
      );
      return user?._id ?? null;
    } catch {
      return null;
    }
  }

  getFisioResponsable(pacienteId: string, clinicaId: number): Observable<AsignacionResponsable | null> {
    return from(
      this.convex.query(api.assignments.queries.getFisioResponsable, {
        pacienteLegacyId: pacienteId,
        clinicLegacyId: clinicaId,
      }),
    ).pipe(
      map((result) => {
        if (!result) return null;
        return {
          id: 0,
          idPaciente: pacienteId,
          idFisio: result.fisioLegacyId ?? result.fisioId,
          idClinica: clinicaId,
          nombreFisio: result.fisioNombre,
          apellidoFisio: result.fisioApellido,
          avatarFisio: undefined,
          fechaCreacion: new Date(result._creationTime).toISOString(),
        } as AsignacionResponsable;
      }),
    );
  }

  /**
   * Auto-asigna un fisio como responsable de un paciente si no tiene uno.
   * Fire-and-forget: no bloquea el flujo principal.
   */
  autoAsignar(pacienteId: string, fisioId: string, clinicaId: number): void {
    this.getFisioResponsable(pacienteId, clinicaId).subscribe((asignacion) => {
      if (!asignacion) {
        // Resolve IDs and assign
        this.resolveAndAssign(pacienteId, fisioId, clinicaId);
      }
    });
  }

  private async resolveAndAssign(
    pacienteLegacyId: string,
    fisioLegacyId: string,
    clinicaLegacyId: number,
  ): Promise<void> {
    try {
      const convexClinicId = this.clinicasService.legacyToConvexClinicId().get(clinicaLegacyId);
      if (!convexClinicId) return;

      // Resolve user IDs via the getFisioResponsable query pattern (by_legacyDirectusId index)
      // For now, use bulk assign with a single assignment
      const paciente = await this.resolveUserByLegacyId(pacienteLegacyId);
      const fisio = await this.resolveUserByLegacyId(fisioLegacyId);

      if (!paciente || !fisio) {
        console.warn('[AutoAsignacion] No se pudieron resolver IDs');
        return;
      }

      await this.convex.mutation(api.assignments.mutations.assign, {
        pacienteId: paciente as any,
        fisioId: fisio as any,
        clinicId: convexClinicId,
      });

      console.log('[AutoAsignacion] Fisio auto-asignado como responsable');
    } catch (err) {
      console.warn('[AutoAsignacion] Error auto-asignando:', err);
    }
  }
}
