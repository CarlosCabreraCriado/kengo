import { Injectable, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';
import { ConvexService } from '../convex/convex.service';
import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import type { NotificacionApp } from '../../../types/global';

interface AlertDoc {
  _id: string;
  tipo:
    | 'comentario'
    | 'dolor_alto'
    | 'inactividad'
    | 'adherencia_baja'
    | 'tendencia_negativa';
  pacienteId: string;
  pacienteNombre: string;
  texto?: string;
  dolorEscala?: number;
  inactividadDias?: number;
  adherenciaPct?: number;
  fechaGeneracion: string;
  estado: 'pendiente' | 'revisada' | 'descartada';
}

function tituloFromAlert(a: AlertDoc): string {
  switch (a.tipo) {
    case 'dolor_alto':
      return a.dolorEscala !== undefined
        ? `Dolor alto (${a.dolorEscala}/10)`
        : 'Dolor alto';
    case 'inactividad':
      return a.inactividadDias !== undefined
        ? `Inactividad (${a.inactividadDias} días)`
        : 'Inactividad';
    case 'adherencia_baja':
      return a.adherenciaPct !== undefined
        ? `Adherencia baja (${a.adherenciaPct}%)`
        : 'Adherencia baja';
    case 'tendencia_negativa':
      return 'Tendencia negativa';
    case 'comentario':
    default:
      return 'Comentario';
  }
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private router = inject(Router);
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);

  // Lectura del modelo nuevo `physioAlerts` (Fase 3 rediseño records).
  // El watcher de alerts.listForCurrentFisio devuelve un PaginationResult.
  // Reactivo a `selectedClinicaId`: si hay clínica activa, filtra a esa
  // clínica concreta; si no, agrega todas las gestionadas por el fisio.
  private readonly suscripcion = this.convex.watchQuery(
    api.alerts.queries.listForCurrentFisio,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id || !this.sessionService.puedeRecibirNotificaciones()) {
        return 'skip' as const;
      }
      const clinicId = this.clinicaActiva.selectedClinicaId();
      return {
        paginationOpts: { numItems: 50, cursor: null },
        ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
      };
    },
  );

  private overrides = signal<Record<string, boolean>>({});

  readonly notificaciones = computed<NotificacionApp[]>(() => {
    const data = this.suscripcion.value();
    if (!data) return [];
    const overrides = this.overrides();
    return data.page.map((a: AlertDoc) => {
      const id = a._id;
      const leidaBase = a.estado !== 'pendiente';
      const leida = overrides[id] !== undefined ? overrides[id] : leidaBase;
      return {
        id,
        fuente: 'kengo',
        categoria: 'comentario_paciente' as const,
        emisorNombre: a.pacienteNombre ?? '',
        emisorAvatar: null,
        emisorId: a.pacienteId,
        titulo: tituloFromAlert(a),
        texto: a.texto ?? null,
        fecha: a.fechaGeneracion,
        leida,
        rutaDestino: `/mis-pacientes/${a.pacienteId}`,
      };
    });
  });

  readonly pendientes = computed(
    () => this.notificaciones().filter((n) => !n.leida).length,
  );

  readonly cargando = this.suscripcion.isLoading;
  readonly hayPendientes = computed(() => this.pendientes() > 0);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        // La suscripción Convex es reactiva; no hay recarga manual.
      });
  }

  async recargar(): Promise<void> {
    // La suscripción se actualiza sola; método preservado por compatibilidad.
  }

  async marcarRevisada(n: NotificacionApp): Promise<void> {
    if (n.leida) return;

    this.overrides.update((o) => ({ ...o, [n.id]: true }));
    try {
      await this.convex.mutation(api.alerts.mutations.markAsRead, {
        alertId: n.id as any,
      });
    } catch (err) {
      console.error('Error al marcar notificación como revisada:', err);
      this.overrides.update((o) => ({ ...o, [n.id]: false }));
    }
  }

  async marcarTodasRevisadas(): Promise<void> {
    const prevIds = this.notificaciones()
      .filter((n) => !n.leida)
      .map((n) => n.id);
    this.overrides.update((o) => {
      const next = { ...o };
      for (const id of prevIds) next[id] = true;
      return next;
    });
    try {
      await this.convex.mutation(api.alerts.mutations.markAllAsRead, {});
    } catch (err) {
      console.error('Error al marcar todas como revisadas:', err);
      this.overrides.update((o) => {
        const next = { ...o };
        for (const id of prevIds) next[id] = false;
        return next;
      });
    }
  }
}
