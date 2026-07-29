import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  LEGAL_DOCS,
  LegalAvisoLegalComponent,
  LegalCookiesComponent,
  LegalPrivacidadComponent,
  LegalTerminosComponent,
  type LegalDocId,
} from '@kengo/legal';
import {
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../../../../shared/ui-v2';

export interface LegalDialogData {
  doc: LegalDocId;
}

/**
 * Diálogo informativo que muestra cualquiera de los documentos legales.
 *
 * Sustituye al antiguo `PrivacyPolicyComponent`: un único contenedor para los
 * cuatro textos, que viven en `@kengo/legal` y se comparten con la landing.
 * Cada documento va en su propio `@defer` para que abrir el diálogo solo
 * descargue el texto solicitado.
 */
@Component({
  selector: 'app-legal-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    LegalPrivacidadComponent,
    LegalTerminosComponent,
    LegalCookiesComponent,
    LegalAvisoLegalComponent,
  ],
  templateUrl: './legal-dialog.component.html',
})
export class LegalDialogComponent {
  private dialogRef = inject(DialogRef);
  private data = inject<LegalDialogData>(DIALOG_DATA);

  protected readonly doc = this.data.doc;
  protected readonly meta = LEGAL_DOCS[this.data.doc];

  cerrar() {
    this.dialogRef.close();
  }
}
