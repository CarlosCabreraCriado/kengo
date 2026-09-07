import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2CtaBarComponent,
} from '../../../../shared/ui-v2';

/** A quién se asigna la copia del plan. */
export type CopiarPlanDestino = 'mismo' | 'otro';

export interface CopiarPlanSheetData {
  /** Nombre del paciente del plan origen (para la opción "mismo paciente"). */
  pacienteNombre: string;
  /** Ejercicios del plan origen. */
  totalEjercicios: number;
}

/**
 * Sheet de elección de destino al copiar un plan al carrito. Se abre con
 * `DialogService.openSheet` y cierra con `'mismo' | 'otro'`, o `null` si el
 * fisio lo descarta (X o backdrop).
 */
@Component({
  standalone: true,
  selector: 'app-copiar-plan-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2CtaBarComponent,
  ],
  templateUrl: './copiar-plan-sheet.component.html',
  styleUrl: './copiar-plan-sheet.component.css',
})
export class CopiarPlanSheetComponent {
  readonly data = inject<CopiarPlanSheetData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<CopiarPlanDestino | null>);

  get subtitulo(): string {
    const n = this.data.totalEjercicios;
    const ejercicios = n === 1 ? '1 ejercicio' : `${n} ejercicios`;
    return `Se cargarán ${ejercicios} con su dosificación en el carrito para crear un plan nuevo.`;
  }

  seleccionar(destino: CopiarPlanDestino) {
    this.dialogRef.close(destino);
  }

  cerrar() {
    this.dialogRef.close(null);
  }
}
