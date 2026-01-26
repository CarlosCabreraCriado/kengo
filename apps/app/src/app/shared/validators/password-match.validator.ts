import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador de FormGroup que verifica que dos campos de contrasena coincidan.
 *
 * @param passwordField - Nombre del campo de contrasena (default: 'password')
 * @param confirmField - Nombre del campo de confirmacion (default: 'repetir')
 * @returns ValidatorFn que retorna error 'passwordMismatch' si no coinciden
 *
 * @example
 * ```typescript
 * this.form = this.fb.group({
 *   password: ['', [Validators.required, Validators.minLength(6)]],
 *   repetir: ['', Validators.required],
 * }, { validators: passwordMatchValidator() });
 * ```
 */
export function passwordMatchValidator(
  passwordField = 'password',
  confirmField = 'repetir'
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordField);
    const confirm = control.get(confirmField);

    if (!password || !confirm) {
      return null;
    }

    // Si alguno esta vacio, dejar que los validadores individuales manejen el error
    if (!password.value || !confirm.value) {
      return null;
    }

    if (password.value !== confirm.value) {
      // Marcar el campo de confirmacion como invalido
      confirm.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    // Si coinciden, limpiar el error de mismatch (si existe)
    if (confirm.hasError('passwordMismatch')) {
      delete confirm.errors!['passwordMismatch'];
      if (Object.keys(confirm.errors!).length === 0) {
        confirm.setErrors(null);
      }
    }

    return null;
  };
}
