import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2ListRowComponent,
  Ui2PillComponent,
} from '../../../../shared/ui-v2';

/**
 * Qué hará el servidor al completarse el Checkout. Mismos literales que
 * `CheckoutAction` en `convex/billing/actions.ts`:
 *  - `create_subscription`: sin sub viva → el primer cargo sale al confirmar.
 *  - `attach_pm_end_trial`: la sub sigue en trial → el cargo sale en `trialEnd`.
 */
export type ResumenCheckoutAccion = 'create_subscription' | 'attach_pm_end_trial';

export interface ResumenCheckoutDialogData {
  accion: ResumenCheckoutAccion;
  esAMedida: boolean;
  /** "Smart Ilimitado", "A medida"… (sin el prefijo "Plan"). */
  planLabel: string;
  fisios: number;
  /** Base mensual sin impuestos. `null` = contrato a medida sin preview. */
  importeMensualEur: number | null;
  /** Fin del trial en ms; solo relevante con `attach_pm_end_trial`. */
  trialEnd?: number;
}

/** `true` = continuar a Stripe. Cierre por X/backdrop → `undefined`. */
export type ResumenCheckoutDialogResult = boolean;

interface CuandoSeCobraVm {
  /** Título de la fila; si hay `fecha`, la plantilla la añade formateada. */
  titulo: string;
  fecha?: number;
  detalle: string;
}

/** Tipo general del IGIC. El porcentaje real vive en el Tax Rate de Stripe. */
const IGIC_PORCENTAJE = 7;

/**
 * Resumen previo al Checkout de Stripe. El Checkout va en `mode: 'setup'` y
 * no pinta importe alguno, así que esta es la pantalla donde el owner ve qué
 * va a pagar, con qué impuesto según su dirección fiscal y cuándo se cobra.
 */
@Component({
  standalone: true,
  selector: 'app-resumen-checkout-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2ListRowComponent,
    Ui2PillComponent,
  ],
  templateUrl: './resumen-checkout-dialog.component.html',
})
export class ResumenCheckoutDialogComponent {
  private readonly dialogRef =
    inject<DialogRef<ResumenCheckoutDialogResult>>(DialogRef);
  protected readonly data = inject<ResumenCheckoutDialogData>(DIALOG_DATA);

  protected readonly igicPorcentaje = IGIC_PORCENTAJE;

  protected readonly importe = this.data.importeMensualEur;

  /** Total mensual con IGIC redondeado a céntimos; `null` sin importe. */
  protected readonly totalIgic =
    this.importe === null
      ? null
      : Math.round(this.importe * (100 + IGIC_PORCENTAJE)) / 100;

  protected readonly planSubtitulo = `${this.data.planLabel} · ${this.data.fisios} ${
    this.data.fisios === 1 ? 'fisioterapeuta' : 'fisioterapeutas'
  }`;

  protected readonly cuandoSeCobra: CuandoSeCobraVm = this.calcularCuandoSeCobra();

  private calcularCuandoSeCobra(): CuandoSeCobraVm {
    if (this.data.accion === 'create_subscription') {
      return {
        titulo: 'Hoy, al confirmar en Stripe',
        detalle:
          'El primer cargo se realiza en cuanto guardes la tarjeta; después, cada mes en la misma fecha.',
      };
    }
    if (this.data.trialEnd) {
      return {
        titulo: 'El',
        fecha: this.data.trialEnd,
        detalle:
          'Tu periodo de prueba sigue hasta esa fecha; ese día se hace el primer cargo y después uno cada mes. Puedes cancelar antes sin coste.',
      };
    }
    return {
      titulo: 'Al terminar tu periodo de prueba',
      detalle:
        'Ese día se hace el primer cargo y después uno cada mes. Puedes cancelar antes sin coste.',
    };
  }

  protected continuar(): void {
    this.dialogRef.close(true);
  }

  protected cancelar(): void {
    this.dialogRef.close(false);
  }
}
