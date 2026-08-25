/**
 * Diagnóstico (solo lectura) del desfase entre `assignments` y `conversations`.
 *
 * Dos problemas históricos dejan rastro en producción:
 *
 *   1. **Hilos desviados.** `conversations.fisioId` se fija al crear el hilo y
 *      ningún flujo lo reencamina, así que tras reasignar el responsable el
 *      paciente seguía escribiendo (y la push seguía llegando) a la cuenta
 *      anterior. Se listan las conversaciones cuyo `fisioId` no coincide con
 *      el responsable actual del paciente en esa clínica.
 *
 *   2. **Pacientes sin responsable.** `bulkAssign` borraba todas las
 *      asignaciones de la clínica antes de reinsertar, mientras la pantalla de
 *      asignación solo enviaba el diff editado. Se listan los pacientes con
 *      membresía en una clínica y sin ninguna fila en `assignments` para ella:
 *      no pueden ni abrir chat (`startConversationWithFisio` devuelve `null`).
 *
 * Incluye además el recuento de `assignments` duplicados por
 * `(pacienteId, clinicId)`. La relación es 1:1 por diseño pero no hay índice
 * único que lo garantice, y varias lecturas usan `.unique()` (que **lanza** si
 * hay duplicados): conviene confirmar que sale a cero antes de desplegar.
 *
 * NO modifica nada. Es un `internalQuery`: no puede escribir aunque se
 * invoque por error.
 *
 * Cómo ejecutar (desde la raíz del proyecto):
 *   npx convex run migrations/auditAssignmentConversations:report
 *
 * Ojo: en el self-hosted el CLI opera directamente sobre producción; no existe
 * `--prod`.
 */

import { internalQuery } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

type HiloDesviado = {
  conversationId: Id<"conversations">;
  clinicId: Id<"clinics">;
  clinica: string;
  pacienteId: Id<"users">;
  paciente: string;
  fisioDelHilo: string;
  fisioDelHiloId: Id<"users">;
  responsableActual: string;
  responsableActualId: Id<"users">;
  mensajes: number;
  lastMessageAt: number | null;
};

type AssignmentDuplicado = {
  pacienteId: Id<"users">;
  clinicId: Id<"clinics">;
  veces: number;
  fisioIds: Id<"users">[];
};

type PacienteSinResponsable = {
  pacienteId: Id<"users">;
  paciente: string;
  clinicId: Id<"clinics">;
  clinica: string;
  puesto: string;
};

function nombre(
  u: { firstName?: string; lastName?: string; email?: string } | null,
): string {
  if (!u) return "(usuario borrado)";
  const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.email || "(sin nombre)";
}

export const report = internalQuery({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();
    const memberships = await ctx.db.query("clinicMemberships").collect();
    const assignments = await ctx.db.query("assignments").collect();

    // --- 0. Duplicados en `assignments` (rompen los `.unique()`) ---
    const porPacienteClinica = new Map<string, Id<"users">[]>();
    for (const a of assignments) {
      const key = `${a.pacienteId}:${a.clinicId}`;
      const previos = porPacienteClinica.get(key) ?? [];
      previos.push(a.fisioId);
      porPacienteClinica.set(key, previos);
    }
    const duplicados: AssignmentDuplicado[] = [];
    for (const [key, fisioIds] of porPacienteClinica) {
      if (fisioIds.length < 2) continue;
      const [pacienteId, clinicId] = key.split(":");
      duplicados.push({
        pacienteId: pacienteId as Id<"users">,
        clinicId: clinicId as Id<"clinics">,
        veces: fisioIds.length,
        fisioIds,
      });
    }

    // Cachés para no releer el mismo usuario/clínica una y otra vez.
    const usuarios = new Map<string, Doc<"users"> | null>();
    const getUsuario = async (id: Id<"users">) => {
      const cached = usuarios.get(id);
      if (cached !== undefined) return cached;
      const doc = await ctx.db.get(id);
      usuarios.set(id, doc);
      return doc;
    };
    const clinicas = new Map<string, Doc<"clinics"> | null>();
    const getClinica = async (id: Id<"clinics">) => {
      const cached = clinicas.get(id);
      if (cached !== undefined) return cached;
      const doc = await ctx.db.get(id);
      clinicas.set(id, doc);
      return doc;
    };
    const responsables = new Map<string, Id<"users"> | null>();
    const getResponsable = async (
      pacienteId: Id<"users">,
      clinicId: Id<"clinics">,
    ) => {
      const key = `${pacienteId}:${clinicId}`;
      const cached = responsables.get(key);
      if (cached !== undefined) return cached;
      const assignment = await ctx.db
        .query("assignments")
        .withIndex("by_pacienteId_clinicId", (q) =>
          q.eq("pacienteId", pacienteId).eq("clinicId", clinicId),
        )
        .first();
      const fisioId = assignment?.fisioId ?? null;
      responsables.set(key, fisioId);
      return fisioId;
    };

    // --- 1. Hilos cuyo fisio ya no es el responsable del paciente ---
    const hilosDesviados: HiloDesviado[] = [];
    let hilosSinResponsable = 0;

    for (const conv of conversations) {
      const responsableId = await getResponsable(conv.pacienteId, conv.clinicId);
      if (responsableId === null) {
        // El paciente no tiene responsable en esa clínica: sale en el bloque 2.
        hilosSinResponsable++;
        continue;
      }
      if (responsableId === conv.fisioId) continue;

      const mensajes = await ctx.db
        .query("messages")
        .withIndex("by_conversationId", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();

      const [paciente, fisioHilo, responsable, clinica] = await Promise.all([
        getUsuario(conv.pacienteId),
        getUsuario(conv.fisioId),
        getUsuario(responsableId),
        getClinica(conv.clinicId),
      ]);

      hilosDesviados.push({
        conversationId: conv._id,
        clinicId: conv.clinicId,
        clinica: clinica?.nombreComercial ?? clinica?.nombre ?? "(sin clínica)",
        pacienteId: conv.pacienteId,
        paciente: nombre(paciente),
        fisioDelHilo: nombre(fisioHilo),
        fisioDelHiloId: conv.fisioId,
        responsableActual: nombre(responsable),
        responsableActualId: responsableId,
        mensajes: mensajes.length,
        lastMessageAt: conv.lastMessageAt ?? null,
      });
    }

    // --- 2. Pacientes con membresía y sin responsable en esa clínica ---
    const pacientesSinResponsable: PacienteSinResponsable[] = [];

    for (const m of memberships) {
      const actuaComoPaciente =
        m.puesto === "paciente" || m.tambienEsPaciente === true;
      if (!actuaComoPaciente) continue;

      const responsableId = await getResponsable(m.userId, m.clinicId);
      if (responsableId !== null) continue;

      const [usuario, clinica] = await Promise.all([
        getUsuario(m.userId),
        getClinica(m.clinicId),
      ]);

      pacientesSinResponsable.push({
        pacienteId: m.userId,
        paciente: nombre(usuario),
        clinicId: m.clinicId,
        clinica: clinica?.nombreComercial ?? clinica?.nombre ?? "(sin clínica)",
        puesto: m.puesto,
      });
    }

    hilosDesviados.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

    return {
      resumen: {
        conversacionesTotales: conversations.length,
        assignmentsTotales: assignments.length,
        assignmentsDuplicados: duplicados.length,
        hilosDesviados: hilosDesviados.length,
        hilosDePacienteSinResponsable: hilosSinResponsable,
        pacientesSinResponsable: pacientesSinResponsable.length,
      },
      duplicados,
      hilosDesviados,
      pacientesSinResponsable,
    };
  },
});
