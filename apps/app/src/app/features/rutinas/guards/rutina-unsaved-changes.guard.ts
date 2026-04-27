import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { RutinaBuilderService } from '../data-access/rutina-builder.service';

export const rutinaUnsavedChangesGuard: CanDeactivateFn<unknown> = (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const svc = inject(RutinaBuilderService);

  if (svc.isEditMode() && svc.isDirty()) {
    // Permitir navegación al catálogo de ejercicios sin warning: el
    // usuario puede salir a añadir más ejercicios y volver al builder
    // manteniendo el estado en memoria.
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
