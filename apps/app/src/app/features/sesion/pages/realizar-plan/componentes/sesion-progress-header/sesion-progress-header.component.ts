import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type SesionProgressHeaderVariant = 'plain' | 'overlay';

@Component({
  selector: 'app-sesion-progress-header',
  standalone: true,
  templateUrl: './sesion-progress-header.component.html',
  styleUrl: './sesion-progress-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.overlay]': "variant() === 'overlay'",
    '[class.plain]': "variant() === 'plain'",
    '[class.scrolled]': 'scrolled()',
  },
})
export class SesionProgressHeaderComponent {
  readonly ejercicioIndex = input.required<number>();
  readonly totalEjercicios = input.required<number>();
  readonly progresoPct = input.required<number>();
  readonly variant = input<SesionProgressHeaderVariant>('plain');
  readonly scrolled = input(false);

  readonly salir = output<void>();

  onSalir(event: Event): void {
    event.stopPropagation();
    this.salir.emit();
  }
}
