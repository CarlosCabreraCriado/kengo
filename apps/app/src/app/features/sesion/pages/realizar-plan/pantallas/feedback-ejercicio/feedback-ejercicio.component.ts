import {
  Component,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import { EscalaDolorComponent } from '../../componentes/escala-dolor/escala-dolor.component';
import { checkmarkAnimation, fadeAnimation } from '../../realizar-plan.animations';
import {
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2ProgressBarComponent,
  Ui2TextareaComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-feedback-ejercicio',
  standalone: true,
  imports: [
    FormsModule,
    EscalaDolorComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2ProgressBarComponent,
    Ui2TextareaComponent,
  ],
  animations: [checkmarkAnimation, fadeAnimation],
  template: `
    <div class="feedback-ejercicio-container">
      <!-- Indicador de progreso -->
      <div class="progress-row">
        <span class="progress-counter">
          {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
        </span>
        <div class="progress-bar-wrapper">
          <ui2-progress-bar
            [value]="progresoSesion()"
            size="sm"
            color="primary"
          />
        </div>
      </div>

      <!-- Checkmark animado -->
      <div class="celebracion" @checkmark>
        <div class="checkmark-circle">
          <span class="material-symbols-outlined" aria-hidden="true">check</span>
        </div>
        <h2 class="celebracion-title">¡Ejercicio completado!</h2>
        <p class="celebracion-sub">{{ nombreEjercicio() }}</p>
      </div>

      <!-- Escala de dolor -->
      <div class="escala-wrapper" @fade>
        <app-escala-dolor
          label="¿Sentiste dolor durante el ejercicio?"
          [valor]="dolorSeleccionado()"
          (valorChange)="onDolorChange($event)"
        />
      </div>

      <!-- Notas opcionales -->
      <div class="notas-wrapper" @fade>
        <ui2-card [padding]="14">
          <ui2-textarea
            label="Notas (opcional)"
            placeholder="Ej: Sentí molestia en la rodilla derecha..."
            [rows]="3"
            [(ngModel)]="nota"
          />
        </ui2-card>
      </div>

      <!-- Botón continuar -->
      <div class="cta-wrapper">
        <ui2-button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          [fullWidth]="true"
          [disabled]="dolorSeleccionado() === null"
          (clicked)="onEnviar()"
        >
          @if (esUltimoEjercicio()) {
            Finalizar sesión
          } @else {
            Siguiente ejercicio
          }
        </ui2-button>

        @if (dolorSeleccionado() === null) {
          <p class="hint">
            Selecciona un nivel de dolor para continuar
          </p>
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
      background: var(--cream-50);
    }

    .feedback-ejercicio-container {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      padding: 12px 20px;
    }

    .progress-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 6px 0;
    }

    .progress-counter {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 14px;
      color: var(--ink-700);
      line-height: 1;
    }

    .progress-bar-wrapper {
      width: 120px;
    }

    .celebracion {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      flex-shrink: 0;
    }

    .checkmark-circle {
      width: 72px;
      height: 72px;
      border-radius: 9999px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, var(--success), #16a34a);
      box-shadow: 0 8px 22px -6px rgba(34, 197, 94, 0.5);
      animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .checkmark-circle .material-symbols-outlined {
      font-size: 36px;
      color: white;
    }

    .celebracion-title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 22px;
      color: var(--ink-900);
      margin: 0;
      line-height: 1.1;
    }

    .celebracion-sub {
      font-size: 13px;
      color: var(--ink-500);
      margin: 0;
      font-weight: 500;
    }

    .escala-wrapper,
    .notas-wrapper {
      flex-shrink: 0;
    }

    .cta-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      padding-top: 4px;
    }

    .hint {
      margin: 0;
      padding: 8px 14px;
      border-radius: 14px;
      background: white;
      box-shadow: var(--shadow-card);
      font-size: 11px;
      font-weight: 600;
      color: var(--ink-500);
      text-align: center;
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
  `,
})
export class FeedbackEjercicioComponent {
  @Output() enviarFeedback = new EventEmitter<{ dolor: number; nota?: string }>();

  private registroService = inject(SesionStateService);

  readonly esUltimoEjercicio = this.registroService.esUltimoEjercicio;
  readonly nombreEjercicio = computed(
    () => this.registroService.ejercicioActual()?.ejercicio?.nombre || ''
  );

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

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
