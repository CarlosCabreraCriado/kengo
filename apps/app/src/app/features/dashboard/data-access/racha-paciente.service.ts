import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { CumplimientoService } from '../../pacientes/data-access/cumplimiento.service';
import { ActividadHoyService } from '../../actividad/data-access/actividad-hoy.service';
import type { CumplimientoDia, DiaSemana } from '../../../../types/global';

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
  private cumplimientoService = inject(CumplimientoService);
  private actividadHoyService = inject(ActividadHoyService);

  readonly cargando = signal<boolean>(false);
  readonly rachaActual = signal<number>(0);
  private diasCumplimiento = signal<CumplimientoDia[]>([]);
  private datosCargados = signal<boolean>(false);

  /** Mejor racha en los últimos 14 días (calculada sobre datos ya cargados) */
  readonly mejorRacha = computed<number>(() => {
    const dias = this.diasCumplimiento();
    if (dias.length === 0) return 0;

    const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let mejor = 0;
    let actual = 0;
    let ultimaFecha: Date | null = null;

    for (const dia of sorted) {
      if (dia.tipo === 'descanso') continue;
      if (dia.tipo === 'completado') {
        const fechaDia = new Date(dia.fecha);
        if (ultimaFecha) {
          const diffDias = Math.floor(
            (fechaDia.getTime() - ultimaFecha.getTime()) / (1000 * 60 * 60 * 24),
          );
          actual = diffDias <= 1 ? actual + 1 : 1;
        } else {
          actual = 1;
        }
        ultimaFecha = fechaDia;
        if (actual > mejor) mejor = actual;
      } else {
        actual = 0;
        ultimaFecha = null;
      }
    }

    return mejor;
  });

  readonly cumplimientoSemana = computed<DiaSemanaCalendario[]>(() => {
    const dias = this.diasCumplimiento();
    const planes = this.actividadHoyService.planesActivos();
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Encontrar lunes de esta semana
    const lunes = new Date(hoy);
    const dow = hoy.getDay(); // 0=dom
    const diff = dow === 0 ? -6 : 1 - dow;
    lunes.setDate(hoy.getDate() + diff);
    lunes.setHours(0, 0, 0, 0);

    const DIAS_SEMANA_JS: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    const resultado: DiaSemanaCalendario[] = [];

    for (let i = 0; i < 7; i++) {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      const esHoy = fechaStr === hoyStr;
      const esFuturo = fecha > hoy && !esHoy;
      const letraIdx = i; // 0=lunes -> L, 1=martes -> M, etc.

      if (esFuturo) {
        // Días futuros: ver si hay ejercicios programados
        const diaJs = fecha.getDay();
        const diaSemana = DIAS_SEMANA_JS[diaJs];
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
        // Día pasado o hoy: buscar en cumplimiento
        const diaCumplimiento = dias.find((d) => d.fecha === fechaStr);

        let estado: DiaSemanaCalendario['estado'];
        if (esHoy) {
          // Para hoy, usar datos en tiempo real del ActividadHoyService
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

      if (
        usuario?.id &&
        enModoPaciente &&
        !this.datosCargados() &&
        !this.cargando()
      ) {
        this.cargar(usuario.id);
      }
    });
  }

  /** Permite forzar la carga desde fuera (ej: fisio viendo vista paciente) */
  cargarSiNecesario(userId: string): void {
    if (!this.datosCargados() && !this.cargando()) {
      this.cargar(userId);
    }
  }

  private async cargar(userId: string): Promise<void> {
    if (this.datosCargados() || this.cargando()) return;

    this.cargando.set(true);
    try {
      const hace14 = new Date();
      hace14.setDate(hace14.getDate() - 14);
      const hoy = new Date();

      const resp = await this.cumplimientoService.getCumplimiento(
        userId,
        hace14.toISOString().split('T')[0],
        hoy.toISOString().split('T')[0],
      );

      this.diasCumplimiento.set(resp.dias);
      this.rachaActual.set(this.calcularRacha(resp.dias));
      this.datosCargados.set(true);
    } catch (err) {
      console.error('Error al cargar racha:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  private calcularRacha(dias: CumplimientoDia[]): number {
    const sorted = [...dias].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const hoy = new Date().toISOString().split('T')[0];

    let racha = 0;
    let fechaEsperada = new Date(hoy);

    for (const dia of sorted) {
      if (dia.tipo === 'descanso') continue;

      const fechaDia = new Date(dia.fecha);
      const diffDias = Math.floor(
        (fechaEsperada.getTime() - fechaDia.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDias <= 1) {
        if (dia.tipo === 'completado') {
          racha++;
          fechaEsperada = fechaDia;
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
