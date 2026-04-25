import { Injectable, inject } from '@angular/core';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { ComentariosPacienteResponse } from '../../../../types/global';

@Injectable({ providedIn: 'root' })
export class ComentariosPacienteService {
  private convex = inject(ConvexService);

  async getComentarios(pacienteId: string): Promise<ComentariosPacienteResponse> {
    return (await this.convex.query(
      api.notifications.queries.listCommentsByPatient,
      { pacienteId },
    )) as ComentariosPacienteResponse;
  }

  async marcarRevisada(notificacionId: string): Promise<void> {
    await this.convex.mutation(api.notifications.mutations.markAsRead, {
      notificationId: notificacionId as any,
    });
  }

  async marcarTodasRevisadas(pacienteId: string): Promise<void> {
    await this.convex.mutation(
      api.notifications.mutations.markAllReadForPatient,
      { pacienteId },
    );
  }
}
