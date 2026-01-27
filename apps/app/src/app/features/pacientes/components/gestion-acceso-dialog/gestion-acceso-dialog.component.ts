import {
  Component,
  inject,
  signal,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';
import { environment as env } from '../../../../../environments/environment';

import {
  DialogContainerComponent,
  DialogHeaderComponent,
  DialogContentComponent,
  DialogActionsComponent,
  ConfirmDialogComponent,
  DialogService,
} from '../../../../shared';

import type { Usuario } from '../../../../../types/global';

interface DialogData {
  paciente: Usuario;
}

interface TokenInfo {
  id: string;
  url: string;
  usos_actuales: number;
  usos_maximos: number | null;
  ultimo_uso: string | null;
  activo: boolean;
  date_created: string;
}

interface TokensResponse {
  data: {
    id: string;
    tokenPreview: string;
    usos_actuales: number;
    usos_maximos: number | null;
    fecha_expiracion: string | null;
    date_created: string;
    ultimo_uso: string | null;
    activo: boolean;
  }[];
}

interface CreateTokenResponse {
  id: string;
  url: string;
}

@Component({
  selector: 'app-gestion-acceso-dialog',
  standalone: true,
  imports: [
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
  ],
  templateUrl: './gestion-acceso-dialog.component.html',
  styleUrl: './gestion-acceso-dialog.component.css',
})
export class GestionAccesoDialogComponent implements OnInit {
  @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;

  private http = inject(HttpClient);
  private dialogRef = inject(DialogRef);
  private dialogService = inject(DialogService);
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
      // Obtener tokens del usuario
      const response = await firstValueFrom(
        this.http.get<TokensResponse>(
          `${env.API_URL}/usuario/${this.paciente.id}/tokens-acceso`,
          { withCredentials: true }
        )
      );

      const tokenActivo = response.data?.find((t) => t.activo);

      if (tokenActivo) {
        // Construir URL del token (la preview no tiene el token completo por seguridad)
        // Usamos la magic_link_url del paciente si está disponible
        const url = this.paciente.magic_link_url || '';

        this.tokenInfo.set({
          id: tokenActivo.id,
          url,
          usos_actuales: tokenActivo.usos_actuales,
          usos_maximos: tokenActivo.usos_maximos,
          ultimo_uso: tokenActivo.ultimo_uso,
          activo: tokenActivo.activo,
          date_created: tokenActivo.date_created,
        });

        // Generar QR después de establecer tokenInfo
        setTimeout(() => this.generarQR(url), 100);
      } else {
        // No hay token activo, crear uno nuevo
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
      const response = await firstValueFrom(
        this.http.post<CreateTokenResponse>(
          `${env.API_URL}/usuario/token-acceso`,
          { idUsuario: this.paciente.id },
          { withCredentials: true }
        )
      );

      this.tokenInfo.set({
        id: response.id,
        url: response.url,
        usos_actuales: 0,
        usos_maximos: null,
        ultimo_uso: null,
        activo: true,
        date_created: new Date().toISOString(),
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
      await firstValueFrom(
        this.http.post(
          `${env.API_URL}/usuario/${this.paciente.id}/token-acceso/enviar-email`,
          {},
          { withCredentials: true }
        )
      );

      this.emailSent.set(true);

      // Reset el mensaje de éxito después de 3 segundos
      setTimeout(() => this.emailSent.set(false), 3000);
    } catch (err: any) {
      console.error('Error enviando email:', err);
      this.error.set(err.error?.error || 'Error al enviar el email');
    } finally {
      this.isSendingEmail.set(false);
    }
  }

  async copiarEnlace() {
    const token = this.tokenInfo();
    if (!token?.url) return;

    try {
      await navigator.clipboard.writeText(token.url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch (err) {
      console.error('Error copiando enlace:', err);
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

      // Revocar token actual si existe
      if (tokenActual?.id) {
        await firstValueFrom(
          this.http.delete(
            `${env.API_URL}/usuario/token-acceso/${tokenActual.id}`,
            { withCredentials: true }
          )
        );
      }

      // Crear nuevo token
      await this.crearNuevoToken();
    } catch (err: any) {
      console.error('Error regenerando token:', err);
      this.error.set(err.error?.error || 'Error al regenerar el token');
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
