import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import {
  Ui2ButtonComponent,
  Ui2CheckboxComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2InputComponent,
} from '../../../../../../shared/ui-v2';

export interface EliminarCuentaBloqueo {
  tipo: string;
  clinicId: string;
  clinicNombre: string;
  detalle: string;
}

/** Clínica que se cerrará porque quien borra su cuenta es su propietario. */
export interface EliminarCuentaClinica {
  clinicId: string;
  clinicNombre: string;
  otrosMiembros: number;
  planes: number;
  suscripcionViva: boolean;
}

export interface EliminarCuentaDialogData {
  email: string;
  bloqueos: EliminarCuentaBloqueo[];
  clinicasACerrar: EliminarCuentaClinica[];
  resumen: {
    clinicas: number;
    planes: number;
    sesiones: number;
    conversaciones: number;
  };
}

/** Lo que devuelve el diálogo al confirmar. */
export interface EliminarCuentaConfirmacion {
  confirmacionEmail: string;
  confirmarCierreDeClinicas: boolean;
}

/**
 * Confirmación de borrado de cuenta.
 *
 * La operación es irreversible, así que además del botón destructivo se exige
 * reescribir el email: es la barrera estándar contra el clic accidental.
 *
 * Cuando el usuario es propietario de alguna clínica, el borrado la cierra en
 * cascada y destruye datos de sus pacientes, no solo los suyos. Por eso ese
 * caso pide un segundo consentimiento explícito con un checkbox, después de
 * enumerar qué se pierde en cada clínica.
 */
@Component({
  selector: 'app-eliminar-cuenta-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2CheckboxComponent,
    Ui2InputComponent,
  ],
  templateUrl: './eliminar-cuenta-dialog.component.html',
  styleUrl: './eliminar-cuenta-dialog.component.css',
})
export class EliminarCuentaDialogComponent {
  private dialogRef =
    inject<DialogRef<EliminarCuentaConfirmacion | undefined>>(DialogRef);
  protected readonly data = inject<EliminarCuentaDialogData>(DIALOG_DATA);

  protected readonly bloqueado = this.data.bloqueos.length > 0;
  protected readonly clinicasACerrar = this.data.clinicasACerrar ?? [];
  protected readonly cierraClinicas = this.clinicasACerrar.length > 0;

  protected readonly confirmacion = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  protected readonly aceptaCierre = new FormControl(false, {
    nonNullable: true,
  });

  private readonly valor = toSignal(this.confirmacion.valueChanges, {
    initialValue: '',
  });

  private readonly aceptado = toSignal(this.aceptaCierre.valueChanges, {
    initialValue: false,
  });

  protected readonly coincide = computed(
    () =>
      this.valor().trim().toLowerCase() ===
      this.data.email.trim().toLowerCase(),
  );

  /** El botón destructivo exige email correcto y, si aplica, consentimiento. */
  protected readonly puedeConfirmar = computed(
    () => this.coincide() && (!this.cierraClinicas || this.aceptado()),
  );

  protected cancelar(): void {
    this.dialogRef.close(undefined);
  }

  protected confirmar(): void {
    if (this.bloqueado || !this.puedeConfirmar()) return;
    this.dialogRef.close({
      confirmacionEmail: this.confirmacion.value,
      confirmarCierreDeClinicas: this.cierraClinicas,
    });
  }
}
