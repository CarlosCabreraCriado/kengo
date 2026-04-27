import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EscalaDolorComponent } from '../../escala-dolor/escala-dolor.component';
import { fadeAnimation } from '../../../realizar-plan.animations';

export interface EjercicioFeedback {
  planItemId: string;
  nombre: string;
}

@Component({
  selector: 'app-feedback-detallado-form',
  standalone: true,
  imports: [FormsModule, EscalaDolorComponent],
  animations: [fadeAnimation],
  templateUrl: './feedback-detallado-form.component.html',
  styleUrl: './feedback-detallado-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackDetalladoFormComponent {
  readonly ejercicios = input.required<EjercicioFeedback[]>();
  readonly dolorPorEjercicio = input.required<Map<string, number>>();
  readonly notasPorEjercicio = input.required<Map<string, string>>();
  readonly notasExpandidas = input.required<Set<string>>();
  readonly observaciones = input.required<string>();

  readonly dolorEjercicioChange = output<{ planItemId: string; valor: number }>();
  readonly notaEjercicioChange = output<{ planItemId: string; valor: string }>();
  readonly toggleNota = output<string>();
  readonly observacionesChange = output<string>();
  readonly volverAModoSimplificado = output<void>();

  private readonly dolorColores: Record<number, string> = {
    0: '#22c55e',
    1: '#4ade80',
    2: '#86efac',
    3: '#a3e635',
    4: '#facc15',
    5: '#fbbf24',
    6: '#fb923c',
    7: '#f97316',
    8: '#ef4444',
    9: '#dc2626',
    10: '#b91c1c',
  };

  getDolorColor(dolor: number): string {
    return this.dolorColores[dolor] || '#6b7280';
  }

  onDolorChange(planItemId: string, valor: number): void {
    this.dolorEjercicioChange.emit({ planItemId, valor });
  }

  onNotaChange(planItemId: string, valor: string): void {
    this.notaEjercicioChange.emit({ planItemId, valor });
  }

  onToggleNota(planItemId: string): void {
    this.toggleNota.emit(planItemId);
  }

  onObservacionesChange(valor: string): void {
    this.observacionesChange.emit(valor);
  }

  onVolverAModoSimplificado(): void {
    this.volverAModoSimplificado.emit();
  }
}
