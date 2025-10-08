import {
  Component,
  ElementRef,
  Inject,
  ViewChild,
  OnInit,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import QRCode from 'qrcode';

import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  selector: 'app-qr-dialog',
  template: `
    <h2 class="m-0 text-lg font-medium">Acceso con QR</h2>
    <div class="flex flex-col items-center gap-3 p-4">
      <canvas #canvas width="256" height="256"></canvas>
    </div>

    <div class="flex justify-center p-3 pt-0">
      <button mat-flat-button color="primary" mat-dialog-close>Cerrar</button>
    </div>
  `,
})
export class QrDialogComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  constructor(@Inject(MAT_DIALOG_DATA) public data: { url: string }) {}
  async ngOnInit() {
    await QRCode.toCanvas(this.canvas.nativeElement, this.data.url, {
      errorCorrectionLevel: 'M',
    });
  }
}
