import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type {
  CumplimientoResponse,
  CumplimientoDia,
  TipoCumplimiento,
  ResumenCumplimiento,
  DiaSemana,
  PlanCompleto,
  RegistroEjercicio,
  RegistroEjercicioRecord,
  NotificacionFisio,
} from '../../../../types/global';
import {
  ComentarioSesion,
  EstadisticasPaciente,
  SesionAgrupada,
} from './paciente-detail.types';

const DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Estructura del doc del modelo nuevo `dailyPatientRollup` (camelCase desde Convex).
type DailyRollup = {
  pacienteId: string;
  fecha: string;
  planAggregates: Array<{
    planId: string;
    esperados: number;
    completados: number;
    dolorMedio?: number;
  }>;
  totalEsperados: number;
  totalCompletados: number;
  dolorPromedio?: number;
  esfuerzoPromedio?: number;
  estadoDia:
    | 'completado'
    | 'parcial'
    | 'fallido'
    | 'descanso'
    | 'sin_plan';
};

@Injectable({ providedIn: 'root' })
export class CumplimientoService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  /**
   * Obtiene cumplimiento histórico desde Convex (modelo nuevo
   * `dailyPatientRollup` — 1 doc por (paciente, fecha) con planAggregates
   * embebido).
   */
  async getCumplimiento(
    pacienteId: string,
    desde?: string,
    hasta?: string,
  ): Promise<CumplimientoResponse> {
    try {
      const convexUserId = this.resolveUserConvexId(pacienteId);
      if (!convexUserId) {
        return { dias: [], resumen: this.emptyResumen() };
      }

      // Default: año en curso si no se pasa rango.
      const hoy = new Date().toISOString().slice(0, 10);
      const inicioAno = new Date().getFullYear() + '-01-01';

      const rollups = (await this.convex.query(
        api.rollups.queries.getDailyByPaciente,
        {
          pacienteId: convexUserId,
          desde: desde ?? inicioAno,
          hasta: hasta ?? hoy,
        },
      )) as DailyRollup[];

      return this.buildCumplimientoResponse(rollups);
    } catch (error) {
      console.error('Error al obtener cumplimiento:', error);
      return { dias: [], resumen: this.emptyResumen() };
    }
  }

  /**
   * Computa cumplimiento para HOY en tiempo real (sin depender del cron).
   */
  getCumplimientoHoy(
    planes: PlanCompleto[],
    registrosHoy: RegistroEjercicio[],
  ): CumplimientoDia | null {
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0]!;
    const diaHoy = DIAS_SEMANA[hoy.getDay()]!;

    const planesActivos = planes.filter((p) => {
      if (p.estado !== 'activo') return false;
      if (p.fechaInicio) {
        const inicio = new Date(p.fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        if (inicio > hoy) return false;
      }
      if (p.fechaFin) {
        const fin = new Date(p.fechaFin);
        fin.setHours(23, 59, 59, 999);
        if (fin < hoy) return false;
      }
      return true;
    });

    if (planesActivos.length === 0) return null;

    let totalEsperados = 0;
    let totalCompletados = 0;
    let todoDescanso = true;
    const planesDetalle: CumplimientoDia['planes'] = [];

    for (const plan of planesActivos) {
      const itemsHoy = plan.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) return true;
        return item.diasSemana.includes(diaHoy);
      });

      const esperados = itemsHoy.length;
      let completados = 0;

      for (const item of itemsHoy) {
        const regsItem = registrosHoy.filter((r) => r.planItemId === item.id || r.planItemId === (item as any)._convexId);
        const vecesRequeridas = item.vecesDia ?? 1;
        if (regsItem.length >= vecesRequeridas) {
          completados++;
        }
      }

      if (esperados > 0) todoDescanso = false;
      totalEsperados += esperados;
      totalCompletados += completados;

      planesDetalle.push({
        planId: plan.id,
        titulo: plan.titulo,
        esperados,
        completados,
      });
    }

    let tipo: TipoCumplimiento;
    if (todoDescanso) {
      tipo = 'descanso';
    } else if (totalCompletados >= totalEsperados && totalEsperados > 0) {
      tipo = 'completado';
    } else if (totalCompletados > 0) {
      tipo = 'parcial';
    } else {
      tipo = 'fallido';
    }

    const dolores = registrosHoy
      .filter((r) => r.dolorEscala != null)
      .map((r) => r.dolorEscala!);
    const dolorPromedio =
      dolores.length > 0
        ? Math.round(
            (dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10,
          ) / 10
        : null;

    return {
      fecha: fechaHoy,
      tipo,
      ejerciciosEsperados: totalEsperados,
      ejerciciosCompletados: totalCompletados,
      dolorPromedio: dolorPromedio,
      planes: planesDetalle,
    };
  }

  // ========= Helpers =========

  private buildCumplimientoResponse(rollups: DailyRollup[]): CumplimientoResponse {
    let diasProgramados = 0;
    let diasCompletados = 0;
    let diasParciales = 0;
    let diasFallidos = 0;
    let diasDescanso = 0;

    const dias: CumplimientoDia[] = rollups.map((r) => {
      let tipo: TipoCumplimiento;
      switch (r.estadoDia) {
        case 'completado':
          tipo = 'completado';
          diasCompletados++;
          diasProgramados++;
          break;
        case 'parcial':
          tipo = 'parcial';
          diasParciales++;
          diasProgramados++;
          break;
        case 'fallido':
          tipo = 'fallido';
          diasFallidos++;
          diasProgramados++;
          break;
        case 'descanso':
          tipo = 'descanso';
          diasDescanso++;
          break;
        case 'sin_plan':
        default:
          // El modelo nuevo crea rollup también para "sin_plan" si hubo
          // sesión sintética en backfill. Lo tratamos como descanso por
          // compatibilidad (no rompe métricas).
          tipo = 'descanso';
          diasDescanso++;
          break;
      }

      return {
        fecha: r.fecha,
        tipo,
        ejerciciosEsperados: r.totalEsperados,
        ejerciciosCompletados: r.totalCompletados,
        dolorPromedio: r.dolorPromedio ?? null,
        planes: r.planAggregates.map((p) => ({
          planId: p.planId as string,
          titulo: '', // sin denormalizar; lookup opcional si la UI lo requiere
          esperados: p.esperados,
          completados: p.completados,
        })),
      };
    });

    const adherenciaReal =
      diasProgramados > 0
        ? Math.round((diasCompletados / diasProgramados) * 100)
        : 0;

    return {
      dias: dias.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      resumen: {
        diasProgramados: diasProgramados,
        diasCompletados: diasCompletados,
        diasParciales: diasParciales,
        diasFallidos: diasFallidos,
        diasDescanso: diasDescanso,
        adherenciaReal: adherenciaReal,
      },
    };
  }

  private emptyResumen(): ResumenCumplimiento {
    return {
      diasProgramados: 0,
      diasCompletados: 0,
      diasParciales: 0,
      diasFallidos: 0,
      diasDescanso: 0,
      adherenciaReal: 0,
    };
  }

  private resolveUserConvexId(userId: string): string | undefined {
    const currentUser = this.sessionService.usuario();
    if (currentUser?.id === userId && currentUser.convexId) {
      return currentUser.convexId;
    }
    if (userId.length > 20) return userId;
    return undefined;
  }

  // ============================================
  // AGREGACIÓN PARA PACIENTE-DETAIL
  // ============================================

  /**
   * Construye `SesionAgrupada[]` combinando los días del cumplimiento
   * con los registros de ejercicio. Si se pasan `notificaciones`,
   * setea `tieneObservacionSesion` en cada sesión.
   */
  buildSesionesAgrupadas(
    dias: CumplimientoDia[],
    registros: RegistroEjercicioRecord[],
    notificaciones?: NotificacionFisio[],
  ): SesionAgrupada[] {
    const registrosPorFecha = this.agruparRegistrosPorFecha(registros);

    const sesiones: SesionAgrupada[] = dias.map((dia) => {
      const regs = registrosPorFecha.get(dia.fecha) || [];
      const dolores = regs
        .filter((r) => r.dolorEscala != null)
        .map((r) => r.dolorEscala!);
      const promedioDolor =
        dolores.length > 0
          ? Math.round(
              (dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10,
            ) / 10
          : dia.dolorPromedio;
      const comentarios: ComentarioSesion[] = regs
        .filter((r) => r.notaPaciente && r.notaPaciente.trim().length > 0)
        .map((r) => ({ texto: r.notaPaciente!, idRegistro: r.id }));

      return {
        fecha: dia.fecha,
        fechaFormateada: this.formatearFecha(dia.fecha),
        registros: regs,
        totalEjercicios: dia.ejerciciosCompletados,
        promedioDolorValue: promedioDolor,
        comentarios,
        totalComentarios: comentarios.length,
        tipo: dia.tipo,
        ejerciciosEsperados: dia.ejerciciosEsperados,
        planes: dia.planes.filter((p) => p.esperados > 0),
        tieneObservacionSesion: false, // se setea en enriquecer
      };
    });

    return notificaciones
      ? this.enriquecerSesionesConNotificaciones(sesiones, notificaciones)
      : sesiones;
  }

  /**
   * Re-evalúa `tieneObservacionSesion` para cada sesión en función de
   * la lista de notificaciones de comentarios del fisio. Útil cuando
   * sesiones y comentarios se cargan en paralelo y el contenedor
   * necesita rehidratar tras llegar la segunda fuente.
   */
  enriquecerSesionesConNotificaciones(
    sesiones: SesionAgrupada[],
    notificaciones: NotificacionFisio[],
  ): SesionAgrupada[] {
    if (sesiones.length === 0) return sesiones;
    const fechasConNotif = new Set(
      notificaciones
        .filter((n) => n.sesionId !== null)
        .map((n) => n.fechaRegistro.split('T')[0]),
    );

    return sesiones.map((s) => ({
      ...s,
      tieneObservacionSesion:
        s.totalComentarios > 0 || fechasConNotif.has(s.fecha),
    }));
  }

  /**
   * Calcula estadísticas globales del paciente para el rango de días
   * cargado.
   */
  buildEstadisticas(
    dias: CumplimientoDia[],
    sesiones: SesionAgrupada[],
    resumen: ResumenCumplimiento,
  ): EstadisticasPaciente {
    const doloresGenerales = sesiones
      .filter((s) => s.promedioDolorValue !== null)
      .map((s) => s.promedioDolorValue!);
    const promedioDolorGeneral =
      doloresGenerales.length > 0
        ? Math.round(
            (doloresGenerales.reduce((a, b) => a + b, 0) /
              doloresGenerales.length) *
              10,
          ) / 10
        : null;

    const ultimoDiaActividad = dias.find(
      (d) => d.tipo === 'completado' || d.tipo === 'parcial',
    );
    let diasDesdeUltimaSesion: number | null = null;
    if (ultimoDiaActividad) {
      const ultima = new Date(ultimoDiaActividad.fecha);
      const hoy = new Date();
      diasDesdeUltimaSesion = Math.floor(
        (hoy.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return {
      totalSesiones: resumen.diasCompletados + resumen.diasParciales,
      adherenciaGeneral: resumen.adherenciaReal,
      promedioDolorGeneral,
      diasDesdeUltimaSesion,
      rachaActual: this.calcularRachaCumplimiento(dias),
      adherenciaSemanal: this.calcularAdherenciaSemanalCumplimiento(dias),
    };
  }

  // ========= Helpers privados (movidos del componente) =========

  private agruparRegistrosPorFecha(
    registros: RegistroEjercicioRecord[],
  ): Map<string, RegistroEjercicioRecord[]> {
    const grupos = new Map<string, RegistroEjercicioRecord[]>();
    for (const reg of registros) {
      const fecha = reg.fechaHora.split('T')[0];
      if (!grupos.has(fecha)) {
        grupos.set(fecha, []);
      }
      grupos.get(fecha)!.push(reg);
    }
    return grupos;
  }

  private calcularRachaCumplimiento(dias: CumplimientoDia[]): number {
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

  private calcularAdherenciaSemanalCumplimiento(
    dias: CumplimientoDia[],
  ): { semana: string; porcentaje: number }[] {
    const resultado: { semana: string; porcentaje: number }[] = [];
    const hoy = new Date();

    for (let i = 0; i < 4; i++) {
      const finSemana = new Date(hoy);
      finSemana.setDate(hoy.getDate() - i * 7);
      const inicioSemana = new Date(finSemana);
      inicioSemana.setDate(finSemana.getDate() - 6);

      const inicioStr = inicioSemana.toISOString().split('T')[0];
      const finStr = finSemana.toISOString().split('T')[0];

      const diasSemana = dias.filter(
        (d) =>
          d.fecha >= inicioStr && d.fecha <= finStr && d.tipo !== 'descanso',
      );
      const programados = diasSemana.length;
      const completados = diasSemana.filter(
        (d) => d.tipo === 'completado',
      ).length;
      const porcentaje =
        programados > 0 ? Math.round((completados / programados) * 100) : 0;

      resultado.push({ semana: `Sem ${4 - i}`, porcentaje });
    }

    return resultado.reverse();
  }

  private formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    const esAyer = d.toDateString() === ayer.toDateString();

    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'long' });
    const year =
      d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : '';
    const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}${year}`;
    return esAyer ? `${label} (Ayer)` : label;
  }
}
