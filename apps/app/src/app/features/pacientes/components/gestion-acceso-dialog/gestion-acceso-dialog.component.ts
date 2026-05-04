import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';

import { ConfirmDialogComponent, DialogService } from '../../../../shared';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2PillComponent,
  Ui2SpinnerComponent,
  Ui2IconBadgeComponent,
} from '../../../../shared/ui-v2';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ClipboardService } from '../../../../core/services/clipboard.service';

import type { Usuario } from '../../../../../types/global';

interface DialogData {
  paciente: Usuario;
}

interface TokenInfo {
  id: string;
  url: string;
  usosActuales: number;
  usosMaximos: number | null;
  ultimoUso: string | null;
  activo: boolean;
  dateCreated: string;
}

@Component({
  selector: 'app-gestion-acceso-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2PillComponent,
    Ui2SpinnerComponent,
    Ui2IconBadgeComponent,
  ],
  templateUrl: './gestion-acceso-dialog.component.html',
  styleUrl: './gestion-acceso-dialog.component.css',
})
export class GestionAccesoDialogComponent implements OnInit {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;

  private authService = inject(AuthService);
  private dialogRef = inject(DialogRef);
  private dialogService = inject(DialogService);
  private clipboard = inject(ClipboardService);
  data = inject<DialogData>(DIALOG_DATA);

  // State
  readonly tokenInfo = signal<TokenInfo | null>(null);
  readonly isLoadingToken = signal(true);
  readonly isSendingEmail = signal(false);
  readonly isRegenerating = signal(false);
  readonly emailSent = signal(false);
  readonly linkCopied = signal(false);
  readonly error = signal<string | null>(null);

  get paciente() {
    return this.data.paciente;
  }

  async ngOnInit() {
    await this.cargarTokenActivo();
  }

  async cargarTokenActivo() {
    this.isLoadingToken.set(true);
    this.error.set(null);

    try {
      const response = await this.authService.listarTokensAcceso(
        this.paciente.id,
      );

      const tokenActivo = response.data?.find((t) => t.activo);

      if (tokenActivo) {
        this.tokenInfo.set({
          id: tokenActivo.id,
          url: tokenActivo.url,
          usosActuales: tokenActivo.usosActuales,
          usosMaximos: tokenActivo.usosMaximos,
          ultimoUso: tokenActivo.ultimoUso,
          activo: tokenActivo.activo,
          dateCreated: tokenActivo.dateCreated,
        });

        setTimeout(() => this.generarQR(tokenActivo.url), 100);
      } else {
        await this.crearNuevoToken();
      }
    } catch (err) {
      console.error('Error cargando token:', err);
      this.error.set('Error al cargar información de acceso');
    } finally {
      this.isLoadingToken.set(false);
    }
  }

  private async crearNuevoToken(): Promise<void> {
    try {
      const response = await this.authService.crearTokenAcceso(
        this.paciente.id,
      );

      this.tokenInfo.set({
        id: response.id,
        url: response.url,
        usosActuales: 0,
        usosMaximos: null,
        ultimoUso: null,
        activo: true,
        dateCreated: new Date().toISOString(),
      });

      setTimeout(() => this.generarQR(response.url), 100);
    } catch (err) {
      console.error('Error creando token:', err);
      throw err;
    }
  }

  private async generarQR(url: string) {
    if (!url || !this.qrCanvas?.nativeElement) return;

    try {
      await QRCode.toCanvas(this.qrCanvas.nativeElement, url, {
        errorCorrectionLevel: 'M',
        width: 200,
        margin: 2,
      });
    } catch (err) {
      console.error('Error generando QR:', err);
    }
  }

  async enviarPorEmail() {
    if (this.isSendingEmail()) return;

    this.isSendingEmail.set(true);
    this.error.set(null);
    this.emailSent.set(false);

    try {
      await this.authService.enviarTokenPorEmail(this.paciente.id);
      this.emailSent.set(true);
      setTimeout(() => this.emailSent.set(false), 3000);
    } catch (err: any) {
      console.error('Error enviando email:', err);
      this.error.set(err?.message || 'Error al enviar el email');
    } finally {
      this.isSendingEmail.set(false);
    }
  }

  async copiarEnlace() {
    const token = this.tokenInfo();
    if (!token?.url) return;

    const ok = await this.clipboard.write(token.url);
    if (ok) {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } else {
      this.error.set('Error al copiar el enlace');
    }
  }

  async regenerarToken() {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      data: {
        title: 'Regenerar token',
        message: 'El token actual dejará de funcionar y se generará uno nuevo. El paciente necesitará el nuevo enlace o QR para acceder.',
        confirmText: 'Regenerar',
        cancelText: 'Cancelar',
        variant: 'warning',
      },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result) {
      await this.ejecutarRegeneracion();
    }
  }

  private async ejecutarRegeneracion() {
    if (this.isRegenerating()) return;

    this.isRegenerating.set(true);
    this.error.set(null);

    try {
      const tokenActual = this.tokenInfo();

      if (tokenActual?.id) {
        await this.authService.revocarTokenAcceso(tokenActual.id);
      }

      await this.crearNuevoToken();
    } catch (err: any) {
      console.error('Error regenerando token:', err);
      this.error.set(err?.message || 'Error al regenerar el token');
    } finally {
      this.isRegenerating.set(false);
    }
  }

  formatearUltimoUso(fecha: string | null): string {
    if (!fecha) return 'Nunca';

    const d = new Date(fecha);
    const ahora = new Date();
    const diffMs = ahora.getTime() - d.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Ayer';
    if (diffDias < 7) return `Hace ${diffDias} días`;
    if (diffDias < 30) return `Hace ${Math.floor(diffDias / 7)} semanas`;

    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  close() {
    this.dialogRef.close();
  }
}
