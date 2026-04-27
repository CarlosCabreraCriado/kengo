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
} from '../../../../types/global';

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
}
