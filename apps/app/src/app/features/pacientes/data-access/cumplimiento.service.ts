import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { LoggerService } from '../../../core/services/logger.service';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import type {
  CumplimientoResponse,
  CumplimientoDia,
  TipoCumplimiento,
  ResumenCumplimiento,
  RegistroEjercicioRecord,
  NotificacionFisio,
} from '../../../../types/global';
import {
  ComentarioSesion,
  EstadisticasPaciente,
  SesionAgrupada,
} from './paciente-detail.types';
import {
  daysBetweenYMD,
  getMadridDate,
  offsetMadridDate,
  ymdMadridFromInstant,
} from '../../../shared/utils/madrid-date.util';

export interface CumplimientoConTendencia {
  actual: CumplimientoResponse;
  anterior: CumplimientoResponse;
  /**
   * Delta absolutos vs período anterior del mismo tamaño. Signo crudo:
   * los componentes (`ui2-trend`) deciden la semántica con `inverse`.
   */
  trend: {
    /** Diferencia en puntos porcentuales (0–100). null si no hay datos previos. */
    adherence: number | null;
    /** Diferencia en escala /10. null si alguno de los dos períodos no tiene dolor registrado. */
    pain: number | null;
  };
}
import { formatDate } from '../../../shared/utils/format-date';

// Estructura del doc del modelo nuevo `dailyPatientRollup` (camelCase desde Convex).
interface DailyRollup {
  pacienteId: string;
  fecha: string;
  planAggregates: {
    planId: string;
    esperados: number;
    completados: number;
    extras?: number;
    dolorMedio?: number;
  }[];
  totalEsperados: number;
  totalCompletados: number;
  totalExtras?: number;
  dolorPromedio?: number;
  esfuerzoPromedio?: number;
  estadoDia:
    | 'completado'
    | 'parcial'
    | 'fallido'
    | 'descanso'
    | 'sin_plan';
}

@Injectable({ providedIn: 'root' })
export class CumplimientoService {
  private convex = inject(ConvexService);
  private sessionService = inject(SessionService);
  private logger = inject(LoggerService);

  /**
   * Obtiene cumplimiento histórico desde Convex (modelo nuevo
   * `dailyPatientRollup` — 1 doc por (paciente, fecha) con planAggregates
   * embebido).
   *
   * `clinicId` opcional: si llega, filtra estrictamente los rollups por
   * esa clínica (aislamiento multiclínica).
   */
  async getCumplimiento(
    pacienteId: string,
    desde?: string,
    hasta?: string,
    clinicId?: string | null,
  ): Promise<CumplimientoResponse> {
    try {
      const convexUserId = this.resolveUserConvexId(pacienteId);
      if (!convexUserId) {
        return { dias: [], resumen: this.emptyResumen() };
      }

      // Default: año en curso si no se pasa rango (calendario Europe/Madrid).
      const hoy = getMadridDate();
      const inicioAno = `${hoy.slice(0, 4)}-01-01`;

      const rollups = (await this.convex.query(
        api.rollups.queries.getDailyByPaciente,
        {
          pacienteId: convexUserId,
          desde: desde ?? inicioAno,
          hasta: hasta ?? hoy,
          ...(clinicId ? { clinicId: clinicId as Id<'clinics'> } : {}),
        },
      )) as DailyRollup[];

      return this.buildCumplimientoResponse(rollups);
    } catch (error) {
      this.logger.error('Error al obtener cumplimiento:', error);
      return { dias: [], resumen: this.emptyResumen() };
    }
  }

  // NOTA: el antiguo `getCumplimientoHoy` (conteo de "hoy" recalculado en
  // cliente con criterio propio) se eliminó: el estado de hoy se lee ahora
  // en tiempo real de `api.sessions.queries.getDayDetailByPaciente`, que usa
  // el mismo conteo por identidad que rollups y detalle del fisio (ver
  // `racha-paciente.service.ts`).

  /**
   * Cumplimiento del rango actual + del rango anterior del mismo tamaño.
   * Permite calcular tendencias (adherencia, dolor) sin tocar el backend.
   */
  async getCumplimientoConTendencia(
    pacienteId: string,
    desde: string,
    hasta: string,
    clinicId?: string | null,
  ): Promise<CumplimientoConTendencia> {
    const dias = daysBetweenYMD(desde, hasta) + 1; // ambos inclusive
    const offsetDesde = -dias;
    const desdeAnterior = offsetMadridDate(offsetDesde, new Date(`${desde}T12:00:00Z`));
    const hastaAnterior = offsetMadridDate(-1, new Date(`${desde}T12:00:00Z`));

    const [actual, anterior] = await Promise.all([
      this.getCumplimiento(pacienteId, desde, hasta, clinicId),
      this.getCumplimiento(pacienteId, desdeAnterior, hastaAnterior, clinicId),
    ]);

    const adherenceActual = actual.resumen.adherenciaReal;
    const adherenceAnterior = anterior.resumen.adherenciaReal;
    const adherenceDelta =
      anterior.resumen.diasProgramados > 0
        ? adherenceActual - adherenceAnterior
        : null;

    const painActual = this.promedioDolor(actual.dias);
    const painAnterior = this.promedioDolor(anterior.dias);
    const painDelta =
      painActual != null && painAnterior != null
        ? Math.round((painActual - painAnterior) * 10) / 10
        : null;

    return {
      actual,
      anterior,
      trend: { adherence: adherenceDelta, pain: painDelta },
    };
  }

  private promedioDolor(dias: CumplimientoDia[]): number | null {
    const valores = dias
      .map((d) => d.dolorPromedio)
      .filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    return (
      Math.round(
        (valores.reduce((a, b) => a + b, 0) / valores.length) * 10,
      ) / 10
    );
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
        ejerciciosExtras: r.totalExtras ?? 0,
        dolorPromedio: r.dolorPromedio ?? null,
        planes: r.planAggregates.map((p) => ({
          planId: p.planId as string,
          titulo: '', // sin denormalizar; lookup opcional si la UI lo requiere
          esperados: p.esperados,
          completados: p.completados,
          extras: p.extras ?? 0,
        })),
      };
    });

    // Adherencia estricta = % de días con plan completados al 100% (sin
    // ponderar parciales). Misma fórmula canónica que usa el snapshot:
    // ver `convex/snapshots/internal.ts:recomputePatientForWindow`.
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
        fechaFormateada: formatDate(dia.fecha, 'long'),
        registros: regs,
        totalEjercicios: dia.ejerciciosCompletados,
        ejerciciosExtras: dia.ejerciciosExtras ?? 0,
        promedioDolorValue: promedioDolor,
        comentarios,
        totalComentarios: comentarios.length,
        tipo: dia.tipo,
        ejerciciosEsperados: dia.ejerciciosEsperados,
        // No ocultar planes con trabajo hecho: antes se filtraba solo por
        // `esperados > 0` y desaparecía el plan que tenía los completados o
        // extras (barra "0/7" huérfana en el timeline).
        planes: dia.planes.filter(
          (p) => p.esperados > 0 || p.completados > 0 || (p.extras ?? 0) > 0,
        ),
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
   *
   * Nota: `promedioDolorGeneral` se usa como fallback del KPI Dolor cuando
   * el snapshot de Convex no está disponible. La fórmula (promedio de
   * promedios por sesión, solo completadas) debe mantenerse equivalente a
   * la del snapshot — ver `convex/snapshots/internal.ts:recomputePatientForWindow`.
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

    // `dias` viene ordenado ASC por fecha (ver `buildCumplimientoResponse`),
    // así que la última actividad real es el match más a la derecha:
    // iteramos desde el final. Solo cuentan `completado` y `parcial`:
    // `fallido` significa día con plan vigente y 0 ejercicios completados
    // (ver `convex/_helpers/rollupComputation.ts:computeEstadoDia`), por lo
    // que NO es actividad — es justo lo contrario.
    let ultimoDiaActividad: CumplimientoDia | undefined;
    for (let i = dias.length - 1; i >= 0; i--) {
      const d = dias[i];
      if (d.tipo === 'completado' || d.tipo === 'parcial') {
        ultimoDiaActividad = d;
        break;
      }
    }
    let diasDesdeUltimaSesion: number | null = null;
    if (ultimoDiaActividad) {
      // Diferencia de días calendario Madrid (estable frente a DST).
      diasDesdeUltimaSesion = daysBetweenYMD(
        ultimoDiaActividad.fecha,
        getMadridDate(),
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
      // `reg.fechaHora` es un instante UTC (ISO con `Z`). El día calendario
      // del paciente se calcula en Europe/Madrid para coincidir con el
      // contrato de `dailyPatientRollup.fecha` y `sessions.fecha`.
      const fecha = ymdMadridFromInstant(reg.fechaHora);
      if (!grupos.has(fecha)) {
        grupos.set(fecha, []);
      }
      grupos.get(fecha)!.push(reg);
    }
    return grupos;
  }

  private calcularRachaCumplimiento(dias: CumplimientoDia[]): number {
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

  private calcularAdherenciaSemanalCumplimiento(
    dias: CumplimientoDia[],
  ): { semana: string; porcentaje: number }[] {
    const resultado: { semana: string; porcentaje: number }[] = [];

    for (let i = 0; i < 4; i++) {
      // Ventanas de 7 días contadas hacia atrás desde hoy en calendario
      // Madrid (no en milisegundos: el cambio CET↔CEST haría una semana
      // de 6 u 8 días).
      const finStr = offsetMadridDate(-i * 7);
      const inicioStr = offsetMadridDate(-i * 7 - 6);

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

}
