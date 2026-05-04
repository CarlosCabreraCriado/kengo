import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Ui2AppointmentVm } from '../../../shared/ui-v2';

type DiaSemana = 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D';

interface NextSessionPayload {
  fecha: string;
  diaSemana: DiaSemana;
  planTitulo: string | null;
  totalEjercicios: number;
}

const WEEKDAY_LABEL: Record<DiaSemana, string> = {
  L: 'LUN',
  M: 'MAR',
  X: 'MIÉ',
  J: 'JUE',
  V: 'VIE',
  S: 'SÁB',
  D: 'DOM',
};

const MONTH_LABEL = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

@Injectable({ providedIn: 'root' })
export class NextSessionService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  readonly cargando = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private rawNext = signal<NextSessionPayload | null>(null);
  private datosCargados = signal<boolean>(false);

  readonly nextSessionVm = computed<Ui2AppointmentVm | null>(() => {
    const r = this.rawNext();
    if (!r) return null;
    const [y, m, d] = r.fecha.split('-').map(Number);
    const fecha = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
    const ejText = `${r.totalEjercicios} ejercicio${r.totalEjercicios === 1 ? '' : 's'}`;
    return {
      weekday: WEEKDAY_LABEL[r.diaSemana],
      day: fecha.getUTCDate(),
      month: MONTH_LABEL[fecha.getUTCMonth()] ?? '',
      titulo: r.planTitulo ?? 'Sesión de entrenamiento',
      meta: ejText,
      ubicacion: null,
    };
  });

  constructor() {
    effect(() => {
      const usuario = this.sessionService.usuario();
      const enPaciente = this.sessionService.enModoPaciente();
      if (
        usuario?.id &&
        enPaciente &&
        !this.datosCargados() &&
        !this.cargando()
      ) {
        void this.cargar();
      }
    });
  }

  recargar(): void {
    this.datosCargados.set(false);
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    if (this.cargando()) return;
    const convexId = this.sessionService.usuario()?.convexId;
    if (!convexId) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.convex.query(
        api.plans.queries.getNextSessionForPatient,
        { pacienteId: convexId },
      );
      this.rawNext.set(r as NextSessionPayload | null);
      this.datosCargados.set(true);
    } catch (e) {
      console.error('Error al cargar próxima sesión:', e);
      this.error.set('No se pudo cargar la próxima sesión.');
    } finally {
      this.cargando.set(false);
    }
  }
}
