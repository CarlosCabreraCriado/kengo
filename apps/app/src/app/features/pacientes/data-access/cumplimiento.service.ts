import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import type {
  CumplimientoResponse,
  CumplimientoDia,
  DiaSemana,
  PlanCompleto,
  RegistroEjercicio,
} from '../../../../types/global';

const DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

@Injectable({ providedIn: 'root' })
export class CumplimientoService {
  private http = inject(HttpClient);

  /**
   * Obtiene cumplimiento histórico desde el backend (tabla cumplimiento_diario)
   */
  async getCumplimiento(
    pacienteId: string,
    desde?: string,
    hasta?: string,
  ): Promise<CumplimientoResponse> {
    const params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;

    return firstValueFrom(
      this.http.get<CumplimientoResponse>(
        `${env.API_URL}/paciente/${pacienteId}/cumplimiento`,
        { params, withCredentials: true },
      ),
    );
  }

  /**
   * Computa cumplimiento para HOY en tiempo real (sin depender del cron).
   * Reutiliza la misma lógica de días/semana que actividad-hoy.service.ts.
   */
  getCumplimientoHoy(
    planes: PlanCompleto[],
    registrosHoy: RegistroEjercicio[],
  ): CumplimientoDia | null {
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0];
    const diaHoy = DIAS_SEMANA[hoy.getDay()];

    // Filtrar planes activos cuyo rango incluya hoy
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
        const regsItem = registrosHoy.filter((r) => r.plan_item === item.id);
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

    let tipo: CumplimientoDia['tipo'];
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
}
