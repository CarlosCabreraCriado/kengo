import {
  Component,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { EscalaDolorComponent } from '../../componentes/escala-dolor/escala-dolor.component';
import { checkmarkAnimation, fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-feedback-ejercicio',
  standalone: true,
  imports: [CommonModule, FormsModule, EscalaDolorComponent],
  animations: [checkmarkAnimation, fadeAnimation],
  template: `
    <div class="feedback-container">
      <!-- Checkmark animado -->
      <div class="check-section" @checkmark>
        <div class="check-circle">
          <span class="check-icon">✓</span>
        </div>
        <h2 class="check-titulo">¡Ejercicio completado!</h2>
        <p class="ejercicio-nombre">{{ nombreEjercicio() }}</p>
      </div>

      <!-- Escala de dolor -->
      <div class="dolor-section" @fade>
        <app-escala-dolor
          label="¿Sentiste dolor durante el ejercicio?"
          [valor]="dolorSeleccionado()"
          (valorChange)="onDolorChange($event)"
        />
      </div>

      <!-- Notas opcionales -->
      <div class="notas-section" @fade>
        <label class="notas-label" for="notas">Notas (opcional)</label>
        <textarea
          id="notas"
          class="notas-textarea"
          placeholder="Ej: Sentí molestia en la rodilla derecha..."
          rows="3"
          [(ngModel)]="nota"
        ></textarea>
      </div>

      <!-- Botón continuar -->
      <div class="action-section">
        <button
          type="button"
          class="btn-continuar"
          [disabled]="dolorSeleccionado() === null"
          (click)="onEnviar()"
        >
          @if (esUltimoEjercicio()) {
            Finalizar sesión
          } @else {
            Siguiente ejercicio
          }
          <span class="arrow">→</span>
        </button>

        @if (dolorSeleccionado() === null) {
          <p class="hint">Selecciona un nivel de dolor para continuar</p>
        }
      </div>
    </div>
  `,
  styles: `
    .feedback-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
      padding-top: 16px;
    }

    .check-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
    }

    .check-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
    }

    .check-icon {
      font-size: 2.5rem;
      color: white;
    }

    .check-titulo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .ejercicio-nombre {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
    }

    .dolor-section {
      padding: 0 8px;
    }

    .notas-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .notas-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .notas-textarea {
      width: 100%;
      padding: 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 1rem;
      font-family: inherit;
      resize: none;
      transition: all 0.2s ease;
      background: white;
    }

    .notas-textarea:focus {
      outline: none;
      border-color: #e75c3e;
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.1);
    }

    .notas-textarea::placeholder {
      color: #9ca3af;
    }

    .action-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      margin-top: auto;
      padding-top: 16px;
    }

    .btn-continuar {
      width: 100%;
      padding: 18px 32px;
      border: none;
      border-radius: 16px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      color: white;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s ease;
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.3);
    }

    .btn-continuar:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(231, 92, 62, 0.4);
    }

    .btn-continuar:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-continuar .arrow {
      font-size: 1.25rem;
      transition: transform 0.2s ease;
    }

    .btn-continuar:hover:not(:disabled) .arrow {
      transform: translateX(4px);
    }

    .hint {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0;
    }
  `,
})
export class FeedbackEjercicioComponent {
  @Output() enviarFeedback = new EventEmitter<{ dolor: number; nota?: string }>();

  private registroService = inject(RegistroSesionService);

  readonly esUltimoEjercicio = this.registroService.esUltimoEjercicio;
  readonly nombreEjercicio = computed(
    () => this.registroService.ejercicioActual()?.ejercicio?.nombre_ejercicio || ''
  );

  readonly dolorSeleccionado = signal<number | null>(null);
  nota = '';

  onDolorChange(valor: number): void {
    this.dolorSeleccionado.set(valor);
  }

  onEnviar(): void {
    const dolor = this.dolorSeleccionado();
    if (dolor === null) return;

    this.enviarFeedback.emit({
      dolor,
      nota: this.nota.trim() || undefined,
    });

    // Resetear para el próximo ejercicio
    this.dolorSeleccionado.set(null);
    this.nota = '';
  }
}
