import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RutinaBuilderService } from '../data-access/rutina-builder.service';
import { DialogService } from '../../../shared/services/dialog/dialog.service';

export const rutinaUnsavedChangesGuard: CanDeactivateFn<unknown> = (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const svc = inject(RutinaBuilderService);
  const dialog = inject(DialogService);

  if (svc.isEditMode() && svc.isDirty()) {
    // Permitir navegación al catálogo de ejercicios sin warning: el
    // usuario puede salir a añadir más ejercicios y volver al builder
    // manteniendo el estado en memoria.
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
