import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DialogContainerComponent } from './dialog-container.component';
import { DialogHeaderComponent } from './dialog-header.component';
import { DialogContentComponent } from './dialog-content.component';
import { DialogActionsComponent } from './dialog-actions.component';
import { ButtonComponent } from '../button/button.component';
import { ConfirmDialogData } from './dialog.service';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
    ButtonComponent,
  ],
  template: `
    <ui-dialog-container>
      <ui-dialog-header [title]="data.title" [showClose]="false"></ui-dialog-header>

      <ui-dialog-content>
        <p class="text-gray-600">{{ data.message }}</p>
      </ui-dialog-content>

      <ui-dialog-actions>
        <ui-button variant="ghost" (clicked)="onCancel()">
          {{ data.cancelText || 'Cancelar' }}
        </ui-button>
        <ui-button [variant]="data.confirmVariant || 'primary'" (clicked)="onConfirm()">
          {{ data.confirmText || 'Confirmar' }}
        </ui-button>
      </ui-dialog-actions>
    </ui-dialog-container>
  `,
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(DIALOG_DATA);
  private dialogRef = inject(DialogRef<boolean>);

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
