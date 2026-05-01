import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ShareService } from '../../../../../core/services/share.service';
import { ClipboardService } from '../../../../../core/services/clipboard.service';

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
  readonly direccion = input<string | null>(null);
  readonly nombreClinica = input<string>('');

  readonly notify = output<string>();

  private readonly share = inject(ShareService);
  private readonly clipboard = inject(ClipboardService);

  readonly mapaUrl = computed(() => {
    const dir = this.direccion();
    if (!dir) return null;
    return `https://maps.google.com/?q=${encodeURIComponent(dir)}`;
  });

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
