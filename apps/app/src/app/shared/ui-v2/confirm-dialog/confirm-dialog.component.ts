import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { Ui2ButtonComponent } from '../button/button.component';
import {
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../dialog/dialog.component';
import type { ConfirmDialogData } from '../../services/dialog';

/**
 * Diálogo de confirmación reutilizable. Abierto vía `DialogService.confirm(data)`.
 * Variant `compact`: ancho 420px máx., sin botón X del header (los botones de
 * actions cierran).
 */
@Component({
  selector: 'ui2-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2ButtonComponent,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
  ],
  template: `
    <ui2-dialog-host variant="compact">
      <ui2-dialog-header [title]="data.title" [showClose]="false"></ui2-dialog-header>

      <ui2-dialog-content>
        <p class="ui2-confirm-message">{{ data.message }}</p>
      </ui2-dialog-content>

      <ui2-dialog-actions>
        @if (!data.hideCancel) {
          <ui2-button variant="secondary" (clicked)="onCancel()">
            {{ data.cancelText || 'Cancelar' }}
          </ui2-button>
        }
        <ui2-button [variant]="confirmVariant()" (clicked)="onConfirm()">
          {{ data.confirmText || 'Confirmar' }}
        </ui2-button>
      </ui2-dialog-actions>
    </ui2-dialog-host>
  `,
  styles: [`
    .ui2-confirm-message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--ink-700);
      margin: 0;
    }
  `],
})
export class Ui2ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  readonly confirmVariant = computed<'primary' | 'danger'>(
    () => this.data.confirmVariant === 'danger' ? 'danger' : 'primary',
  );

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
