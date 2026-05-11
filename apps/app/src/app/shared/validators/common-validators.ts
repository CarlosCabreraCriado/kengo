import { ValidatorFn, Validators } from '@angular/forms';

/**
 * Email obligatorio con formato valido.
 *
 * @example
 * ```typescript
 * this.form = this.fb.group({
 *   email: ['', emailRequired],
 * });
 * ```
 */
export const emailRequired: ValidatorFn[] = [Validators.required, Validators.email];

/**
 * Email opcional: solo valida formato si hay valor.
 * Util para formularios donde el email no es obligatorio (clinica).
 */
export const emailOptional: ValidatorFn[] = [Validators.email];

/**
 * Password obligatorio con minLength configurable (default 8, minimo seguro).
 *
 * @param minLength - Longitud minima (default: 8)
 *
 * @example
 * ```typescript
 * this.form = this.fb.group({
 *   password: ['', passwordRequired()],
 * });
 * ```
 */
export const passwordRequired = (minLength = 8): ValidatorFn[] => [
  Validators.required,
  Validators.minLength(minLength),
];

/**
 * Campo "repetir password" (solo required).
 * Pareja con `passwordMatchValidator` aplicado a nivel de FormGroup.
 *
 * @example
 * ```typescript
 * this.form = this.fb.group({
 *   password: ['', passwordRequired()],
 *   repetir: ['', passwordRepeatRequired],
 * }, { validators: passwordMatchValidator() });
 * ```
 */
export const passwordRepeatRequired: ValidatorFn[] = [Validators.required];

/**
 * Codigo de un solo uso de N digitos (default 6).
 *
 * @param digits - Numero de digitos exactos (default: 6)
 */
export const otpCode = (digits = 6): ValidatorFn[] => [
  Validators.required,
  Validators.pattern(new RegExp(`^\\d{${digits}}$`)),
];

/**
 * Codigo de vinculacion de clinica con longitud exacta.
 *
 * @param length - Longitud exacta del codigo (default: 8)
 */
export const clinicaCode = (length = 8): ValidatorFn[] => [
  Validators.required,
  Validators.minLength(length),
  Validators.maxLength(length),
];

/**
 * Codigo postal espanol: 5 digitos exactos.
 */
export const postalCode: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(5),
  Validators.maxLength(5),
  Validators.pattern(/^\d{5}$/),
];

/**
 * Codigo postal espanol opcional: solo valida formato si hay valor.
 */
export const postalCodeOptional: ValidatorFn[] = [
  Validators.minLength(5),
  Validators.maxLength(5),
  Validators.pattern(/^\d{5}$/),
];
