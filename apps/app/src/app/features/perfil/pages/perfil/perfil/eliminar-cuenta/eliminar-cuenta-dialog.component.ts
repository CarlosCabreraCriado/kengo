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

export interface EliminarCuentaDialogData {
  email: string;
  bloqueos: EliminarCuentaBloqueo[];
  resumen: {
    clinicas: number;
    planes: number;
    sesiones: number;
    conversaciones: number;
  };
}

/**
 * Confirmación de borrado de cuenta.
 *
 * La operación es irreversible, así que además del botón destructivo se exige
 * reescribir el email: es la barrera estándar contra el clic accidental. Si el
 * preflight devolvió bloqueos (propiedad de clínica o suscripción viva), el
 * diálogo los explica y no deja continuar.
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
    Ui2InputComponent,
  ],
  templateUrl: './eliminar-cuenta-dialog.component.html',
  styleUrl: './eliminar-cuenta-dialog.component.css',
})
export class EliminarCuentaDialogComponent {
  private dialogRef = inject<DialogRef<string | undefined>>(DialogRef);
  protected readonly data = inject<EliminarCuentaDialogData>(DIALOG_DATA);

  protected readonly bloqueado = this.data.bloqueos.length > 0;

  protected readonly confirmacion = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  private readonly valor = toSignal(this.confirmacion.valueChanges, {
    initialValue: '',
  });

  protected readonly coincide = computed(
    () =>
      this.valor().trim().toLowerCase() ===
      this.data.email.trim().toLowerCase(),
  );

  protected cancelar(): void {
    this.dialogRef.close(undefined);
  }

  protected confirmar(): void {
    if (this.bloqueado || !this.coincide()) return;
    this.dialogRef.close(this.confirmacion.value);
  }
}
