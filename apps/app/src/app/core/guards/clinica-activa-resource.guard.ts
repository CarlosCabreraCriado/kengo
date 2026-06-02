import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ConvexService } from '../convex/convex.service';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';
import { ClinicaActivaPendingService } from '../auth/services/clinica-activa-pending.service';
import { PageLoaderService } from '../services/page-loader.service';
import { ToastService } from '../../shared/services/toast/toast.service';
import { api } from '../../../../../../convex/_generated/api';

export type ResourceType = 'paciente' | 'plan' | 'sesion' | 'conversacion';

/**
 * Antes de activar una ruta de detalle cuyo `:id` apunta a un recurso de
 * una clínica concreta, alinea la "clínica activa" del cliente con la
 * clínica del recurso. Robustece el aislamiento multiclínica frente a
 * navegación directa por URL (notificaciones, marcadores, deep-links): el
 * usuario nunca acaba viendo un detalle de la clínica B con el
 * sidebar/listas de la A.
 *
 * Comportamiento:
 *   - Recurso accesible y de la clínica activa → continúa sin tocar nada.
 *   - Recurso accesible pero de otra clínica del usuario → cambia la clínica
 *     activa con `ClinicaActivaService.set()` y muestra un toast info con el
 *     nombre de la nueva clínica.
 *   - Recurso no accesible (usuario no miembro o id inexistente) → redirige
 *     a `/inicio` y muestra un toast de error.
 *   - Usuario con 0/1 clínicas o sin id en la URL → no aplica, continúa.
 *
 * Defensa en profundidad: las queries Convex de detalle siguen lanzando
 * "No tienes acceso" si se saltara este guard, así que es seguro
 * incluso ante consultas directas a la red.
 */
/**
 * Tiempo de seguridad que el guard mantiene visible el overlay global mientras
 * realiza la query a Convex. El `forceShow` por defecto del router (350 ms) no
 * cubre la latencia del roundtrip; sin esta extensión, el spinner se libera
 * antes de que la navegación termine y la página origen reaparece un instante.
 */
const GUARD_LOADER_GRACE_MS = 2000;

export function clinicaActivaResourceGuard(
  resourceType: ResourceType,
): CanActivateFn {
  return async (route) => {
    const router = inject(Router);
    const convex = inject(ConvexService);
    const session = inject(SessionService);
    const clinicaActiva = inject(ClinicaActivaService);
    const pending = inject(ClinicaActivaPendingService);
    const pageLoader = inject(PageLoaderService);
    const toast = inject(ToastService);

    const resourceId = route.paramMap.get('id');
    if (!resourceId) return true;

    const clinicas = session.misclinicas();
    // Con 0 o 1 clínicas no hay riesgo de cruce: si es 1 ya está autoseleccionada.
    if (clinicas.length <= 1) return true;

    // Sostiene el overlay global durante el roundtrip a Convex. Cuando el
    // componente destino se registre con `pageLoader.register(...)` su signal
    // tomará el control; si no se registra, `NavigationEnd` lo liberará.
    pageLoader.forceShow(GUARD_LOADER_GRACE_MS);

    let result: {
      clinicId: string | null;
      clinicName: string | null;
      accesible: boolean;
    };
    try {
      result = await convex.query(
        api.clinicMemberships.queries.getClinicIdForResource,
        {
          resourceType,
          resourceId,
        },
      );
    } catch (err) {
      console.error(
        '[ClinicaActivaResourceGuard] No se pudo resolver el recurso:',
        err,
      );
      toast.error('No se pudo verificar el acceso al recurso.');
      return router.createUrlTree(['/inicio']);
    }

    if (!result.accesible) {
      toast.error('No tienes acceso a este recurso.');
      return router.createUrlTree(['/inicio']);
    }

    // Recurso legacy sin clinicId (plans antiguos sin migrar): nada que hacer.
    if (!result.clinicId) return true;

    if (result.clinicId === clinicaActiva.selectedClinicaId()) return true;

    // El cambio efectivo y el toast se aplican en `NavigationEnd`, evitando
    // disparar watchQuery reactivas en el componente origen aún visible.
    pending.setPending(result.clinicId, result.clinicName);
    return true;
  };
}
