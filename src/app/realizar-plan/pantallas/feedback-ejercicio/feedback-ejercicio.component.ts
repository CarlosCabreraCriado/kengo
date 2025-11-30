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
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .feedback-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      gap: 16px;
      padding-top: 8px;
      overflow-y: auto;
    }

    .check-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      flex-shrink: 0;
    }

    .check-circle {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 12px 32px rgba(16, 185, 129, 0.35),
        inset 0 0 0 4px rgba(255, 255, 255, 0.2);
      animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes pop-in {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .check-icon {
      font-size: 2rem;
      color: white;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .check-titulo {
      font-size: 1.375rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .ejercicio-nombre {
      font-size: 0.9375rem;
      color: #6b7280;
      margin: 0;
      font-weight: 500;
    }

    .dolor-section {
      flex-shrink: 0;
    }

    .notas-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0 4px;
      flex-shrink: 0;
    }

    .notas-label {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #374151;
      padding-left: 4px;
    }

    .notas-textarea {
      width: 100%;
      padding: 14px 16px;
      border: none;
      border-radius: 14px;
      font-size: 0.9375rem;
      font-family: inherit;
      resize: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.06),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
      color: #1f2937;
      line-height: 1.5;
    }

    .notas-textarea:focus {
      outline: none;
      box-shadow:
        0 8px 28px rgba(231, 92, 62, 0.12),
        inset 0 0 0 2px rgba(231, 92, 62, 0.4);
    }

    .notas-textarea::placeholder {
      color: #9ca3af;
    }

    .action-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
      padding-top: 8px;
    }

    .btn-continuar {
      width: 100%;
      padding: 18px 32px;
      border: none;
      border-radius: 18px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      color: white;
      font-size: 1.0625rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(231, 92, 62, 0.35);
    }

    .btn-continuar:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 16px 40px rgba(231, 92, 62, 0.45);
    }

    .btn-continuar:active:not(:disabled) {
      transform: translateY(-1px);
    }

    .btn-continuar:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.2);
    }

    .btn-continuar .arrow {
      font-size: 1.375rem;
      transition: transform 0.3s ease;
    }

    .btn-continuar:hover:not(:disabled) .arrow {
      transform: translateX(6px);
    }

    .hint {
      font-size: 0.8125rem;
      color: #9ca3af;
      margin: 0;
      font-weight: 500;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 12px;
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
