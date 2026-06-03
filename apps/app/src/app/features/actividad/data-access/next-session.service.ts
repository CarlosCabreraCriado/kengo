import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { LoggerService } from '../../../core/services/logger.service';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
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
  private clinicaActiva = inject(ClinicaActivaService);
  private logger = inject(LoggerService);

  readonly cargando = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private rawNext = signal<NextSessionPayload | null>(null);
  private datosCargados = signal<boolean>(false);
  /** Clave (userId|clinicId) usada para detectar cuándo recargar. */
  private lastLoadKey: string | null = null;

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
    // Una sola tentativa automática por (usuario|clínica). Si falla, esperar
    // a `recargar()` explícito — evita bucles cuando `cargar()` lanza y
    // `cargando.set(false)` re-dispararía el effect.
    effect(() => {
      const usuario = this.sessionService.usuario();
      const enPaciente = this.sessionService.enModoPaciente();
      const clinicId = this.clinicaActiva.selectedClinicaId();
      if (!usuario?.id || !enPaciente) return;

      const currentKey = `${usuario.id}|${clinicId ?? ''}`;
      if (this.lastLoadKey === currentKey) return;

      this.lastLoadKey = currentKey;
      void this.cargar(clinicId);
    });
  }

  recargar(): void {
    this.lastLoadKey = null;
    this.datosCargados.set(false);
    void this.cargar(this.clinicaActiva.selectedClinicaId());
  }

  private async cargar(clinicId: string | null): Promise<void> {
    if (this.cargando()) return;
    const convexId = this.sessionService.usuario()?.convexId;
    if (!convexId) return;

    this.cargando.set(true);
    this.error.set(null);
    try {
      const r = await this.convex.query(
        api.plans.queries.getNextSessionForPatient,
        {
          pacienteId: convexId,
          ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
        },
      );
      this.rawNext.set(r as NextSessionPayload | null);
      this.datosCargados.set(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        '[NextSessionService] Error al cargar próxima sesión:',
        msg,
        e,
      );
      this.error.set('No se pudo cargar la próxima sesión.');
    } finally {
      this.cargando.set(false);
    }
  }
}
