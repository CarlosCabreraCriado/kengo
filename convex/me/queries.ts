/**
 * Queries de "me" — sobre el usuario autenticado actual.
 *
 * Conviven con `users/queries.ts` (que opera sobre cualquier usuario por id);
 * estas queries son atajos cómodos para el frontend cuando solo necesita
 * información del usuario en sesión.
 */

import { query } from "../_generated/server";
import { getAuthenticatedUser } from "../_helpers/permissions";
import { getManagedClinicIds } from "../_helpers/patientAccess";

/**
 * Devuelve los `clinicId`s de las clínicas donde el usuario actual tiene rol
 * de gestión (fisio o admin). Usado por `metricas-pacientes.service.ts` y
 * `dashboard-fisio.service.ts` para resolver la clínica destino sin hacer
 * lookups manuales.
 */
export const myManagedClinics = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return await getManagedClinicIds(ctx, user._id);
  },
});
