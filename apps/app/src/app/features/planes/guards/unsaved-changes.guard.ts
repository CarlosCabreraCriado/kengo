import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { PlanBuilderService } from '../data-access/plan-builder.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => {
  const svc = inject(PlanBuilderService);

  if (svc.isEditMode() && svc.isDirty()) {
    return window.confirm(
      'Tienes cambios sin guardar. ¿Seguro que quieres salir?',
    );
  }

  return true;
};
