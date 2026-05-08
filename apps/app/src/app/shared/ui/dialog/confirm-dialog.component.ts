import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DialogContainerComponent } from './dialog-container.component';
import { DialogHeaderComponent } from './dialog-header.component';
import { DialogContentComponent } from './dialog-content.component';
import { DialogActionsComponent } from './dialog-actions.component';
import { ConfirmDialogData } from '../../services/dialog/dialog.service';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
  ],
  template: `
    <ui-dialog-container>
      <ui-dialog-header [title]="data.title" [showClose]="false"></ui-dialog-header>

      <ui-dialog-content>
        <p class="text-gray-600">{{ data.message }}</p>
      </ui-dialog-content>

      <ui-dialog-actions>
        @if (!data.hideCancel) {
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
            (click)="onCancel()"
          >
            {{ data.cancelText || 'Cancelar' }}
          </button>
        }
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          [class.bg-kengo-primary]="(data.confirmVariant || 'primary') === 'primary'"
          [class.hover:opacity-90]="(data.confirmVariant || 'primary') === 'primary'"
          [class.bg-red-600]="data.confirmVariant === 'danger'"
          [class.hover:bg-red-700]="data.confirmVariant === 'danger'"
          (click)="onConfirm()"
        >
          {{ data.confirmText || 'Confirmar' }}
        </button>
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
