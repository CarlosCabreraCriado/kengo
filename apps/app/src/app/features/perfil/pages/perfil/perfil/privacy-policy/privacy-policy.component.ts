import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import {
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
})
export class PrivacyPolicyComponent {
  private dialogRef = inject(DialogRef);

  cerrar() {
    this.dialogRef.close();
  }
}
