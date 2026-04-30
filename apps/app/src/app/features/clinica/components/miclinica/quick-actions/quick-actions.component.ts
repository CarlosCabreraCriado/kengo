import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

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

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: nombre, text });
        return;
      } catch {
        /* usuario canceló: no notificar */
        return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        this.notify.emit('Datos copiados al portapapeles');
      } catch {
        this.notify.emit('No se pudo copiar la información');
      }
    }
  }
}
