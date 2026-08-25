/**
 * Reparación: reconstruir los `assignments` que borró el wipe del 2026-08-07.
 *
 * Contexto: `bulkAssign` borraba TODAS las asignaciones de la clínica antes de
 * reinsertar, mientras la pantalla de asignación solo envía el diff editado
 * (corregido en `899d3109`). El 2026-08-07 eso dejó a los pacientes de MYO
 * ACTIVE y Kengo sin fisio responsable: no pueden abrir chat, porque
 * `startConversationWithFisio` resuelve el responsable contra esta tabla y
 * devuelve `null` si no hay fila.
 *
 * Heurística de reconstrucción: el responsable de un paciente es el `fisioId`
 * de su plan más reciente en esa clínica. Se recorren los planes de más nuevo a
 * más viejo y se toma el primero cuyo autor SIGA siendo fisio o admin de la
 * clínica — así un plan firmado por alguien que ya se fue no bloquea la
 * reparación, simplemente se cae al plan anterior.
 *
 * Nunca sobrescribe: solo inserta para pacientes que hoy NO tienen asignación.
 *
 * Se ejecuta DESPUÉS de `mergeFisioAccounts`. Si se hiciera antes, los
 * pacientes cuyo último plan venía de la cuenta duplicada quedarían asignados a
 * la cuenta que se va a vaciar.
 *
 * Ejecución (desde la raíz; en self-hosted todo va contra producción):
 *   npx convex run migrations/repairAssignmentsFromPlans:report
 *   npx convex run migrations/repairAssignmentsFromPlans:dryRun
 *   npx convex run migrations/repairAssignmentsFromPlans:apply
 *
 * Acotar a una clínica: '{"clinicIds":["jx7..."]}'
 */

import { v } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

export const MIGRACION = 'repairAssignmentsFromPlans/2026-08';

type Propuesta = {
  pacienteId: Id<'users'>;
  paciente: string;
  clinicId: Id<'clinics'>;
  fisioId: Id<'users'>;
  fisio: string;
  planId: Id<'plans'>;
  planCreadoEn: number;
};

type SinPista = {
  pacienteId: Id<'users'>;
  paciente: string;
  clinicId: Id<'clinics'>;
  motivo: 'sin_planes' | 'sin_fisio_vigente';
};

type ClinicResult = {
  clinicId: Id<'clinics'>;
  clinica: string;
  pacientes: number;
  yaAsignados: number;
  propuestas: Propuesta[];
  sinPista: SinPista[];
  insertados: number;
};

const selfInternal = (
  internal.migrations as Record<string, Record<string, unknown>>
)['repairAssignmentsFromPlans'] as {
  repairClinic: FunctionReference<
    'mutation',
    'internal',
    { clinicId: Id<'clinics'>; apply: boolean },
    ClinicResult
  >;
  listClinics: FunctionReference<
    'query',
    'internal',
    Record<string, never>,
    Id<'clinics'>[]
  >;
};

/**
 * Núcleo compartido por `report` (solo lectura) y `repairClinic`. Devuelve el
 * plan de reparación de una clínica sin escribir nada.
 */
async function planForClinic(
  ctx: any,
  clinicId: Id<'clinics'>,
): Promise<Omit<ClinicResult, 'insertados'>> {
  const clinic = await ctx.db.get(clinicId);
  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId', (q: any) => q.eq('clinicId', clinicId))
    .collect();

  // Solo pacientes "de verdad". Un fisio o admin con `tambienEsPaciente` no
  // necesita responsable, y contarlo inflaba el recuento de la auditoría.
  const pacientes = memberships.filter((m: any) => m.puesto === 'paciente');
  const gestores = new Set(
    memberships
      .filter((m: any) => m.puesto === 'fisio' || m.puesto === 'admin')
      .map((m: any) => m.userId as string),
  );

  const propuestas: Propuesta[] = [];
  const sinPista: SinPista[] = [];
  let yaAsignados = 0;

  for (const m of pacientes) {
    const existing = await ctx.db
      .query('assignments')
      .withIndex('by_pacienteId_clinicId', (q: any) =>
        q.eq('pacienteId', m.userId).eq('clinicId', clinicId),
      )
      .unique();
    if (existing) {
      yaAsignados += 1;
      continue;
    }

    const paciente = await ctx.db.get(m.userId);
    const nombrePaciente =
      `${paciente?.firstName ?? '?'} ${paciente?.lastName ?? ''}`.trim();

    const planes = (
      await ctx.db
        .query('plans')
        .withIndex('by_pacienteId', (q: any) => q.eq('pacienteId', m.userId))
        .collect()
    )
      .filter((p: any) => p.clinicId === clinicId)
      .sort((a: any, b: any) => b._creationTime - a._creationTime);

    if (planes.length === 0) {
      sinPista.push({
        pacienteId: m.userId,
        paciente: nombrePaciente,
        clinicId,
        motivo: 'sin_planes',
      });
      continue;
    }

    // El primero cuyo autor sigue en plantilla y no es el propio paciente.
    const plan = planes.find(
      (p: any) => gestores.has(p.fisioId as string) && p.fisioId !== m.userId,
    );
    if (!plan) {
      sinPista.push({
        pacienteId: m.userId,
        paciente: nombrePaciente,
        clinicId,
        motivo: 'sin_fisio_vigente',
      });
      continue;
    }

    const fisio = await ctx.db.get(plan.fisioId);
    propuestas.push({
      pacienteId: m.userId,
      paciente: nombrePaciente,
      clinicId,
      fisioId: plan.fisioId,
      fisio: `${fisio?.firstName ?? '?'} ${fisio?.lastName ?? ''}`.trim(),
      planId: plan._id,
      planCreadoEn: plan._creationTime,
    });
  }

  return {
    clinicId,
    clinica: clinic?.nombre ?? '?',
    pacientes: pacientes.length,
    yaAsignados,
    propuestas,
    sinPista,
  };
}

export const listClinics = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<'clinics'>[]> =>
    (await ctx.db.query('clinics').collect()).map((c) => c._id),
});

/** Informe de solo lectura de una clínica. */
export const reportClinic = internalQuery({
  args: { clinicId: v.id('clinics') },
  handler: async (ctx, args) => planForClinic(ctx, args.clinicId),
});

export const repairClinic = internalMutation({
  args: { clinicId: v.id('clinics'), apply: v.boolean() },
  handler: async (ctx, args): Promise<ClinicResult> => {
    const plan = await planForClinic(ctx, args.clinicId);
    let insertados = 0;
    if (args.apply) {
      for (const p of plan.propuestas) {
        await ctx.db.insert('assignments', {
          pacienteId: p.pacienteId,
          fisioId: p.fisioId,
          clinicId: p.clinicId,
        });
        insertados += 1;
      }
    }
    return { ...plan, insertados };
  },
});

type Summary = {
  apply: boolean;
  clinicas: Array<{
    clinicId: Id<'clinics'>;
    clinica: string;
    pacientes: number;
    yaAsignados: number;
    aReparar: number;
    sinPista: number;
    insertados: number;
  }>;
  totales: {
    pacientes: number;
    yaAsignados: number;
    aReparar: number;
    sinPista: number;
    insertados: number;
  };
  detalleSinPista: SinPista[];
  muestraPropuestas: Propuesta[];
};

async function run(
  ctx: { runQuery: any; runMutation: any },
  apply: boolean,
  clinicIds?: Id<'clinics'>[],
): Promise<Summary> {
  const ids: Id<'clinics'>[] =
    clinicIds ?? (await ctx.runQuery(selfInternal.listClinics, {}));

  const clinicas: Summary['clinicas'] = [];
  const detalleSinPista: SinPista[] = [];
  const muestraPropuestas: Propuesta[] = [];
  const totales = {
    pacientes: 0,
    yaAsignados: 0,
    aReparar: 0,
    sinPista: 0,
    insertados: 0,
  };

  for (const clinicId of ids) {
    const r: ClinicResult = await ctx.runMutation(selfInternal.repairClinic, {
      clinicId,
      apply,
    });
    if (r.pacientes === 0) continue;
    clinicas.push({
      clinicId: r.clinicId,
      clinica: r.clinica,
      pacientes: r.pacientes,
      yaAsignados: r.yaAsignados,
      aReparar: r.propuestas.length,
      sinPista: r.sinPista.length,
      insertados: r.insertados,
    });
    totales.pacientes += r.pacientes;
    totales.yaAsignados += r.yaAsignados;
    totales.aReparar += r.propuestas.length;
    totales.sinPista += r.sinPista.length;
    totales.insertados += r.insertados;
    detalleSinPista.push(...r.sinPista);
    // Muestra acotada: el detalle completo se consulta con `reportClinic`.
    muestraPropuestas.push(...r.propuestas.slice(0, 5));
  }

  return { apply, clinicas, totales, detalleSinPista, muestraPropuestas };
}

export const report = internalAction({
  args: { clinicIds: v.optional(v.array(v.id('clinics'))) },
  handler: async (ctx, args): Promise<Summary> =>
    run(ctx, false, args.clinicIds),
});

export const dryRun = internalAction({
  args: { clinicIds: v.optional(v.array(v.id('clinics'))) },
  handler: async (ctx, args): Promise<Summary> =>
    run(ctx, false, args.clinicIds),
});

export const apply = internalAction({
  args: { clinicIds: v.optional(v.array(v.id('clinics'))) },
  handler: async (ctx, args): Promise<Summary> =>
    run(ctx, true, args.clinicIds),
});
