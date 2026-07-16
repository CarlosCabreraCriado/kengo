/**
 * Migración one-shot de clínicas pre-Stripe a suscripciones.
 *
 * Se invoca **una sola vez** desde el Convex Dashboard al activar Stripe en
 * producción (FASE 14 del plan). Para cada clínica que aún no tenga registro
 * `clinicBilling`:
 *  - Si tiene ≤10 fisios facturables: encola `startTrialForClinic` con un
 *    trial de 30 días (vs 14 estándar) y un email de anuncio al admin.
 *  - Si tiene >10 fisios facturables: marca `requiereContactoVentas=true` y
 *    envía un email enterprise. NO crea suscripción Stripe (queda fuera del
 *    autoservicio).
 *
 * Idempotente: clínicas con registro `clinicBilling` previo se omiten.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { LIMITE_FISIOS_AUTOSERVICIO } from "./_helpers";

const TRIAL_DAYS_MIGRATION = 30;
const APP_URL_FALLBACK = "https://kengoapp.com";

function parseAppUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return APP_URL_FALLBACK;
    }
    return url.origin;
  } catch {
    return APP_URL_FALLBACK;
  }
}

/**
 * Vista previa sin efectos colaterales. Devuelve cuántas clínicas se
 * procesarían y cómo. Útil para verificar el alcance antes de ejecutar
 * `migrateExistingClinics`.
 */
export const getMigrationPreview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const clinics = await ctx.db.query("clinics").collect();

    let sinBilling = 0;
    let conMasDe10Fisios = 0;
    let candidatasParaTrial = 0;

    for (const clinic of clinics) {
      const billing = await ctx.db
        .query("clinicBilling")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .unique();
      if (billing) continue;

      sinBilling++;
      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();
      const cantidadFisios = memberships.filter(
        (m) => m.puesto === "fisio" || m.puesto === "admin",
      ).length;

      if (cantidadFisios > LIMITE_FISIOS_AUTOSERVICIO) {
        conMasDe10Fisios++;
      } else {
        candidatasParaTrial++;
      }
    }

    return {
      totalClinicas: clinics.length,
      sinBilling,
      conMasDe10Fisios,
      candidatasParaTrial,
    };
  },
});

/**
 * Ejecuta la migración. Encola actions y emails con `scheduler.runAfter(0, ...)`
 * para no bloquear la mutation. Devuelve resumen de lo procesado.
 */
export const migrateExistingClinics = internalMutation({
  args: {
    /** Override del trial de 30 días (solo para QA). */
    trialDaysOverride: v.optional(v.number()),
  },
  handler: async (ctx, { trialDaysOverride }) => {
    const trialDays = trialDaysOverride ?? TRIAL_DAYS_MIGRATION;
    const appUrl = parseAppUrl(
      process.env["KENGO_APP_URL"] ?? APP_URL_FALLBACK,
    );
    const portalUrl = `${appUrl}/mi-clinica/suscripcion`;

    const clinics = await ctx.db.query("clinics").collect();

    let procesadas = 0;
    let skipped = 0;
    let enterpriseFlagged = 0;
    let trialsIniciados = 0;
    let sinAdminEmail = 0;

    for (const clinic of clinics) {
      const existingBilling = await ctx.db
        .query("clinicBilling")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .unique();
      if (existingBilling) {
        skipped++;
        continue;
      }

      const memberships = await ctx.db
        .query("clinicMemberships")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();
      const cantidadFisios = memberships.filter(
        (m) => m.puesto === "fisio" || m.puesto === "admin",
      ).length;

      const adminMembership = memberships.find((m) => m.puesto === "admin");
      const adminUser = adminMembership
        ? await ctx.db.get(adminMembership.userId)
        : null;
      const adminEmail = adminUser?.email ?? clinic.email ?? null;
      const adminNombre = adminUser
        ? `${adminUser.firstName} ${adminUser.lastName}`.trim()
        : "Administrador";

      if (cantidadFisios > LIMITE_FISIOS_AUTOSERVICIO) {
        await ctx.db.insert("clinicBilling", {
          clinicId: clinic._id,
          // B-9: enterprise_pending (no bloqueante) en vez de `none` (que
          // bloqueaba de golpe a la clínica al ejecutar la migración).
          estadoLocal: "enterprise_pending",
          requiereContactoVentas: true,
          cantidadFisios,
          actualizadoEn: Date.now(),
        });
        enterpriseFlagged++;

        if (adminEmail) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendEnterpriseInvitationEmail,
            {
              to: adminEmail,
              nombreAdmin: adminNombre,
              clinicaNombre: clinic.nombre,
              fisiosActuales: cantidadFisios,
              contactUrl: portalUrl,
            },
          );
        } else {
          sinAdminEmail++;
          console.warn(
            `[migration] clínica ${clinic._id} (>10 fisios) sin email de admin`,
          );
        }
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.billing.actions.startTrialForClinic,
          { clinicId: clinic._id, trialDays },
        );
        trialsIniciados++;

        if (adminEmail) {
          await ctx.scheduler.runAfter(
            0,
            internal.email.actions.sendMigrationAnnouncementEmail,
            {
              to: adminEmail,
              nombreAdmin: adminNombre,
              clinicaNombre: clinic.nombre,
              diasGracia: trialDays,
              portalUrl,
            },
          );
        } else {
          sinAdminEmail++;
          console.warn(
            `[migration] clínica ${clinic._id} sin email de admin para anuncio`,
          );
        }
      }

      procesadas++;
    }

    const resumen = {
      procesadas,
      skipped,
      enterpriseFlagged,
      trialsIniciados,
      sinAdminEmail,
    };
    console.log(
      `[migration] resumen ${JSON.stringify(resumen)} (trialDays=${trialDays})`,
    );
    return resumen;
  },
});
