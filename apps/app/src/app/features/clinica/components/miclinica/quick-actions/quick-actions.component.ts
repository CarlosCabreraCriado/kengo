import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ShareService } from '../../../../../core/services/share.service';
import { ClipboardService } from '../../../../../core/services/clipboard.service';
import { DialogService } from '../../../../../shared/services/dialog/dialog.service';

@Component({
  selector: 'app-mc-quick-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.css',
})
export class MiClinicaQuickActionsComponent {
  readonly phone = input<string | null>(null);
  readonly email = input<string | null>(null);
  readonly web = input<string | null>(null);
  readonly direccion = input<string | null>(null);
  readonly nombreClinica = input<string>('');

  readonly notify = output<string>();

  private readonly share = inject(ShareService);
  private readonly clipboard = inject(ClipboardService);
  private readonly dialogService = inject(DialogService);

  readonly mapaUrl = computed(() => {
    const dir = this.direccion();
    if (!dir) return null;
    return `https://maps.google.com/?q=${encodeURIComponent(dir)}`;
  });

  /** Normaliza la URL añadiendo `https://` si el usuario no lo introdujo. */
  readonly webUrl = computed(() => {
    const raw = this.web()?.trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  });

  onWebNoDisponible(): void {
    void this.dialogService.confirm({
      title: 'Web no disponible',
      message: 'El enlace a la web no está disponible para esta clínica.',
      confirmText: 'Entendido',
      hideCancel: true,
    });
  }

  async compartir(): Promise<void> {
    const dir = this.direccion();
    const tel = this.phone();
    const mail = this.email();
    const nombre = this.nombreClinica();
    const lineas = [nombre, dir, tel, mail].filter(Boolean);
    const text = lineas.join(' · ');

    if (this.share.isAvailable) {
      const shared = await this.share.share({ title: nombre, text });
      if (shared) return;
    }

    const copied = await this.clipboard.write(text);
    this.notify.emit(copied ? 'Datos copiados al portapapeles' : 'No se pudo copiar la información');
  }
}
