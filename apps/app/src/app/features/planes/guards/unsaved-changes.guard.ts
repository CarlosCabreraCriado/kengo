import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { PlanBuilderService } from '../data-access/plan-builder.service';
import { DialogService } from '../../../shared/services/dialog/dialog.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const svc = inject(PlanBuilderService);
  const dialog = inject(DialogService);

  if (svc.isEditMode() && svc.isDirty()) {
    // Permitir navegación al catálogo de ejercicios sin warning
    const nextUrl = nextState?.url || '';
    if (nextUrl.startsWith('/ejercicios')) {
      return true;
    }
    return dialog.confirm({
      title: 'Cambios sin guardar',
      message: '¿Seguro que quieres salir? Perderás los cambios que has hecho.',
      confirmText: 'Salir sin guardar',
      cancelText: 'Continuar editando',
      confirmVariant: 'danger',
    });
  }

  return true;
};
