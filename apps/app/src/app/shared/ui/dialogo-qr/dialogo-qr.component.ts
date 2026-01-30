import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  inject,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import QRCode from 'qrcode';

import { DialogContainerComponent } from '../dialog/dialog-container.component';
import { DialogHeaderComponent } from '../dialog/dialog-header.component';
import { DialogContentComponent } from '../dialog/dialog-content.component';
import { DialogActionsComponent } from '../dialog/dialog-actions.component';

@Component({
  standalone: true,
  imports: [
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
  ],
  selector: 'app-qr-dialog',
  template: `
    <ui-dialog-container>
      <ui-dialog-header title="Acceso con QR" (closeClick)="close()"></ui-dialog-header>

      <ui-dialog-content>
        <div class="flex flex-col items-center gap-3">
          <canvas #canvas width="256" height="256"></canvas>
          <p class="text-sm text-gray-500 text-center">
            Escanea este código para acceder
          </p>
        </div>
      </ui-dialog-content>

      <ui-dialog-actions align="center">
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          (click)="close()"
        >
          Cerrar
        </button>
      </ui-dialog-actions>
    </ui-dialog-container>
  `,
})
export class QrDialogComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private dialogRef = inject(DialogRef);
  data = inject<{ url: string }>(DIALOG_DATA);

  async ngOnInit() {
    await QRCode.toCanvas(this.canvas.nativeElement, this.data.url, {
      errorCorrectionLevel: 'M',
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
