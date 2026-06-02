import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Ui2ButtonComponent } from '../../../../../shared/ui-v2';

const FALLBACK_IMAGE = 'assets/portadas/clinica.webp';

@Component({
  selector: 'app-mc-clinic-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2ButtonComponent, NgOptimizedImage],
  templateUrl: './clinic-hero.component.html',
  styleUrl: './clinic-hero.component.css',
})
export class MiClinicaHeroComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly address = input<string | null>(null);
  readonly phone = input<string | null>(null);
  readonly puedeEditar = input<boolean>(false);

  readonly editarClinica = output<void>();

  readonly bgSrc = computed(() => this.imageUrl() ?? FALLBACK_IMAGE);
}
