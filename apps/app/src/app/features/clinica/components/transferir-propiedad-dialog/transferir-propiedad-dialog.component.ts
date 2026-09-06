import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Ui2ButtonComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2RadioGroupComponent,
  type Ui2RadioOption,
} from '../../../../shared/ui-v2';
import type { MetodoDePagoAportado } from '@kengo/shared-models';

export interface TransferirPropiedadDialogData {
  /** Nombre del nuevo propietario. */
  nombreNuevo: string;
  clinicaNombre: string;
  /** Tarjetas vivas que el owner saliente aportó a esta clínica. */
  tarjetas: MetodoDePagoAportado[];
}

/** Lo que devuelve el diálogo al confirmar. */
export interface TransferirPropiedadDecision {
  retirarMiMetodoDePago: boolean;
}

type Opcion = 'mantener' | 'retirar';

/**
 * Paso previo a transferir la propiedad cuando el owner saliente tiene
 * tarjetas en la clínica: decide si siguen cobrándose (tarjeta de empresa)
 * o si se retiran (el nuevo owner deberá añadir la suya). Quien inicia la
 * transferencia es quien sabe de quién es la tarjeta, así que la decisión es
 * suya; en cualquier caso podrá retirarla más tarde desde Mi cuenta.
 */
@Component({
  selector: 'app-transferir-propiedad-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2RadioGroupComponent,
  ],
  templateUrl: './transferir-propiedad-dialog.component.html',
  styleUrl: './transferir-propiedad-dialog.component.css',
})
export class TransferirPropiedadDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<TransferirPropiedadDecision | undefined>>(DialogRef);
  protected readonly data = inject<TransferirPropiedadDialogData>(DIALOG_DATA);

  protected readonly opcion = new FormControl<Opcion>('mantener', {
    nonNullable: true,
  });
  private readonly valor = toSignal(this.opcion.valueChanges, {
    initialValue: 'mantener' as Opcion,
  });

  protected readonly tarjetaActiva = computed(
    () => this.data.tarjetas.find((t) => t.esActiva) ?? null,
  );
  protected readonly proximoCobro = computed(
    () => this.data.tarjetas.find((t) => t.proximoCobro)?.proximoCobro,
  );

  protected readonly opciones = computed<Ui2RadioOption[]>(() => {
    const activa = this.tarjetaActiva();
    const fecha = this.proximoCobro();
    const plazo = fecha
      ? `antes del ${new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
      : 'antes del próximo cobro';
    return [
      {
        value: 'mantener',
        label: activa ? 'Mantener mi tarjeta' : 'Mantener mis tarjetas',
        description:
          'Seguirá cobrándose como hasta ahora. Podrás retirarla cuando quieras desde Mi cuenta → Tarjetas aportadas.',
      },
      {
        value: 'retirar',
        label: activa ? 'Retirar mi tarjeta' : 'Retirar mis tarjetas',
        description: activa
          ? `Dejará de cobrarse. ${this.data.nombreNuevo} deberá añadir un método de pago ${plazo}; le avisaremos.`
          : `Dejarán de estar disponibles para ${this.data.clinicaNombre}.`,
      },
    ];
  });

  protected etiqueta(t: MetodoDePagoAportado): string {
    const marca = t.marca
      ? t.marca.charAt(0).toUpperCase() + t.marca.slice(1)
      : 'Tarjeta';
    return t.ultimos4 ? `${marca} •••• ${t.ultimos4}` : marca;
  }

  protected cancelar(): void {
    this.dialogRef.close(undefined);
  }

  protected confirmar(): void {
    this.dialogRef.close({ retirarMiMetodoDePago: this.valor() === 'retirar' });
  }
}
