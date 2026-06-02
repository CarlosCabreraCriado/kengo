import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { PlanesService } from '../data-access/planes.service';
import { ToastService } from '../../../shared/services/toast/toast.service';

/**
 * Bloquea la entrada a `/planes/:id/editar` cuando el plan está en estado
 * `modificado` (versión histórica inmutable). Redirige al detalle y muestra
 * un toast informativo. Si el plan no existe o falla la carga, deja que el
 * componente gestione el error.
 */
export const planEditableGuard: CanActivateFn = async (route) => {
  const planesService = inject(PlanesService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const planId = route.paramMap.get('id');
  if (!planId) return true;

  const plan = await planesService.getPlanById(planId);
  if (!plan) return true;

  if (plan.estado === 'modificado') {
    toast.info('Esta versión del plan no se puede editar.');
    return router.createUrlTree(['/planes', planId]);
  }

  return true;
};
