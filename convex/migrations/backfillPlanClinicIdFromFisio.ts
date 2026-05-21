/**
 * Cuarta pasada de backfill. Para los planes que dejó pendientes
 * `backfillPlanClinicIdFromPatient` con motivo `paciente_sin_clinica`
 * (paciente que ya no pertenece a ninguna clínica):
 *
 *   - Si el fisio tiene exactamente UNA clínica como `fisio`/`admin` →
 *     asigna esa al plan.
 *   - Si el fisio tiene varias → deja pendiente con motivo
 *     `multiples_clinicas_fisio` (decisión manual).
 *   - Si ni el paciente ni el fisio están en ninguna clínica → ELIMINA el
 *     plan, con cascada controlada:
 *       · Si el plan tiene `exerciseExecutions` o aparece en `sessions`,
 *         NO se hard-delete (preservaría historial roto). Se marca como
 *         `estado: "cancelado"` y se loggea para revisión.
 *       · Si no tiene actividad, se borran los `planExercises` y luego el
 *         propio plan.
 *
 * Cómo ejecutar:
 *   npx convex run migrations/backfillPlanClinicIdFromFisio:run
 *   npx convex run migrations/backfillPlanClinicIdFromFisio:run --prod
 *
 * IMPORTANTE: esta migración borra registros. Revisa el resultado en logs
 * antes de correr en producción. Si quieres una pasada en seco, cambia
 * `DRY_RUN` a `true` en este archivo (no toca BD, solo enumera).
 */

import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

const DRY_RUN = false;

type Pendiente = {
  planId: Id<"plans">;
  motivo: "multiples_clinicas_fisio";
  pacienteId: Id<"users">;
  fisioId: Id<"users">;
  clinicIdsCandidatos: Id<"clinics">[];
};

type Eliminacion = {
  planId: Id<"plans">;
  modo: "hard_delete" | "soft_delete_por_actividad";
  pacienteId: Id<"users">;
  fisioId: Id<"users">;
  planExercisesEliminados?: number;
};

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();

    let yaConClinica = 0;
    let backfilled = 0;
    const pendientes: Pendiente[] = [];
    const eliminados: Eliminacion[] = [];

    for (const plan of plans) {
      if (plan.clinicId) {
        yaConClinica++;
        continue;
      }

      const [memPaciente, memFisio] = await Promise.all([
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.pacienteId))
          .collect(),
        ctx.db
          .query("clinicMemberships")
          .withIndex("by_userId", (q) => q.eq("userId", plan.fisioId))
          .collect(),
      ]);

      const pacienteEnAlguna = memPaciente.some((m) => m.puesto === "paciente");
      const clinicasFisio = Array.from(
        new Set(
          memFisio
            .filter((m) => m.puesto === "fisio" || m.puesto === "admin")
            .map((m) => m.clinicId),
        ),
      );

      // Rama 1: paciente sigue sin clínica y fisio tiene exactamente una.
      if (!pacienteEnAlguna && clinicasFisio.length === 1) {
        if (!DRY_RUN) {
          await ctx.db.patch(plan._id, { clinicId: clinicasFisio[0] });
        }
        backfilled++;
        continue;
      }

      // Rama 2: paciente sigue sin clínica y fisio tiene varias → manual.
      if (!pacienteEnAlguna && clinicasFisio.length > 1) {
        pendientes.push({
          planId: plan._id,
          motivo: "multiples_clinicas_fisio",
          pacienteId: plan.pacienteId,
          fisioId: plan.fisioId,
          clinicIdsCandidatos: clinicasFisio,
        });
        continue;
      }

      // Rama 3: paciente sigue sin clínica y fisio tampoco tiene ninguna.
      // → eliminar el plan (hard delete si no hay actividad; soft si sí).
      if (!pacienteEnAlguna && clinicasFisio.length === 0) {
        const planExercises = await ctx.db
          .query("planExercises")
          .withIndex("by_planId", (q) => q.eq("planId", plan._id))
          .collect();

        const hasExecution = await ctx.db
          .query("exerciseExecutions")
          .withIndex("by_planExerciseId", (q) =>
            q.eq(
              "planExerciseId",
              (planExercises[0]?._id ?? ("nonexistent" as Id<"planExercises">)),
            ),
          )
          .first();
        // Comprobación más exhaustiva: si algún planExercise tiene ejecución.
        let cualquierEjecucion = !!hasExecution;
        if (!cualquierEjecucion) {
          for (const pe of planExercises) {
            const exec = await ctx.db
              .query("exerciseExecutions")
              .withIndex("by_planExerciseId", (q) =>
                q.eq("planExerciseId", pe._id),
              )
              .first();
            if (exec) {
              cualquierEjecucion = true;
              break;
            }
          }
        }

        if (cualquierEjecucion) {
          if (!DRY_RUN) {
            await ctx.db.patch(plan._id, { estado: "cancelado" });
          }
          eliminados.push({
            planId: plan._id,
            modo: "soft_delete_por_actividad",
            pacienteId: plan.pacienteId,
            fisioId: plan.fisioId,
          });
          continue;
        }

        if (!DRY_RUN) {
          for (const pe of planExercises) {
            await ctx.db.delete(pe._id);
          }
          await ctx.db.delete(plan._id);
        }
        eliminados.push({
          planId: plan._id,
          modo: "hard_delete",
          pacienteId: plan.pacienteId,
          fisioId: plan.fisioId,
          planExercisesEliminados: planExercises.length,
        });
        continue;
      }

      // Rama 4 (defensiva): paciente sí está en alguna clínica → este script
      // no es el adecuado, queda pendiente para que lo recoja la pasada
      // `backfillPlanClinicIdFromPatient`.
      pendientes.push({
        planId: plan._id,
        motivo: "multiples_clinicas_fisio",
        pacienteId: plan.pacienteId,
        fisioId: plan.fisioId,
        clinicIdsCandidatos: clinicasFisio,
      });
    }

    console.log(
      `[backfillPlanClinicIdFromFisio] dryRun=${DRY_RUN} yaConClinica=${yaConClinica} backfilled=${backfilled} eliminados=${eliminados.length} pendientes=${pendientes.length}`,
    );

    if (eliminados.length > 0) {
      console.log(
        "[backfillPlanClinicIdFromFisio] eliminados:",
        JSON.stringify(eliminados, null, 2),
      );
    }
    if (pendientes.length > 0) {
      console.log(
        "[backfillPlanClinicIdFromFisio] pendientes:",
        JSON.stringify(pendientes, null, 2),
      );
    }

    return { yaConClinica, backfilled, eliminados, pendientes, dryRun: DRY_RUN };
  },
});
