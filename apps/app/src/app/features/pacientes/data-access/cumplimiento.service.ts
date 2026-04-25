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

@Injectable({ providedIn: 'root' })
export class CumplimientoService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);

  /**
   * Obtiene cumplimiento histórico desde Convex (tabla dailyCompliance)
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

      const raw = await this.convex.query(
        api.compliance.queries.getByPaciente,
        {
          pacienteId: convexUserId as any,
          fechaDesde: desde,
          fechaHasta: hasta,
        },
      );

      const records = (raw as any[]) || [];
      return this.buildCumplimientoResponse(records);
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
      if (p.fecha_inicio) {
        const inicio = new Date(p.fecha_inicio);
        inicio.setHours(0, 0, 0, 0);
        if (inicio > hoy) return false;
      }
      if (p.fecha_fin) {
        const fin = new Date(p.fecha_fin);
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
        if (!item.dias_semana || item.dias_semana.length === 0) return true;
        return item.dias_semana.includes(diaHoy);
      });

      const esperados = itemsHoy.length;
      let completados = 0;

      for (const item of itemsHoy) {
        const regsItem = registrosHoy.filter((r) => r.plan_item === item.id || r.plan_item === (item as any)._convexId);
        const vecesRequeridas = item.veces_dia ?? 1;
        if (regsItem.length >= vecesRequeridas) {
          completados++;
        }
      }

      if (esperados > 0) todoDescanso = false;
      totalEsperados += esperados;
      totalCompletados += completados;

      planesDetalle.push({
        plan_id: plan.id_plan,
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
      .filter((r) => r.dolor_escala != null)
      .map((r) => r.dolor_escala!);
    const dolorPromedio =
      dolores.length > 0
        ? Math.round(
            (dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10,
          ) / 10
        : null;

    return {
      fecha: fechaHoy,
      tipo,
      ejercicios_esperados: totalEsperados,
      ejercicios_completados: totalCompletados,
      dolor_promedio: dolorPromedio,
      planes: planesDetalle,
    };
  }

  // ========= Helpers =========

  private buildCumplimientoResponse(records: any[]): CumplimientoResponse {
    // Agrupar registros por fecha
    const byDate = new Map<string, any[]>();
    for (const r of records) {
      const existing = byDate.get(r.fecha) || [];
      existing.push(r);
      byDate.set(r.fecha, existing);
    }

    const dias: CumplimientoDia[] = [];
    let diasProgramados = 0;
    let diasCompletados = 0;
    let diasParciales = 0;
    let diasFallidos = 0;
    let diasDescanso = 0;

    for (const [fecha, dayRecords] of byDate) {
      const totalEsperados = dayRecords.reduce((sum: number, r: any) => sum + r.ejerciciosEsperados, 0);
      const totalCompletados = dayRecords.reduce((sum: number, r: any) => sum + r.ejerciciosCompletados, 0);
      const esDiaDescanso = dayRecords.every((r: any) => r.esDiaDescanso);

      const dolores = dayRecords
        .filter((r: any) => r.dolorPromedio != null)
        .map((r: any) => r.dolorPromedio);
      const dolorPromedio = dolores.length > 0
        ? Math.round((dolores.reduce((a: number, b: number) => a + b, 0) / dolores.length) * 10) / 10
        : null;

      let tipo: TipoCumplimiento;
      if (esDiaDescanso) {
        tipo = 'descanso';
        diasDescanso++;
      } else if (totalCompletados >= totalEsperados && totalEsperados > 0) {
        tipo = 'completado';
        diasCompletados++;
        diasProgramados++;
      } else if (totalCompletados > 0) {
        tipo = 'parcial';
        diasParciales++;
        diasProgramados++;
      } else {
        tipo = 'fallido';
        diasFallidos++;
        diasProgramados++;
      }

      dias.push({
        fecha,
        tipo,
        ejercicios_esperados: totalEsperados,
        ejercicios_completados: totalCompletados,
        dolor_promedio: dolorPromedio,
        planes: dayRecords.map((r: any) => ({
          plan_id: 0,
          titulo: '',
          esperados: r.ejerciciosEsperados,
          completados: r.ejerciciosCompletados,
        })),
      });
    }

    const adherenciaReal = diasProgramados > 0
      ? Math.round((diasCompletados / diasProgramados) * 100)
      : 0;

    return {
      dias: dias.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      resumen: {
        dias_programados: diasProgramados,
        dias_completados: diasCompletados,
        dias_parciales: diasParciales,
        dias_fallidos: diasFallidos,
        dias_descanso: diasDescanso,
        adherencia_real: adherenciaReal,
      },
    };
  }

  private emptyResumen(): ResumenCumplimiento {
    return {
      dias_programados: 0,
      dias_completados: 0,
      dias_parciales: 0,
      dias_fallidos: 0,
      dias_descanso: 0,
      adherencia_real: 0,
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
