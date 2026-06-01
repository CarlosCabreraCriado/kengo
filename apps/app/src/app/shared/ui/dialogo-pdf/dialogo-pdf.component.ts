import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
} from '../../ui-v2';
import { ToastService } from '../../services/toast';
import { ConvexService } from '../../../core/convex/convex.service';
import { ExternalBrowserService } from '../../../core/services/external-browser.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { SubscriptionService } from '../../../core/billing/subscription.service';
import { api } from '../../../../../../../convex/_generated/api';

export interface DialogoPdfData {
  planConvexId: string;
  pacienteEmail?: string;
  planTitulo?: string;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
  ],
  selector: 'app-dialogo-pdf',
  templateUrl: './dialogo-pdf.component.html',
  styleUrl: './dialogo-pdf.component.css',
})
export class DialogoPdfComponent {
  private convex = inject(ConvexService);
  private dialogRef = inject(DialogRef);
  private toast = inject(ToastService);
  private externalBrowser = inject(ExternalBrowserService);
  private session = inject(SessionService);
  private subs = inject(SubscriptionService);
  data = inject<DialogoPdfData>(DIALOG_DATA);

  descargando = signal(false);
  imprimiendo = signal(false);
  enviando = signal(false);
  emailEnviado = signal(false);
  mostrarEmailForm = signal(false);
  emailDestino = signal(this.data.pacienteEmail ?? '');

  accionEnProgreso = computed(
    () => this.descargando() || this.imprimiendo() || this.enviando()
  );

  /**
   * El envío por email es una operación de comunicación con el paciente: se
   * bloquea si el fisio no tiene suscripción activa. Descarga e impresión
   * locales siguen disponibles.
   */
  bloqueoEnvio = computed(
    () => this.session.enModoFisio() && this.subs.bloqueada(),
  );

  private async generar(): Promise<{ url: string | null; filename: string } | null> {
    const res = await this.convex.action(api.pdf.actions.generatePlanPdf, {
      planId: this.data.planConvexId as any,
    });
    if (!res?.url) return null;
    return { url: res.url, filename: res.filename };
  }

  async descargar() {
    if (this.accionEnProgreso()) return;
    this.descargando.set(true);

    try {
      const res = await this.generar();
      if (!res) throw new Error('no url');

      const response = await fetch(res.url!);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = res.filename;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      this.toast.error('Error al descargar el PDF');
    } finally {
      this.descargando.set(false);
    }
  }

  async imprimir() {
    if (this.accionEnProgreso()) return;
    this.imprimiendo.set(true);

    try {
      const res = await this.generar();
      if (!res) throw new Error('no url');

      const response = await fetch(res.url!);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await this.externalBrowser.open(blobUrl);
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(blobUrl);
          }, 1000);
        };
      }
    } catch {
      this.toast.error('Error al preparar la impresion');
    } finally {
      this.imprimiendo.set(false);
    }
  }

  mostrarFormEmail() {
    if (this.accionEnProgreso()) return;
    this.mostrarEmailForm.set(true);
  }

  cancelarEmail() {
    this.mostrarEmailForm.set(false);
  }

  onEmailInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.emailDestino.set(input.value);
  }

  async enviarEmail() {
    const email = this.emailDestino().trim();
    if (!email || this.accionEnProgreso()) return;

    this.enviando.set(true);

    try {
      const res = await this.convex.action(
        api.pdf.actions.generateAndSendPlanPdf,
        { planId: this.data.planConvexId as any, email },
      );
      if (!res.ok) throw new Error('send failed');
      this.emailEnviado.set(true);
      this.mostrarEmailForm.set(false);
      this.toast.success('PDF enviado correctamente');
    } catch {
      this.toast.error('Error al enviar el PDF por correo');
    } finally {
      this.enviando.set(false);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
