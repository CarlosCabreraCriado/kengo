import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';

import { DialogContainerComponent } from '../dialog/dialog-container.component';
import { DialogHeaderComponent } from '../dialog/dialog-header.component';
import { DialogContentComponent } from '../dialog/dialog-content.component';
import { ToastService } from '../toast';
import { environment as env } from '../../../../environments/environment';

export interface DialogoPdfData {
  planId: number;
  pacienteEmail?: string;
  planTitulo?: string;
}

@Component({
  standalone: true,
  imports: [
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
  ],
  selector: 'app-dialogo-pdf',
  templateUrl: './dialogo-pdf.component.html',
  styleUrl: './dialogo-pdf.component.css',
})
export class DialogoPdfComponent {
  private http = inject(HttpClient);
  private dialogRef = inject(DialogRef);
  private toast = inject(ToastService);
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

  async descargar() {
    if (this.accionEnProgreso()) return;
    this.descargando.set(true);

    try {
      const response = await firstValueFrom(
        this.http.get(`${env.API_URL}/plan/${this.data.planId}/pdf`, {
          responseType: 'blob',
          observe: 'response',
          withCredentials: true,
        })
      );

      if (response.body) {
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `plan_${this.data.planId}.pdf`;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
          if (match?.[1]) {
            filename = match[1];
          }
        }

        const blob = new Blob([response.body], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      }
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
      const response = await firstValueFrom(
        this.http.get(`${env.API_URL}/plan/${this.data.planId}/pdf`, {
          responseType: 'blob',
          withCredentials: true,
        })
      );

      const blob = new Blob([response], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);

      // En móvil, abrir en nueva pestaña para imprimir desde el navegador
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.open(blobUrl);
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
      await firstValueFrom(
        this.http.post(
          `${env.API_URL}/plan/${this.data.planId}/pdf/enviar`,
          { email },
          { withCredentials: true }
        )
      );
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
