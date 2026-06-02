import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { CumplimientoService } from '../../pacientes/data-access/cumplimiento.service';
import { ActividadHoyService } from '../../actividad/data-access/actividad-hoy.service';
import { LoggerService } from '../../../core/services/logger.service';
import type { CumplimientoDia, DiaSemana } from '../../../../types/global';
import {
  daysBetweenYMD,
  diaSemanaFromYMD,
  getMadridDate,
  offsetMadridDate,
} from '../../../shared/utils/madrid-date.util';

export interface DiaSemanaCalendario {
  fecha: string;
  letra: string;
  esHoy: boolean;
  estado: 'completado' | 'parcial' | 'fallido' | 'descanso' | 'programado' | 'futuro-descanso';
}

const LETRAS_SEMANA: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

@Injectable({ providedIn: 'root' })
export class RachaPacienteService {
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private cumplimientoService = inject(CumplimientoService);
  private actividadHoyService = inject(ActividadHoyService);
  private logger = inject(LoggerService);

  readonly cargando = signal<boolean>(false);
  readonly rachaActual = signal<number>(0);
  private diasCumplimiento = signal<CumplimientoDia[]>([]);
  private datosCargados = signal<boolean>(false);
  /** Clave (userId|clinicId) usada para forzar recarga al cambiar de contexto. */
  private lastLoadKey: string | null = null;

  /** Mejor racha en los últimos 14 días (calculada sobre datos ya cargados) */
  readonly mejorRacha = computed<number>(() => {
    const dias = this.diasCumplimiento();
    if (dias.length === 0) return 0;

    const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let mejor = 0;
    let actual = 0;
    let ultimaFechaYMD: string | null = null;

    for (const dia of sorted) {
      if (dia.tipo === 'descanso') continue;
      if (dia.tipo === 'completado') {
        if (ultimaFechaYMD) {
          // Diferencia de días calendario Madrid (estable frente a DST).
          const diffDias = daysBetweenYMD(ultimaFechaYMD, dia.fecha);
          actual = diffDias <= 1 ? actual + 1 : 1;
        } else {
          actual = 1;
        }
        ultimaFechaYMD = dia.fecha;
        if (actual > mejor) mejor = actual;
      } else {
        actual = 0;
        ultimaFechaYMD = null;
      }
    }

    return mejor;
  });

  readonly cumplimientoSemana = computed<DiaSemanaCalendario[]>(() => {
    const dias = this.diasCumplimiento();
    const planes = this.actividadHoyService.planesActivos();
    const hoyStr = getMadridDate();

    // Lunes = 0..., Domingo = 6. `diaSemanaFromYMD` devuelve 'L'..'D'.
    // Iteramos los 7 días de la semana actual partiendo del lunes Madrid.
    const LETRAS_LMD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
    const idxHoy = LETRAS_LMD.indexOf(diaSemanaFromYMD(hoyStr));

    const resultado: DiaSemanaCalendario[] = [];

    for (let i = 0; i < 7; i++) {
      // Offset desde hoy hasta el día i de la semana (lunes = 0).
      const fechaStr = offsetMadridDate(i - idxHoy);
      const esHoy = fechaStr === hoyStr;
      const esFuturo = fechaStr > hoyStr;
      const letraIdx = i; // 0=lunes → L, 1=martes → M, etc.

      if (esFuturo) {
        // Días futuros: ver si hay ejercicios programados.
        const diaSemana = diaSemanaFromYMD(fechaStr);
        const tieneEjercicios = planes.some((plan) =>
          plan.items.some((item) => {
            if (!item.diasSemana || item.diasSemana.length === 0) return true;
            return item.diasSemana.includes(diaSemana);
          }),
        );
        resultado.push({
          fecha: fechaStr,
          letra: LETRAS_SEMANA[letraIdx],
          esHoy: false,
          estado: tieneEjercicios ? 'programado' : 'futuro-descanso',
        });
      } else {
        // Día pasado o hoy: buscar en cumplimiento.
        const diaCumplimiento = dias.find((d) => d.fecha === fechaStr);

        let estado: DiaSemanaCalendario['estado'];
        if (esHoy) {
          // Para hoy, usar datos en tiempo real del ActividadHoyService.
          const cumplimientoHoy = this.cumplimientoService.getCumplimientoHoy(
            this.actividadHoyService.planesActivos(),
            this.actividadHoyService.registrosHoy(),
          );
          if (cumplimientoHoy) {
            estado = cumplimientoHoy.tipo as DiaSemanaCalendario['estado'];
          } else {
            estado = 'descanso';
          }
        } else if (diaCumplimiento) {
          estado = diaCumplimiento.tipo as DiaSemanaCalendario['estado'];
        } else {
          estado = 'descanso';
        }

        resultado.push({
          fecha: fechaStr,
          letra: LETRAS_SEMANA[letraIdx],
          esHoy,
          estado,
        });
      }
    }

    return resultado;
  });

  constructor() {
    effect(() => {
      const usuario = this.sessionService.usuario();
      const enModoPaciente = this.sessionService.enModoPaciente();
      const clinicId = this.clinicaActiva.selectedClinicaId();

      if (!usuario?.id || !enModoPaciente) return;

      const currentKey = `${usuario.id}|${clinicId ?? ''}`;
      if (this.lastLoadKey === currentKey && this.datosCargados()) return;
      if (this.cargando()) return;

      this.lastLoadKey = currentKey;
      this.cargar(usuario.id, clinicId);
    });
  }

  /** Permite forzar la carga desde fuera (ej: fisio viendo vista paciente) */
  cargarSiNecesario(userId: string, clinicId?: string | null): void {
    const resolvedClinicId = clinicId ?? this.clinicaActiva.selectedClinicaId();
    const currentKey = `${userId}|${resolvedClinicId ?? ''}`;
    if (this.lastLoadKey === currentKey && this.datosCargados()) return;
    if (this.cargando()) return;
    this.lastLoadKey = currentKey;
    this.cargar(userId, resolvedClinicId);
  }

  private async cargar(
    userId: string,
    clinicId: string | null,
  ): Promise<void> {
    if (this.cargando()) return;

    this.cargando.set(true);
    try {
      // Rango de los últimos 14 días en calendario Europe/Madrid (mismo
      // huso que `dailyPatientRollup.fecha`).
      const desdeStr = offsetMadridDate(-14);
      const hastaStr = getMadridDate();

      const resp = await this.cumplimientoService.getCumplimiento(
        userId,
        desdeStr,
        hastaStr,
        clinicId,
      );

      this.diasCumplimiento.set(resp.dias);
      this.rachaActual.set(this.calcularRacha(resp.dias));
      this.datosCargados.set(true);
    } catch (err) {
      this.logger.error('Error al cargar racha:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  private calcularRacha(dias: CumplimientoDia[]): number {
    const sorted = [...dias].sort((a, b) => b.fecha.localeCompare(a.fecha));
    let fechaEsperada = getMadridDate();
    let racha = 0;

    for (const dia of sorted) {
      if (dia.tipo === 'descanso') continue;

      const diffDias = daysBetweenYMD(dia.fecha, fechaEsperada);
      if (diffDias <= 1) {
        if (dia.tipo === 'completado') {
          racha++;
          fechaEsperada = dia.fecha;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return racha;
  }
}
