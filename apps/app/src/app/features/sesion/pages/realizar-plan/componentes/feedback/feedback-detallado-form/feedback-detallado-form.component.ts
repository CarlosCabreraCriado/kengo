import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EscalaDolorComponent } from '../../escala-dolor/escala-dolor.component';
import {
  Ui2CardComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
  Ui2SectionLabelComponent,
  Ui2TextareaComponent,
} from '../../../../../../../shared/ui-v2';
import { fadeAnimation } from '../../../realizar-plan.animations';

export interface EjercicioFeedback {
  planItemId: string;
  nombre: string;
}

@Component({
  selector: 'app-feedback-detallado-form',
  standalone: true,
  imports: [
    FormsModule,
    EscalaDolorComponent,
    Ui2CardComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
    Ui2SectionLabelComponent,
    Ui2TextareaComponent,
  ],
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

  // Mapping a tonos semánticos coherente con escala-dolor
  private readonly dolorColores: Record<number, string> = {
    0: '#22c55e',
    1: '#34d399',
    2: '#5eead4',
    3: '#a3e635',
    4: '#facc15',
    5: '#f59e0b',
    6: '#fb923c',
    7: '#f97316',
    8: '#ef4444',
    9: '#dc2626',
    10: '#b91c1c',
  };

  getDolorColor(dolor: number): string {
    return this.dolorColores[dolor] || 'var(--ink-500)';
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
