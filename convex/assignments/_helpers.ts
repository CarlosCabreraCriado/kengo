/**
 * Lógica pura del diff de asignaciones paciente→fisio responsable.
 *
 * Vive aparte de la mutation para poder testearla sin Convex (ver
 * `_helpers.test.ts`). El invariante que protege: **una asignación que no
 * aparece en el payload no se toca**. La versión anterior de `bulkAssign`
 * borraba todas las asignaciones de la clínica antes de reinsertar, mientras
 * que la pantalla `/mis-pacientes/asignacion` solo envía el diff de pacientes
 * editados — cambiar el responsable de un paciente dejaba sin responsable a
 * todos los demás de la clínica.
 */

/** Fila existente de `assignments`, reducida a lo que necesita el diff. */
export interface AssignmentRow {
  _id: string;
  pacienteId: string;
  fisioId: string;
}

/** Entrada del payload. `fisioId: null` significa "quitar la asignación". */
export interface AssignmentEntry {
  pacienteId: string;
  fisioId: string | null;
}

export type AssignmentOp =
  | { kind: "insert"; pacienteId: string; fisioId: string }
  | { kind: "patch"; assignmentId: string; fisioId: string }
  | { kind: "delete"; assignmentId: string };

export interface AssignmentDiff {
  ops: AssignmentOp[];
  /** Altas + cambios de responsable efectivos (los no-op no cuentan). */
  asignadas: number;
  /** Asignaciones retiradas. */
  eliminadas: number;
}

/**
 * Calcula las operaciones mínimas para llevar `existing` al estado que pide
 * `entries`. Si el payload repite un `pacienteId`, gana la última entrada.
 */
export function planAssignmentDiff(
  existing: readonly AssignmentRow[],
  entries: readonly AssignmentEntry[],
): AssignmentDiff {
  const actual = new Map<string, AssignmentRow>();
  for (const row of existing) actual.set(row.pacienteId, row);

  // Última entrada gana: evita emitir dos ops contradictorias para el mismo
  // paciente si el cliente manda el id repetido.
  const deseado = new Map<string, string | null>();
  for (const entry of entries) deseado.set(entry.pacienteId, entry.fisioId);

  const ops: AssignmentOp[] = [];
  let asignadas = 0;
  let eliminadas = 0;

  for (const [pacienteId, fisioId] of deseado) {
    const current = actual.get(pacienteId);

    if (fisioId === null) {
      if (current) {
        ops.push({ kind: "delete", assignmentId: current._id });
        eliminadas++;
      }
      continue;
    }

    if (!current) {
      ops.push({ kind: "insert", pacienteId, fisioId });
      asignadas++;
      continue;
    }

    if (current.fisioId !== fisioId) {
      ops.push({ kind: "patch", assignmentId: current._id, fisioId });
      asignadas++;
    }
  }

  return { ops, asignadas, eliminadas };
}
