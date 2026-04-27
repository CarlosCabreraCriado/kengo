import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { tieneGestion } from "../_helpers/permissions";

export const getPlanDataForPdf = internalQuery({
  args: { planId: v.id("plans"), requesterExternalId: v.string() },
  handler: async (ctx, args) => {
    const requester = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) =>
        q.eq("externalId", args.requesterExternalId),
      )
      .unique();
    if (!requester) throw new Error("Usuario no encontrado");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado");
    if (plan.fisioId !== requester._id) {
      throw new Error("No autorizado para acceder a este plan");
    }

    const planExercises = await ctx.db
      .query("planExercises")
      .withIndex("by_planId_sort", (q) => q.eq("planId", plan._id))
      .collect();

    const ejercicios = await Promise.all(
      planExercises.map(async (pe) => {
        const ex = await ctx.db.get(pe.exerciseId);
        return {
          id: pe._id as string,
          nombre: ex?.nombreEjercicio ?? "Ejercicio",
          portada: ex?.portada,
          series: pe.series,
          repeticiones: pe.repeticiones,
          duracionSeg: pe.duracionSeg,
          descansoSeg: pe.descansoSeg,
          diasSemana: pe.diasSemana ?? null,
          instruccionesPaciente: pe.instruccionesPaciente,
        };
      }),
    );

    const paciente = await ctx.db.get(plan.pacienteId);
    const fisio = await ctx.db.get(plan.fisioId);
    if (!paciente) throw new Error("Paciente no encontrado");
    if (!fisio) throw new Error("Fisio no encontrado");

    const memberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", fisio._id))
      .collect();
    const membershipFisio = memberships.find((m) => tieneGestion(m.puesto));
    if (!membershipFisio) throw new Error("Fisio sin clínica asignada");

    const clinica = await ctx.db.get(membershipFisio.clinicId);
    if (!clinica) throw new Error("Clínica no encontrada");

    return {
      requester: { _id: requester._id as string },
      plan: {
        id: plan._id as string,
        titulo: plan.titulo,
        descripcion: plan.descripcion,
        fechaInicio: plan.fechaInicio,
        fechaFin: plan.fechaFin,
      },
      ejercicios,
      clinica: {
        id: clinica._id as string,
        nombre: clinica.nombre,
        direccion: clinica.direccion,
        telefono: clinica.telefono,
        email: clinica.email,
        logo: clinica.logo,
        colorPrimario: clinica.colorPrimario,
        colorSecundario: clinica.colorSecundario,
      },
      paciente: {
        id: paciente._id as string,
        first_name: paciente.firstName,
        last_name: paciente.lastName,
        email: paciente.email,
      },
      fisio: {
        id: fisio._id as string,
        first_name: fisio.firstName,
        last_name: fisio.lastName,
        email: fisio.email,
        numero_colegiado: fisio.numeroColegiado,
      },
    };
  },
});

// El helper getOrCreateAccessTokenForPdf se movió a convex/accessTokens/mutations.ts
// como getOrCreateForUser. Úsalo desde allí.
