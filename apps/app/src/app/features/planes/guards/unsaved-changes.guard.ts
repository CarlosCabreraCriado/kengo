import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { PlanBuilderService } from '../data-access/plan-builder.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const svc = inject(PlanBuilderService);

  if (svc.isEditMode() && svc.isDirty()) {
    // Permitir navegación al catálogo de ejercicios sin warning
    const nextUrl = nextState?.url || '';
    if (nextUrl.startsWith('/galeria/ejercicios')) {
      return true;
    }
    return window.confirm(
      'Tienes cambios sin guardar. ¿Seguro que quieres salir?',
    );
  }

  return true;
};
