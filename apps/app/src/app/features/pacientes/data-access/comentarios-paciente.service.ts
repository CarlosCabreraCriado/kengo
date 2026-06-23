import { Injectable, inject } from '@angular/core';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { ComentariosPacienteResponse } from '../../../../types/global';

interface AlertDoc {
  _id: string;
  _creationTime: number;
  tipo: 'comentario' | 'dolor_alto' | 'inactividad';
  pacienteId: string;
  clinicId: string;
  exerciseExecutionId?: string;
  sessionId?: string;
  texto?: string;
  dolorEscala?: number;
  fechaGeneracion: string;
  fechaRevision?: string;
  estado: 'pendiente' | 'revisada' | 'descartada';
}

@Injectable({ providedIn: 'root' })
export class ComentariosPacienteService {
  private convex = inject(ConvexService);

  async getComentarios(pacienteId: string): Promise<ComentariosPacienteResponse> {
    // Lectura del modelo nuevo `physioAlerts`. Filtra a `tipo: comentario`
    // para mantener la semántica del legacy `listCommentsByPatient`.
    const result = (await this.convex.query(
      api.alerts.queries.listByPaciente,
      { pacienteId, tipo: 'comentario' },
    )) as { items: AlertDoc[]; pendientes: number; total: number };

    const comentarios = result.items.map((a) => ({
      id: a._id,
      tipo: a.tipo as 'comentario' | 'dolor_alto',
      pacienteId: a.pacienteId,
      clinicId: a.clinicId,
      registroId: (a.exerciseExecutionId as string | undefined) ?? null,
      sesionId: (a.sessionId as string | undefined) ?? null,
      fechaRegistro: a.fechaGeneracion,
      // Las denormalizaciones de plan/ejercicio se eliminaron en el modelo
      // nuevo. Si la UI los requiere, se recuperarán por lookup.
      tituloPlan: null,
      nombre: null,
      texto: a.texto ?? null,
      dolorEscala: a.dolorEscala ?? null,
      revisada: a.estado !== 'pendiente',
      fechaRevision: a.fechaRevision ?? null,
      dateCreated: new Date(a._creationTime).toISOString(),
    }));

    return {
      comentarios,
      pendientes: result.pendientes,
      total: result.total,
    };
  }

  async marcarRevisada(notificacionId: string): Promise<void> {
    await this.convex.mutation(api.alerts.mutations.markAsRead, {
      alertId: notificacionId as any,
    });
  }

  async marcarTodasRevisadas(pacienteId: string): Promise<void> {
    await this.convex.mutation(
      api.alerts.mutations.markAllAsReadForPatient,
      { pacienteId },
    );
  }
}
