import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const FALLBACK_IMAGE = 'assets/portadas/clinica.webp';

@Component({
  selector: 'app-mc-clinic-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clinic-hero.component.html',
  styleUrl: './clinic-hero.component.css',
})
export class MiClinicaHeroComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly address = input<string | null>(null);
  readonly phone = input<string | null>(null);

  readonly bgUrl = computed(() => `url('${this.imageUrl() ?? FALLBACK_IMAGE}')`);
}
