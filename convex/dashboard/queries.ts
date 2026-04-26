import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  tieneGestion,
} from "../_helpers/permissions";
import { getUserClinicIds } from "../_helpers/authorization";

function fechaHaceDias(days: number): string {
  return new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];
}

function fechaHoy(): string {
  return new Date().toISOString().split("T")[0];
}

function fechaDentroDe(days: number): string {
  return new Date(Date.now() + days * 86400000)
    .toISOString()
    .split("T")[0];
}

async function getFisioIdsEnClinicasDelUsuario(
  ctx: any,
  userId: Id<"users">,
): Promise<Set<Id<"users">>> {
  const misMemberships = await ctx.db
    .query("clinicMemberships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  const clinicIdsGestion = misMemberships
    .filter((m: any) => tieneGestion(m.puesto))
    .map((m: any) => m.clinicId as Id<"clinics">);

  const fisioIds = new Set<Id<"users">>();
  for (const clinicId of clinicIdsGestion) {
    const members = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_clinicId", (q: any) => q.eq("clinicId", clinicId))
      .collect();
    for (const m of members) {
      if (tieneGestion(m.puesto)) {
        fisioIds.add(m.userId as Id<"users">);
      }
    }
  }

  return fisioIds;
}

export const fisioSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const fisioIds = await getFisioIdsEnClinicasDelUsuario(ctx, user._id);

    if (fisioIds.size === 0) {
      return {
        pacientes_activos: 0,
        adherencia_promedio: 0,
        planes_por_vencer: [] as Array<{
          id_plan: number | string;
          titulo: string;
          fecha_fin: string;
          paciente_nombre: string;
          paciente_id: string;
        }>,
      };
    }

    // 1+2. Pacientes activos y adherencia: leer de clinicMetrics (materializada
    // en el cron diario). Suma sobre las clínicas de gestión del usuario.
    const userClinicIds = await getUserClinicIds(ctx, user._id);
    const userMemberships = await ctx.db
      .query("clinicMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const clinicasGestion = userMemberships
      .filter((m) => tieneGestion(m.puesto))
      .map((m) => m.clinicId);

    const metricsByClinic = await Promise.all(
      clinicasGestion.map((cid) =>
        ctx.db
          .query("clinicMetrics")
          .withIndex("by_clinicId", (q) => q.eq("clinicId", cid))
          .unique(),
      ),
    );

    // Sumar pacientes_activos a través de clínicas (puede haber overlap, pero
    // el orden de magnitud es correcto). Adherencia: ponderada por pacientes.
    let pacientesActivos = 0;
    let weightedAdherencia = 0;
    let totalPacientesPonderados = 0;
    for (const m of metricsByClinic) {
      if (!m) continue;
      pacientesActivos += m.pacientesActivos;
      if (m.pacientesActivos > 0) {
        weightedAdherencia += m.adherenciaPromedio * m.pacientesActivos;
        totalPacientesPonderados += m.pacientesActivos;
      }
    }
    const adherenciaPromedio =
      totalPacientesPonderados > 0
        ? Math.round(weightedAdherencia / totalPacientesPonderados)
        : 0;
    void userClinicIds; // reservado para futuras mejoras multi-clínica

    // 3. Planes por vencer (estado activo, fechaFin entre hoy y +7 días) —
    // sigue siendo on-demand porque la ventana de 7 días es muy específica.
    const hoy = fechaHoy();
    const limite = fechaDentroDe(7);
    const planesPorVencer: Array<{
      id_plan: number | string;
      titulo: string;
      fecha_fin: string;
      paciente_nombre: string;
      paciente_id: string;
    }> = [];
    for (const fisioId of fisioIds) {
      const planes = await ctx.db
        .query("plans")
        .withIndex("by_fisioId_estado", (q) =>
          q.eq("fisioId", fisioId).eq("estado", "activo"),
        )
        .collect();
      for (const plan of planes) {
        if (!plan.fechaFin) continue;
        if (plan.fechaFin >= hoy && plan.fechaFin <= limite) {
          const paciente = await ctx.db.get(plan.pacienteId);
          const nombre = plan.pacienteNombre
            ?? (paciente
              ? `${paciente.firstName} ${paciente.lastName}`.trim()
              : "");
          planesPorVencer.push({
            id_plan: plan.legacyId ?? plan._id,
            titulo: plan.titulo,
            fecha_fin: plan.fechaFin,
            paciente_nombre: nombre,
            paciente_id: paciente?.legacyDirectusId ?? plan.pacienteId,
          });
        }
      }
    }
    planesPorVencer.sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin));
    const top10 = planesPorVencer.slice(0, 10);

    return {
      pacientes_activos: pacientesActivos,
      adherencia_promedio: adherenciaPromedio,
      planes_por_vencer: top10,
    };
  },
});

export const patientMetrics = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const fisioIds = await getFisioIdsEnClinicasDelUsuario(ctx, user._id);

    if (fisioIds.size === 0) {
      return {} as Record<
        string,
        { adherencia: number; dolor_promedio: number | null }
      >;
    }

    const fechaDesde = fechaHaceDias(30);

    // Agrupar por paciente
    const porPaciente = new Map<
      Id<"users">,
      {
        esperados: number;
        completados: number;
        doloresSum: number;
        doloresCount: number;
      }
    >();

    for (const fisioId of fisioIds) {
      const planes = await ctx.db
        .query("plans")
        .withIndex("by_fisioId", (q) => q.eq("fisioId", fisioId))
        .collect();

      for (const plan of planes) {
        const cumplimientos = await ctx.db
          .query("dailyCompliance")
          .withIndex("by_pacienteId_planId_fecha", (q) =>
            q
              .eq("pacienteId", plan.pacienteId)
              .eq("planId", plan._id)
              .gte("fecha", fechaDesde),
          )
          .collect();

        const acc = porPaciente.get(plan.pacienteId) ?? {
          esperados: 0,
          completados: 0,
          doloresSum: 0,
          doloresCount: 0,
        };
        for (const c of cumplimientos) {
          if (c.esDiaDescanso) continue;
          acc.esperados += c.ejerciciosEsperados;
          acc.completados += c.ejerciciosCompletados;
          if (c.dolorPromedio !== undefined && c.dolorPromedio !== null) {
            acc.doloresSum += c.dolorPromedio;
            acc.doloresCount += 1;
          }
        }
        porPaciente.set(plan.pacienteId, acc);
      }
    }

    const result: Record<
      string,
      { adherencia: number; dolor_promedio: number | null }
    > = {};

    for (const [pacienteId, acc] of porPaciente) {
      const paciente = await ctx.db.get(pacienteId);
      const key = paciente?.legacyDirectusId ?? pacienteId;
      const adherencia =
        acc.esperados > 0
          ? Math.round((acc.completados / acc.esperados) * 100)
          : 0;
      const dolor_promedio =
        acc.doloresCount > 0
          ? Math.round((acc.doloresSum / acc.doloresCount) * 10) / 10
          : null;
      result[key] = { adherencia, dolor_promedio };
    }

    return result;
  },
});
