import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

import usersData from "./data/directus_users.json";
import clinicsData from "./data/clinicas.json";
import membershipsData from "./data/usuarios_clinicas.json";
import codesData from "./data/codigos_acceso.json";
import assignmentsData from "./data/asignaciones_responsable.json";

export const seedPhase5 = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("=== SEED FASE 5: Usuarios, Clinicas, Membresias ===\n");

    // 1. Users
    console.log("--- Paso 1: Usuarios ---");
    const activeUsers = (usersData as any).directus_users
      .filter((u: any) => u.status === "active" && u.email)
      .map((u: any) => ({
        legacyDirectusId: u.id,
        email: u.email.toLowerCase().trim(),
        firstName: (u.first_name ?? "").trim(),
        lastName: (u.last_name ?? "").trim(),
        emailVerified: u.email_verified === 1,
        telefono:
          u.telefono && u.telefono.trim() ? u.telefono.trim() : undefined,
        direccion: u.direccion ?? undefined,
        postal: u.postal ?? undefined,
        numeroColegiado: u.numero_colegiado ?? undefined,
      }));

    console.log(`Usuarios activos: ${activeUsers.length}`);

    const BATCH_SIZE = 50;
    let totalCreated = 0,
      totalUpdated = 0,
      totalSkipped = 0;

    for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
      const batch = activeUsers.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(
        internal.seed.seedUsers.insertUsersBatch,
        { users: batch },
      );
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
    }
    console.log(
      `Usuarios: ${totalCreated} creados, ${totalUpdated} actualizados, ${totalSkipped} omitidos\n`,
    );

    // 2. Clinics
    console.log("--- Paso 2: Clinicas ---");
    const clinics = (clinicsData as any).clinicas.map((c: any) => ({
      legacyId: c.id_clinica,
      nombre: c.nombre,
      telefono: c.telefono ?? undefined,
      email: c.email ?? undefined,
      direccion: c.direccion ?? undefined,
      postal: c.postal ?? undefined,
      nif: c.nif ?? undefined,
      colorPrimario: c.color_primario ?? undefined,
      colorSecundario: c.color_secundario ?? undefined,
      creatorLegacyId: c.user_created ?? undefined,
    }));

    const clinicsResult = await ctx.runMutation(
      internal.seed.seedClinics.insertClinicsBatch,
      { clinics },
    );
    console.log(
      `Clinicas: ${clinicsResult.created} creadas, ${clinicsResult.skipped} omitidas\n`,
    );

    // 3. Memberships
    console.log("--- Paso 3: Membresias ---");
    const validMemberships = (membershipsData as any).usuarios_clinicas
      .filter((m: any) => m.id_usuario !== null && m.id_clinica !== null)
      .map((m: any) => ({
        userLegacyId: m.id_usuario,
        clinicLegacyId: m.id_clinica,
        puesto: m.id_puesto,
      }));

    console.log(`Membresias validas: ${validMemberships.length}`);
    const membershipsResult = await ctx.runMutation(
      internal.seed.seedClinicMemberships.insertMembershipsBatch,
      { memberships: validMemberships },
    );
    console.log(
      `Membresias: ${membershipsResult.created} creadas, ${membershipsResult.skipped} omitidas, ${membershipsResult.notFound} no resueltas\n`,
    );

    // 4. Access Codes
    console.log("--- Paso 4: Codigos de acceso ---");
    const codes = (codesData as any).codigos_acceso.map((c: any) => ({
      clinicLegacyId: c.id_clinica,
      codigo: c.codigo,
      tipo: c.tipo as "fisioterapeuta" | "paciente",
      activo: c.activo === 1,
      usosMaximos: c.usos_maximos ?? undefined,
      usosActuales: c.usos_actuales,
      fechaExpiracion: c.fecha_expiracion ?? undefined,
      email: c.email ?? undefined,
      creadorLegacyId: c.creado_por,
    }));

    const codesResult = await ctx.runMutation(
      internal.seed.seedAccessCodes.insertAccessCodesBatch,
      { codes },
    );
    console.log(
      `Codigos: ${codesResult.created} creados, ${codesResult.skipped} omitidos, ${codesResult.notFound} no resueltos\n`,
    );

    // 5. Assignments
    console.log("--- Paso 5: Asignaciones ---");
    const assignments = (
      assignmentsData as any
    ).asignaciones_responsable.map((a: any) => ({
      pacienteLegacyId: a.id_paciente,
      fisioLegacyId: a.id_fisio,
      clinicLegacyId: a.id_clinica,
    }));

    const assignmentsResult = await ctx.runMutation(
      internal.seed.seedAssignments.insertAssignmentsBatch,
      { assignments },
    );
    console.log(
      `Asignaciones: ${assignmentsResult.created} creadas, ${assignmentsResult.skipped} omitidas, ${assignmentsResult.notFound} no resueltas\n`,
    );

    console.log("=== SEED FASE 5 COMPLETADO ===");
  },
});
