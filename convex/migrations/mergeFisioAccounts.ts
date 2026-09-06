/**
 * Migración: fusión de DOS CUENTAS REALES de un mismo fisio en una sola.
 *
 * Caso que la motiva: Guillermo Gallardo trabajaba con `guillegp17@gmail.com` y
 * `guillegp17+test@gmail.com`, ambas con membresía de fisio en la MISMA clínica
 * (MYO ACTIVE). El trabajo quedaba partido en dos: pacientes asignados a una u
 * otra, planes creados desde ambas y —lo más visible— pacientes con dos hilos
 * de chat abiertos, uno por cuenta.
 *
 * Diferencias con `dedupeUsersFromPendingMerge` (que NO sirve aquí):
 *  - allí el origen era un `users` fantasma (`externalId = pending-<email>`);
 *    aquí las dos cuentas son reales, con contraseña y sesiones en Better-Auth;
 *  - allí solo colisionaba el lado `pacienteId` de `conversations`; aquí
 *    colisiona el lado `fisioId` (dos fisios ⇒ dos hilos con el mismo paciente
 *    en la misma clínica) y hay que fusionar mensajes y recalcular contadores;
 *  - allí las escrituras iban sin triggers de aggregate; aquí se importa
 *    `internalMutation` de `_helpers/mutationWithTriggers` (obligatorio al
 *    tocar `plans`, `sessions` y `exerciseExecutions`).
 *
 * NO toca Better-Auth: por decisión de producto la cuenta origen sigue
 * existiendo, solo queda vacía (sin membresías ni datos asociados).
 *
 * Ejecución (siempre desde la raíz del proyecto; en self-hosted NO existe
 * `--prod`: todo va contra producción):
 *
 *   0) npx convex export --path ./backups/kengo-prod-pre-merge-<fecha>.zip
 *   1) npx convex run migrations/mergeFisioAccounts:report \
 *        '{"sourceUserId":"...","targetUserId":"..."}'
 *   2) npx convex run migrations/mergeFisioAccounts:dryRun '{...}'
 *   3) npx convex run migrations/mergeFisioAccounts:apply  '{...}'
 *   4) npx convex run migrations/mergeFisioAccounts:report '{...}'  → todo a 0
 */

import { v } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import { internalAction, internalQuery } from '../_generated/server';
// OBLIGATORIO: esta migración escribe en `plans`, `sessions` y
// `exerciseExecutions`; sin este wrapper los aggregates quedan desincronizados
// (ver `_helpers/mutationWithTriggers.ts`). El aggregate crítico aquí es
// `executionsByPacienteDolor`, cuyo namespace es [pacienteId, clinicId].
import { internalMutation } from '../_helpers/mutationWithTriggers';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { assertOwnerIsAdmin } from '../_helpers/permissions';
import { nombreCompleto } from '../billing/internal';

export const MIGRACION = 'mergeFisioAccounts/2026-08';

const PUESTO_RANK: Record<'admin' | 'fisio' | 'paciente', number> = {
  admin: 3,
  fisio: 2,
  paciente: 1,
};

/** Tope de `lastMessageText`, igual que en `conversations.sendMessage`. */
const LAST_MESSAGE_MAX = 200;

const DEFAULT_BATCH = 200;

/**
 * Tablas con una referencia simple a `users` que se re-apunta sin lógica de
 * colisión. `clinicMemberships`, `clinics`, `assignments.pacienteId` y
 * `conversations` NO están aquí: tienen unicidad lógica y se tratan aparte.
 *
 * `index` es el índice cuyo PRIMER campo es `field`; sin él se escanea la
 * tabla entera paginando (aceptable en una migración one-off).
 */
const REPOINT_SPECS: ReadonlyArray<{
  table: string;
  field: string;
  index?: string;
}> = [
  { table: 'assignments', field: 'fisioId', index: 'by_fisioId_clinicId' },
  { table: 'plans', field: 'fisioId', index: 'by_fisioId' },
  { table: 'plans', field: 'pacienteId', index: 'by_pacienteId' },
  { table: 'sessions', field: 'pacienteId', index: 'by_pacienteId' },
  {
    table: 'exerciseExecutions',
    field: 'pacienteId',
    index: 'by_pacienteId_fecha',
  },
  {
    table: 'dailyPatientRollup',
    field: 'pacienteId',
    index: 'by_pacienteId_fecha',
  },
  {
    table: 'weeklyPatientRollup',
    field: 'pacienteId',
    index: 'by_pacienteId_anioSemana',
  },
  {
    table: 'monthlyPatientRollup',
    field: 'pacienteId',
    index: 'by_pacienteId_anioMes',
  },
  {
    table: 'patientMetricsSnapshot',
    field: 'pacienteId',
    index: 'by_pacienteId_ventana',
  },
  {
    table: 'patientMetricsSnapshot',
    field: 'fisioId',
    index: 'by_fisioId_ventana_adherencia',
  },
  { table: 'physioAlerts', field: 'pacienteId', index: 'by_pacienteId_estado' },
  { table: 'physioAlerts', field: 'revisadaPor' },
  { table: 'messages', field: 'senderId' },
  { table: 'routines', field: 'autorId', index: 'by_autorId' },
  { table: 'accessCodes', field: 'creadoPor' },
  { table: 'accessTokens', field: 'userId', index: 'by_userId' },
  { table: 'accessTokens', field: 'creadoPor' },
  { table: 'pushTokens', field: 'userId', index: 'by_userId' },
  {
    table: 'notificationPreferences',
    field: 'userId',
    index: 'by_userId',
  },
  { table: 'verificationCodes', field: 'userId', index: 'by_userId' },
  { table: 'consents', field: 'userId', index: 'by_userId' },
  { table: 'exerciseFavorites', field: 'userId', index: 'by_userId' },
];

/**
 * Bitácoras: se INFORMAN pero NO se re-apuntan. Son registros históricos de
 * "qué pasó y quién lo hizo"; reescribirlos falsearía el histórico, y como la
 * cuenta origen no se borra, sus referencias siguen resolviendo.
 *
 * `clinicOwnershipAudit.fromUserId` además DEBE quedarse: el traspaso de
 * propiedad que hace esta misma migración inserta una fila con
 * `fromUserId = origen`; re-apuntarla la dejaría con `from === to`.
 */
const AUDIT_SPECS: ReadonlyArray<{
  table: string;
  field: string;
  index?: string;
}> = [
  { table: 'clinicOwnershipAudit', field: 'fromUserId' },
  { table: 'clinicOwnershipAudit', field: 'toUserId', index: 'by_toUserId' },
  { table: 'dataRepairAudit', field: 'pacienteId' },
  { table: 'pushSendLog', field: 'userId', index: 'by_userId' },
];

type StepResult = {
  label: string;
  processed: number;
  actions: string[];
  cursor: string | null;
  done: boolean;
};

// `_generated/api.d.ts` no conoce este módulo hasta el próximo deploy (y
// `npx convex codegen` suelto hace push a producción). El proxy runtime de
// `internal` sí lo resuelve; este alias tipado evita el error de tipos.
type MergeArgs = {
  sourceUserId: Id<'users'>;
  targetUserId: Id<'users'>;
  apply: boolean;
};
const selfInternal = (
  internal.migrations as Record<string, Record<string, unknown>>
)['mergeFisioAccounts'] as {
  mergeMembershipsAndOwnership: FunctionReference<
    'mutation',
    'internal',
    MergeArgs,
    { clinicIds: Id<'clinics'>[]; actions: string[] }
  >;
  mergeConversations: FunctionReference<
    'mutation',
    'internal',
    MergeArgs,
    StepResult
  >;
  mergeAssignmentsAsPaciente: FunctionReference<
    'mutation',
    'internal',
    MergeArgs,
    StepResult
  >;
  repointSpec: FunctionReference<
    'mutation',
    'internal',
    MergeArgs & {
      specIndex: number;
      cursor: string | null;
      batchSize?: number;
    },
    StepResult
  >;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Informe (solo lectura)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inventario de todo lo que apunta a la cuenta origen. Es un `internalQuery`:
 * no puede escribir aunque se invoque por error. Sirve de antes/después.
 */
export const report = internalQuery({
  args: {
    sourceUserId: v.id('users'),
    targetUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceUserId);
    const target = await ctx.db.get(args.targetUserId);

    const referencias: Record<string, number> = {};
    const bitacoras: Record<string, number> = {};
    for (const spec of [...REPOINT_SPECS, ...AUDIT_SPECS]) {
      const key = `${spec.table}.${spec.field}`;
      const destino = REPOINT_SPECS.includes(spec) ? referencias : bitacoras;
      const rows = spec.index
        ? await (ctx.db.query(spec.table as never) as any)
            .withIndex(spec.index, (q: any) =>
              q.eq(spec.field, args.sourceUserId),
            )
            .collect()
        : await (ctx.db.query(spec.table as never) as any)
            .filter((q: any) => q.eq(q.field(spec.field), args.sourceUserId))
            .collect();
      if (rows.length > 0) destino[key] = rows.length;
    }

    // Membresías y colisión de puesto.
    const sourceMemberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_userId', (q) => q.eq('userId', args.sourceUserId))
      .collect();
    const membresias = [];
    for (const m of sourceMemberships) {
      const clinic = await ctx.db.get(m.clinicId);
      const collision = await ctx.db
        .query('clinicMemberships')
        .withIndex('by_userId_clinicId', (q) =>
          q.eq('userId', args.targetUserId).eq('clinicId', m.clinicId),
        )
        .unique();
      membresias.push({
        clinicId: m.clinicId,
        clinica: clinic?.nombre ?? '?',
        puestoOrigen: m.puesto,
        puestoDestino: collision?.puesto ?? null,
        colisiona: collision !== null,
        esOwnerElOrigen: clinic?.ownerUserId === args.sourceUserId,
      });
    }

    // Conversaciones: colisión en la terna (pacienteId, fisioId, clinicId).
    const convsAsFisio = await ctx.db
      .query('conversations')
      .withIndex('by_fisioId_lastMessageAt', (q) =>
        q.eq('fisioId', args.sourceUserId),
      )
      .collect();
    const convsAsPaciente = await ctx.db
      .query('conversations')
      .withIndex('by_pacienteId_lastMessageAt', (q) =>
        q.eq('pacienteId', args.sourceUserId),
      )
      .collect();

    const conversacionesColisionantes = [];
    for (const c of convsAsFisio) {
      const collision = await ctx.db
        .query('conversations')
        .withIndex('by_paciente_fisio_clinic', (q) =>
          q
            .eq('pacienteId', c.pacienteId)
            .eq('fisioId', args.targetUserId)
            .eq('clinicId', c.clinicId),
        )
        .unique();
      if (!collision) continue;
      const paciente = await ctx.db.get(c.pacienteId);
      const msgsOrigen = await ctx.db
        .query('messages')
        .withIndex('by_conversationId', (q) => q.eq('conversationId', c._id))
        .collect();
      const msgsDestino = await ctx.db
        .query('messages')
        .withIndex('by_conversationId', (q) =>
          q.eq('conversationId', collision._id),
        )
        .collect();
      conversacionesColisionantes.push({
        paciente:
          `${paciente?.firstName ?? '?'} ${paciente?.lastName ?? ''}`.trim(),
        clinicId: c.clinicId,
        hiloOrigen: c._id,
        mensajesOrigen: msgsOrigen.length,
        hiloDestino: collision._id,
        mensajesDestino: msgsDestino.length,
      });
    }

    // Facturación de las clínicas implicadas.
    const facturacion = [];
    for (const m of sourceMemberships) {
      const billing = await ctx.db
        .query('clinicBilling')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', m.clinicId))
        .unique();
      const fisios = (
        await ctx.db
          .query('clinicMemberships')
          .withIndex('by_clinicId', (q) => q.eq('clinicId', m.clinicId))
          .collect()
      ).filter((x) => x.puesto === 'fisio' || x.puesto === 'admin').length;
      facturacion.push({
        clinicId: m.clinicId,
        cantidadFisiosFacturada: billing?.cantidadFisios ?? null,
        fisiosReales: fisios,
        estadoLocal: billing?.estadoLocal ?? null,
      });
    }

    return {
      origen: source && {
        _id: source._id,
        email: source.email,
        externalId: source.externalId,
        nombre: `${source.firstName} ${source.lastName ?? ''}`.trim(),
      },
      destino: target && {
        _id: target._id,
        email: target.email,
        externalId: target.externalId,
        nombre: `${target.firstName} ${target.lastName ?? ''}`.trim(),
      },
      referencias,
      totalReferencias: Object.values(referencias).reduce((a, b) => a + b, 0),
      // Se dejan tal cual a propósito (ver AUDIT_SPECS).
      bitacorasNoMigradas: bitacoras,
      membresias,
      conversaciones: {
        comoFisio: convsAsFisio.length,
        comoPaciente: convsAsPaciente.length,
        colisionantes: conversacionesColisionantes,
      },
      facturacion,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Membresías + propiedad de clínica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Funde las membresías del origen en el destino (puesto más alto gana) y
 * traspasa `ownerUserId` / `createdBy` de las clínicas que eran del origen.
 *
 * Se ejecuta ANTES que nada: `assertOwnerIsAdmin` exige que el nuevo owner ya
 * sea admin, y la fusión de puestos es justo lo que lo garantiza.
 */
export const mergeMembershipsAndOwnership = internalMutation({
  args: {
    sourceUserId: v.id('users'),
    targetUserId: v.id('users'),
    apply: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actions: string[] = [];
    const clinicIds: Id<'clinics'>[] = [];

    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_userId', (q) => q.eq('userId', args.sourceUserId))
      .collect();

    for (const m of memberships) {
      clinicIds.push(m.clinicId);
      const collision = await ctx.db
        .query('clinicMemberships')
        .withIndex('by_userId_clinicId', (q) =>
          q.eq('userId', args.targetUserId).eq('clinicId', m.clinicId),
        )
        .unique();

      if (collision) {
        const puesto =
          PUESTO_RANK[m.puesto] > PUESTO_RANK[collision.puesto]
            ? m.puesto
            : collision.puesto;
        const tambienEsPaciente =
          m.tambienEsPaciente === true || collision.tambienEsPaciente === true
            ? true
            : undefined;
        actions.push(
          `clinicMemberships: fusionar clinic=${m.clinicId} ` +
            `(${m.puesto} + ${collision.puesto}) → ${puesto}`,
        );
        if (args.apply) {
          await ctx.db.patch(collision._id, {
            puesto,
            ...(tambienEsPaciente !== undefined && { tambienEsPaciente }),
          });
          await ctx.db.delete(m._id);
        }
      } else {
        actions.push(
          `clinicMemberships: re-apuntar clinic=${m.clinicId} (${m.puesto})`,
        );
        if (args.apply) {
          await ctx.db.patch(m._id, { userId: args.targetUserId });
        }
      }
    }

    // Propiedad de clínica. `ownerUserId` tiene índice; `createdBy` no, pero la
    // tabla es diminuta.
    const owned = await ctx.db
      .query('clinics')
      .withIndex('by_ownerUserId', (q) =>
        q.eq('ownerUserId', args.sourceUserId),
      )
      .collect();
    const sourceUser = owned.length > 0 ? await ctx.db.get(args.sourceUserId) : null;
    for (const clinic of owned) {
      actions.push(`clinics.ownerUserId: traspasar ${clinic.nombre}`);
      if (args.apply) {
        await assertOwnerIsAdmin(ctx, clinic._id, args.targetUserId);
        await ctx.db.patch(clinic._id, { ownerUserId: args.targetUserId });
        await ctx.db.insert('clinicOwnershipAudit', {
          clinicId: clinic._id,
          fromUserId: args.sourceUserId,
          toUserId: args.targetUserId,
          via: 'support',
          reason: `Fusión de cuentas duplicadas del mismo fisio (${MIGRACION})`,
          createdAt: Date.now(),
        });
        // El customer de Stripe lleva el email/nombre del owner saliente.
        await ctx.scheduler.runAfter(
          0,
          internal.billing.actions.syncCustomerOwner,
          {
            clinicId: clinic._id,
            ownerAnteriorNombre: sourceUser
              ? nombreCompleto(sourceUser)
              : undefined,
          },
        );
      }
    }

    const created = await ctx.db
      .query('clinics')
      .filter((q) => q.eq(q.field('createdBy'), args.sourceUserId))
      .collect();
    for (const clinic of created) {
      actions.push(`clinics.createdBy: re-apuntar ${clinic.nombre}`);
      if (args.apply) {
        await ctx.db.patch(clinic._id, { createdBy: args.targetUserId });
      }
    }

    return { clinicIds, actions };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Conversaciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalcula los campos desnormalizados de un hilo a partir de sus mensajes.
 * Imprescindible tras fusionar: el badge de la app se deriva de
 * `pacienteUnreadCount` + `fisioUnreadCount` (`conversations/helpers.ts`).
 */
async function recomputeConversation(
  ctx: any,
  conversationId: Id<'conversations'>,
  lastMessageAtAbsorbido?: number,
): Promise<void> {
  const conv = await ctx.db.get(conversationId);
  if (!conv) return;
  const msgs = await ctx.db
    .query('messages')
    .withIndex('by_conversationId', (q: any) =>
      q.eq('conversationId', conversationId),
    )
    .collect();

  if (msgs.length === 0) {
    await ctx.db.patch(conversationId, {
      pacienteUnreadCount: 0,
      fisioUnreadCount: 0,
    });
    return;
  }

  // `by_conversationId` ordena por `_creationTime`: el último es el más nuevo.
  const last = msgs[msgs.length - 1];
  // `lastMessageAt` se escribe con `Date.now()` en `sendMessage`, así que va
  // en paralelo a `_creationTime`. Al fusionar tomamos el máximo de los tres
  // candidatos para no dejar el texto del mensaje nuevo con la fecha del viejo.
  const lastAt = Math.max(
    conv.lastMessageAt ?? 0,
    lastMessageAtAbsorbido ?? 0,
    last._creationTime,
  );
  await ctx.db.patch(conversationId, {
    lastMessageText: last.text.slice(0, LAST_MESSAGE_MAX),
    lastMessageAt: lastAt,
    lastMessageSenderId: last.senderId,
    pacienteUnreadCount: msgs.filter(
      (m: any) => m.senderId === conv.fisioId && m.readAt === undefined,
    ).length,
    fisioUnreadCount: msgs.filter(
      (m: any) => m.senderId === conv.pacienteId && m.readAt === undefined,
    ).length,
  });
}

/**
 * Re-apunta los hilos del origen al destino. Cuando la terna
 * (pacienteId, fisioId, clinicId) ya existe en el destino, se conserva el hilo
 * del destino y se le trasladan los mensajes del origen: `by_conversationId`
 * ordena por `_creationTime`, que el patch no altera, así que el historial
 * queda intercalado cronológicamente sin más trabajo.
 */
export const mergeConversations = internalMutation({
  args: {
    sourceUserId: v.id('users'),
    targetUserId: v.id('users'),
    apply: v.boolean(),
  },
  handler: async (ctx, args): Promise<StepResult> => {
    const actions: string[] = [];
    let processed = 0;
    // Solo los hilos que ABSORBEN mensajes necesitan recálculo: los que
    // únicamente cambian de `fisioId` conservan un caché ya válido, y
    // recalcularlos ampliaría el radio de la migración sin motivo.
    const aRecalcular = new Map<Id<'conversations'>, number>();

    const asFisio = await ctx.db
      .query('conversations')
      .withIndex('by_fisioId_lastMessageAt', (q) =>
        q.eq('fisioId', args.sourceUserId),
      )
      .collect();
    const asPaciente = await ctx.db
      .query('conversations')
      .withIndex('by_pacienteId_lastMessageAt', (q) =>
        q.eq('pacienteId', args.sourceUserId),
      )
      .collect();

    for (const c of [...asFisio, ...asPaciente]) {
      const esFisio = c.fisioId === args.sourceUserId;
      const pacienteId = esFisio ? c.pacienteId : args.targetUserId;
      const fisioId = esFisio ? args.targetUserId : c.fisioId;

      // Un hilo del origen consigo mismo (fisio y paciente a la vez) no tiene
      // sentido tras la fusión: sería el destino hablando consigo mismo.
      if (pacienteId === fisioId) {
        actions.push(
          `conversations: hilo degenerado ${c._id} — REVISAR A MANO`,
        );
        continue;
      }

      const collision = await ctx.db
        .query('conversations')
        .withIndex('by_paciente_fisio_clinic', (q) =>
          q
            .eq('pacienteId', pacienteId)
            .eq('fisioId', fisioId)
            .eq('clinicId', c.clinicId),
        )
        .unique();

      const msgs = await ctx.db
        .query('messages')
        .withIndex('by_conversationId', (q) => q.eq('conversationId', c._id))
        .collect();

      if (collision) {
        actions.push(
          `conversations: fusionar ${c._id} (${msgs.length} msgs) → ` +
            `${collision._id} clinic=${c.clinicId}`,
        );
        if (args.apply) {
          for (const m of msgs) {
            await ctx.db.patch(m._id, {
              conversationId: collision._id,
              ...(m.senderId === args.sourceUserId && {
                senderId: args.targetUserId,
              }),
            });
          }
          await ctx.db.delete(c._id);
          aRecalcular.set(
            collision._id,
            Math.max(aRecalcular.get(collision._id) ?? 0, c.lastMessageAt ?? 0),
          );
        }
      } else {
        actions.push(
          `conversations: re-apuntar ${c._id} ` +
            `(${esFisio ? 'fisioId' : 'pacienteId'}) clinic=${c.clinicId}`,
        );
        if (args.apply) {
          await ctx.db.patch(c._id, {
            ...(esFisio
              ? { fisioId: args.targetUserId }
              : { pacienteId: args.targetUserId }),
            ...(c.lastMessageSenderId === args.sourceUserId && {
              lastMessageSenderId: args.targetUserId,
            }),
          });
        }
      }
      processed += 1;
    }

    for (const [id, lastAtAbsorbido] of aRecalcular) {
      await recomputeConversation(ctx, id, lastAtAbsorbido);
    }

    return {
      label: 'conversations',
      processed,
      actions,
      cursor: null,
      done: true,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Asignaciones donde el origen figura como PACIENTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `assignments` es única por (pacienteId, clinicId). Si el destino ya tiene
 * asignación en esa clínica, la del origen sobra: la vigente es la del destino.
 */
export const mergeAssignmentsAsPaciente = internalMutation({
  args: {
    sourceUserId: v.id('users'),
    targetUserId: v.id('users'),
    apply: v.boolean(),
  },
  handler: async (ctx, args): Promise<StepResult> => {
    const actions: string[] = [];
    let processed = 0;

    const rows = await ctx.db
      .query('assignments')
      .withIndex('by_pacienteId_clinicId', (q) =>
        q.eq('pacienteId', args.sourceUserId),
      )
      .collect();

    for (const a of rows) {
      const collision = await ctx.db
        .query('assignments')
        .withIndex('by_pacienteId_clinicId', (q) =>
          q.eq('pacienteId', args.targetUserId).eq('clinicId', a.clinicId),
        )
        .unique();
      if (collision) {
        actions.push(`assignments: descartar duplicada clinic=${a.clinicId}`);
        if (args.apply) await ctx.db.delete(a._id);
      } else {
        actions.push(`assignments: re-apuntar pacienteId clinic=${a.clinicId}`);
        if (args.apply) {
          await ctx.db.patch(a._id, { pacienteId: args.targetUserId });
        }
      }
      processed += 1;
    }

    return {
      label: 'assignments.pacienteId',
      processed,
      actions,
      cursor: null,
      done: true,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Re-apuntado genérico, tabla a tabla y por lotes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa UN lote de UNA entrada de `REPOINT_SPECS`. El bucle vive en el
 * action, para no acercarse a los límites de lectura/escritura por mutación
 * (un `mergePair` monolítico escanearía ~8.300 documentos).
 *
 * Con índice: se toman los `batchSize` primeros pendientes y se re-apuntan; al
 * hacerlo salen del rango del índice, así que la siguiente llamada vuelve a
 * empezar y el bucle termina cuando no queda ninguno. Sin índice: se pagina la
 * tabla entera con cursor y se filtra en memoria.
 */
export const repointSpec = internalMutation({
  args: {
    sourceUserId: v.id('users'),
    targetUserId: v.id('users'),
    apply: v.boolean(),
    specIndex: v.number(),
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<StepResult> => {
    const spec = REPOINT_SPECS[args.specIndex];
    if (!spec) throw new Error(`specIndex fuera de rango: ${args.specIndex}`);

    const label = `${spec.table}.${spec.field}`;
    const batchSize = args.batchSize ?? DEFAULT_BATCH;
    const actions: string[] = [];

    if (spec.index) {
      const query = (ctx.db.query(spec.table as never) as any).withIndex(
        spec.index,
        (q: any) => q.eq(spec.field, args.sourceUserId),
      );
      // En dry-run nada sale del índice: se cuenta de una vez y se termina.
      const rows = args.apply
        ? await query.take(batchSize)
        : await query.collect();
      for (const row of rows) {
        if (args.apply) {
          await ctx.db.patch(row._id, { [spec.field]: args.targetUserId });
        }
      }
      if (rows.length > 0) actions.push(`${label}: ${rows.length}`);
      return {
        label,
        processed: rows.length,
        actions,
        cursor: null,
        done: !args.apply || rows.length < batchSize,
      };
    }

    const { page, isDone, continueCursor } = await (
      ctx.db.query(spec.table as never) as any
    ).paginate({ cursor: args.cursor, numItems: batchSize });

    let processed = 0;
    for (const row of page) {
      if ((row as any)[spec.field] !== args.sourceUserId) continue;
      processed += 1;
      if (args.apply) {
        await ctx.db.patch(row._id, { [spec.field]: args.targetUserId });
      }
    }
    if (processed > 0) actions.push(`${label}: ${processed}`);

    return {
      label,
      processed,
      actions,
      cursor: continueCursor,
      done: isDone,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Orquestación
// ─────────────────────────────────────────────────────────────────────────────

type MergeSummary = {
  apply: boolean;
  sourceUserId: Id<'users'>;
  targetUserId: Id<'users'>;
  totalProcessed: number;
  porTabla: Record<string, number>;
  actions: string[];
  clinicasResincronizadas: Id<'clinics'>[];
};

async function runMerge(
  ctx: { runMutation: any },
  args: MergeArgs,
): Promise<MergeSummary> {
  if (args.sourceUserId === args.targetUserId) {
    throw new Error('sourceUserId y targetUserId son el mismo usuario');
  }

  const actions: string[] = [];
  const porTabla: Record<string, number> = {};
  let totalProcessed = 0;

  const bump = (step: StepResult) => {
    actions.push(...step.actions);
    if (step.processed > 0) {
      porTabla[step.label] = (porTabla[step.label] ?? 0) + step.processed;
      totalProcessed += step.processed;
    }
  };

  // 1) Membresías y propiedad primero: dejan al destino como admin, que es lo
  //    que `assertOwnerIsAdmin` necesita para el traspaso de owner.
  const membership = await ctx.runMutation(
    selfInternal.mergeMembershipsAndOwnership,
    args,
  );
  actions.push(...membership.actions);

  // 2) Conversaciones (con fusión de hilos colisionantes).
  bump(await ctx.runMutation(selfInternal.mergeConversations, args));

  // 3) Asignaciones del lado paciente (unicidad por paciente+clínica).
  bump(await ctx.runMutation(selfInternal.mergeAssignmentsAsPaciente, args));

  // 4) Resto de tablas, por lotes.
  for (let specIndex = 0; specIndex < REPOINT_SPECS.length; specIndex++) {
    let cursor: string | null = null;
    for (;;) {
      const step: StepResult = await ctx.runMutation(selfInternal.repointSpec, {
        ...args,
        specIndex,
        cursor,
      });
      bump(step);
      if (step.done) break;
      cursor = step.cursor;
    }
  }

  // 5) Facturación: al fundir dos membresías de fisio la clínica pierde una
  //    plaza; `syncQuantityFromMemberships` recalcula y encola el ajuste de
  //    quantity en Stripe con prorrateo.
  const clinicasResincronizadas: Id<'clinics'>[] = [];
  if (args.apply) {
    for (const clinicId of membership.clinicIds) {
      await ctx.runMutation(
        internal.billing.internal.syncQuantityFromMemberships,
        { clinicId },
      );
      clinicasResincronizadas.push(clinicId);
    }
  }

  return {
    apply: args.apply,
    sourceUserId: args.sourceUserId,
    targetUserId: args.targetUserId,
    totalProcessed,
    porTabla,
    actions,
    clinicasResincronizadas,
  };
}

export const dryRun = internalAction({
  args: { sourceUserId: v.id('users'), targetUserId: v.id('users') },
  handler: async (ctx, args): Promise<MergeSummary> =>
    runMerge(ctx, { ...args, apply: false }),
});

export const apply = internalAction({
  args: { sourceUserId: v.id('users'), targetUserId: v.id('users') },
  handler: async (ctx, args): Promise<MergeSummary> =>
    runMerge(ctx, { ...args, apply: true }),
});
