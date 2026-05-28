import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2CtaBarComponent,
} from '../../../../shared/ui-v2';

export type OpcionClinica = 'link' | 'create';

@Component({
  standalone: true,
  selector: 'app-seleccionar-opcion-clinica-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2CtaBarComponent,
  ],
  templateUrl: './seleccionar-opcion-clinica-dialog.component.html',
  styleUrl: './seleccionar-opcion-clinica-dialog.component.css',
})
export class SeleccionarOpcionClinicaDialogComponent {
  private readonly dialogRef = inject(DialogRef<OpcionClinica | null>);

  seleccionar(opcion: OpcionClinica) {
    this.dialogRef.close(opcion);
  }

  cerrar() {
    this.dialogRef.close(null);
  }
}
