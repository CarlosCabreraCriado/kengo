import pool from "../utils/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { DiaSemana } from "@kengo/shared-models";

const DIAS_SEMANA: DiaSemana[] = ["D", "L", "M", "X", "J", "V", "S"];

/**
 * Obtiene "ayer" en timezone Europe/Madrid como YYYY-MM-DD
 */
function getAyerMadrid(): string {
  const now = new Date();
  // Convertir a hora de Madrid
  const madrid = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );
  madrid.setDate(madrid.getDate() - 1);
  return madrid.toISOString().split("T")[0];
}

interface PlanEjercicioRow extends RowDataPacket {
  id_plan: number;
  paciente: string;
  titulo: string;
  item_id: number;
  dias_semana: string | DiaSemana[] | null;
  veces_dia: number;
}

interface RegistroRow extends RowDataPacket {
  plan_item: number;
  plan_id: number;
  total_completados: number;
  dolor_promedio: number | null;
}

/**
 * Calcula cumplimiento diario para una fecha dada.
 * Para cada paciente con planes activos en esa fecha, determina cuántos
 * ejercicios se esperaban vs cuántos se completaron.
 *
 * @param fecha - YYYY-MM-DD (default: ayer en Europe/Madrid)
 * @param pacienteId - Opcional, para calcular solo un paciente
 * @returns Número de filas insertadas/actualizadas
 */
export async function calcularCumplimientoDiario(
  fecha?: string,
  pacienteId?: string
): Promise<number> {
  try {
    const target = fecha || getAyerMadrid();
    const diaSemana = DIAS_SEMANA[new Date(target + "T12:00:00").getDay()];

    // 1. Planes activos para esa fecha con sus ejercicios
    // Incluye 'completado' porque planes-expirados pudo marcarlo justo antes
    let planesQuery = `
      SELECT p.id_plan, p.paciente, p.titulo, pe.id AS item_id, pe.dias_semana, pe.veces_dia
      FROM Planes p
      INNER JOIN planes_ejercicios pe ON pe.plan = p.id_plan
      WHERE p.estado IN ('activo', 'completado')
        AND (p.fecha_inicio IS NULL OR DATE(p.fecha_inicio) <= ?)
        AND (p.fecha_fin IS NULL OR DATE(p.fecha_fin) >= ?)
    `;
    const params: (string | number)[] = [target, target];

    if (pacienteId) {
      planesQuery += ` AND p.paciente = ?`;
      params.push(pacienteId);
    }

    const [planes] = await pool.execute<PlanEjercicioRow[]>(
      planesQuery,
      params
    );

    if (planes.length === 0) {
      console.log(`[cumplimiento] ${target}: sin planes activos`);
      return 0;
    }

    // 2. Agrupar por paciente+plan
    const porPacientePlan = new Map<
      string,
      {
        paciente: string;
        plan: number;
        titulo: string;
        items: { id: number; diasSemana: DiaSemana[]; vecesDia: number }[];
      }
    >();

    for (const row of planes) {
      const key = `${row.paciente}:${row.id_plan}`;
      if (!porPacientePlan.has(key)) {
        porPacientePlan.set(key, {
          paciente: row.paciente,
          plan: row.id_plan,
          titulo: row.titulo,
          items: [],
        });
      }

      let diasSemana: DiaSemana[] = [];
      if (row.dias_semana) {
        if (Array.isArray(row.dias_semana)) {
          diasSemana = row.dias_semana;
        } else if (typeof row.dias_semana === 'string') {
          try {
            diasSemana = JSON.parse(row.dias_semana);
          } catch {
            diasSemana = [];
          }
        }
      }

      porPacientePlan.get(key)!.items.push({
        id: row.item_id,
        diasSemana,
        vecesDia: row.veces_dia ?? 1,
      });
    }

    // 3. Obtener registros completados para esa fecha
    let registrosQuery = `
      SELECT pr.plan_item,
             pe.plan AS plan_id,
             COUNT(*) AS total_completados,
             AVG(pr.dolor_escala) AS dolor_promedio
      FROM planes_registros pr
      INNER JOIN planes_ejercicios pe ON pe.id = pr.plan_item
      WHERE pr.completado = 1
        AND DATE(pr.fecha_hora) = ?
    `;
    const registrosParams: (string | number)[] = [target];

    if (pacienteId) {
      registrosQuery += ` AND pr.paciente = ?`;
      registrosParams.push(pacienteId);
    }

    registrosQuery += ` GROUP BY pr.plan_item, pe.plan`;

    const [registros] = await pool.execute<RegistroRow[]>(
      registrosQuery,
      registrosParams
    );

    // Indexar registros: plan_item -> { completados, dolor }
    const registrosPorItem = new Map<
      number,
      { completados: number; dolor: number | null }
    >();
    for (const reg of registros) {
      registrosPorItem.set(reg.plan_item, {
        completados: reg.total_completados,
        dolor: reg.dolor_promedio,
      });
    }

    // 4. Calcular y generar INSERT para cada paciente+plan
    let filasInsertadas = 0;

    for (const [, grupo] of porPacientePlan) {
      // Filtrar items que tocan para este día de la semana
      const itemsHoy = grupo.items.filter((item) => {
        if (!item.diasSemana || item.diasSemana.length === 0) return true;
        return item.diasSemana.includes(diaSemana);
      });

      const esDiaDescanso = itemsHoy.length === 0;
      const ejerciciosEsperados = itemsHoy.length;

      // Contar completados: un item se cuenta como completado si tiene >= veces_dia registros
      let ejerciciosCompletados = 0;

      for (const item of itemsHoy) {
        const reg = registrosPorItem.get(item.id);
        if (reg && reg.completados >= item.vecesDia) {
          ejerciciosCompletados++;
        }
      }

      // Calcular dolor promedio desde TODOS los registros del plan (no solo itemsHoy)
      let dolorTotal = 0;
      let dolorCount = 0;
      for (const item of grupo.items) {
        const reg = registrosPorItem.get(item.id);
        if (reg?.dolor !== null && reg?.dolor !== undefined) {
          dolorTotal += reg.dolor;
          dolorCount++;
        }
      }

      const dolorPromedio = dolorCount > 0 ? dolorTotal / dolorCount : null;

      // INSERT ... ON DUPLICATE KEY UPDATE (idempotente)
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO cumplimiento_diario
          (fecha, paciente, plan, ejercicios_esperados, ejercicios_completados, es_dia_descanso, dolor_promedio)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          ejercicios_esperados = VALUES(ejercicios_esperados),
          ejercicios_completados = VALUES(ejercicios_completados),
          es_dia_descanso = VALUES(es_dia_descanso),
          dolor_promedio = VALUES(dolor_promedio)`,
        [
          target,
          grupo.paciente,
          grupo.plan,
          ejerciciosEsperados,
          ejerciciosCompletados,
          esDiaDescanso ? 1 : 0,
          dolorPromedio,
        ]
      );

      filasInsertadas += result.affectedRows;
    }

    console.log(
      `[cumplimiento] ${target} (${diaSemana}): ${filasInsertadas} fila(s) insertadas/actualizadas`
    );
    return filasInsertadas;
  } catch (error) {
    console.error("[cumplimiento] Error calculando cumplimiento diario:", error);
    throw error;
  }
}

/**
 * Backfill retroactivo: rellena cumplimiento_diario para un rango de fechas.
 */
export async function backfillCumplimiento(
  desde: string,
  hasta?: string,
  pacienteId?: string
): Promise<{ diasProcesados: number; filasInsertadas: number }> {
  const fechaHasta = hasta || getAyerMadrid();
  const current = new Date(desde + "T12:00:00");
  const end = new Date(fechaHasta + "T12:00:00");
  let diasProcesados = 0;
  let filasInsertadas = 0;

  while (current <= end) {
    const fechaStr = current.toISOString().split("T")[0];
    const filas = await calcularCumplimientoDiario(fechaStr, pacienteId);
    filasInsertadas += filas;
    diasProcesados++;
    current.setDate(current.getDate() + 1);
  }

  console.log(
    `[backfill] ${diasProcesados} días procesados, ${filasInsertadas} filas insertadas/actualizadas`
  );
  return { diasProcesados, filasInsertadas };
}

/**
 * Limpiar y recalcular: borra filas del rango y las recalcula.
 */
export async function recalcularCumplimiento(
  desde: string,
  hasta?: string,
  pacienteId?: string
): Promise<{
  eliminadas: number;
  diasProcesados: number;
  filasInsertadas: number;
}> {
  const fechaHasta = hasta || getAyerMadrid();

  let deleteQuery = `DELETE FROM cumplimiento_diario WHERE fecha BETWEEN ? AND ?`;
  const deleteParams: string[] = [desde, fechaHasta];

  if (pacienteId) {
    deleteQuery += ` AND paciente = ?`;
    deleteParams.push(pacienteId);
  }

  const [deleteResult] = await pool.execute<ResultSetHeader>(
    deleteQuery,
    deleteParams
  );
  const eliminadas = deleteResult.affectedRows;

  const { diasProcesados, filasInsertadas } = await backfillCumplimiento(
    desde,
    fechaHasta,
    pacienteId
  );

  console.log(
    `[recalcular] ${eliminadas} eliminadas, ${filasInsertadas} insertadas`
  );
  return { eliminadas, diasProcesados, filasInsertadas };
}
