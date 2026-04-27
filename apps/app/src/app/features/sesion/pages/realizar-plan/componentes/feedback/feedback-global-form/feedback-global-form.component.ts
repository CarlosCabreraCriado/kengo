import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EscalaDolorComponent } from '../../escala-dolor/escala-dolor.component';
import { fadeAnimation } from '../../../realizar-plan.animations';

@Component({
  selector: 'app-feedback-global-form',
  standalone: true,
  imports: [FormsModule, EscalaDolorComponent],
  animations: [fadeAnimation],
  templateUrl: './feedback-global-form.component.html',
  styleUrl: './feedback-global-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackGlobalFormComponent {
  readonly dolorGlobal = input.required<number | null>();
  readonly totalEjercicios = input.required<number>();
  readonly observaciones = input.required<string>();

  readonly dolorChange = output<number>();
  readonly observacionesChange = output<string>();
  readonly cambiarAModoDetallado = output<void>();

  onDolorChange(valor: number): void {
    this.dolorChange.emit(valor);
  }

  onObservacionesChange(valor: string): void {
    this.observacionesChange.emit(valor);
  }

  onCambiarAModoDetallado(): void {
    this.cambiarAModoDetallado.emit();
  }
}
