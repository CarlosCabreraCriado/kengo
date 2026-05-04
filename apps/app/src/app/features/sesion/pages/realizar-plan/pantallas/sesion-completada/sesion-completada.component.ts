import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
} from '@angular/core';
import { SesionStateService } from '../../../../data-access/sesion-state.service';
import {
  celebrateAnimation,
  fadeAnimation,
  slideUpAnimation,
} from '../../realizar-plan.animations';
import {
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2KpiCardComponent,
  Ui2SectionLabelComponent,
} from '../../../../../../shared/ui-v2';

@Component({
  selector: 'app-sesion-completada',
  standalone: true,
  imports: [
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2KpiCardComponent,
    Ui2SectionLabelComponent,
  ],
  animations: [celebrateAnimation, fadeAnimation, slideUpAnimation],
  template: `
    <div class="sesion-completada-container">
      <!-- Celebración -->
      <div class="celebracion" @celebrate>
        <span class="material-symbols-outlined celebracion-icon" aria-hidden="true">celebration</span>
        <ui2-big-title
          title="¡Sesión completada!"
          sub="Has terminado todos los ejercicios de hoy"
        />
      </div>

      <!-- Estadísticas -->
      <div class="kpis" @slideUp>
        <ui2-kpi-card
          icon="schedule"
          label="Tiempo total"
          [value]="tiempoFormateado()"
        />
        <ui2-kpi-card
          icon="check_circle"
          iconColor="var(--success)"
          label="Ejercicios"
          [value]="totalEjercicios() + '/' + totalEjercicios()"
        />
      </div>

      <!-- Resumen de dolor por ejercicio -->
      @if (registros().length > 0) {
        <div class="resumen-dolor" @fade>
          <ui2-section-label color="var(--ink-700)">Resumen de dolor</ui2-section-label>
          <div class="resumen-list">
            @for (registro of registrosConNombre(); track registro.planItemId) {
              <ui2-card [padding]="14">
                <div class="resumen-row">
                  <span class="resumen-nombre">{{ registro.nombre }}</span>
                  <div class="resumen-valor">
                    <span
                      class="resumen-num"
                      [style.color]="getDolorColor(registro.dolorEscala || 0)"
                    >
                      {{ registro.dolorEscala }}/10
                    </span>
                    <span
                      class="material-symbols-outlined"
                      [style.color]="getDolorColor(registro.dolorEscala || 0)"
                      aria-hidden="true"
                    >
                      {{ getDolorIcon(registro.dolorEscala || 0) }}
                    </span>
                  </div>
                </div>
              </ui2-card>
            }
          </div>
        </div>
      }

      <!-- Mensaje motivacional -->
      <div class="motivacional" @fade>
        <ui2-card [padding]="14">
          <p class="motivacional-text">
            Tu fisioterapeuta verá tu progreso y podrá ajustar tu plan según tus
            resultados.
          </p>
        </ui2-card>
      </div>

      <!-- Botón volver -->
      <div class="cta">
        <ui2-button
          variant="primary"
          size="lg"
          iconLeft="home"
          [fullWidth]="true"
          (clicked)="volverInicio.emit()"
        >
          Volver al inicio
        </ui2-button>
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

    .sesion-completada-container {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 16px;
      padding: 12px 20px 20px;
      overflow-y: auto;
    }

    .celebracion {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      text-align: center;
      padding: 8px 0 4px;
    }

    .celebracion-icon {
      font-size: 56px;
      color: var(--kengo-primary);
      animation: bounce 1.4s ease-in-out infinite;
    }

    .kpis {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      flex-shrink: 0;
    }

    .resumen-dolor {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }

    .resumen-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    .resumen-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .resumen-nombre {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resumen-valor {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .resumen-num {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 14px;
      line-height: 1;
    }

    .resumen-valor .material-symbols-outlined {
      font-size: 22px;
    }

    .motivacional-text {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--ink-500);
      text-align: center;
    }

    .cta {
      flex-shrink: 0;
      padding-top: 4px;
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-8px);
      }
    }
  `,
})
export class SesionCompletadaComponent {
  @Output() volverInicio = new EventEmitter<void>();

  private registroService = inject(SesionStateService);

  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly registros = this.registroService.registrosSesion;

  readonly tiempoFormateado = computed(() => {
    const segundos = this.registroService.tiempoTranscurrido();
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    if (mins > 0) {
      return `${mins} min ${secs > 0 ? secs + 's' : ''}`.trim();
    }
    return `${secs} seg`;
  });

  readonly registrosConNombre = computed(() => {
    const plan = this.registroService.planActivo();
    const regs = this.registros();

    return regs.map((reg) => {
      const item = plan?.items?.find((i) => i.id === reg.planItemId);
      return {
        ...reg,
        nombre: item?.ejercicio?.nombre || 'Ejercicio',
      };
    });
  });

  getDolorColor(dolor: number): string {
    const colores: Record<number, string> = {
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
    return colores[dolor] || 'var(--ink-500)';
  }

  getDolorEmoji(dolor: number): string {
    if (dolor <= 2) return '😊';
    if (dolor <= 4) return '🙂';
    if (dolor <= 6) return '😐';
    if (dolor <= 8) return '😣';
    return '😖';
  }

  getDolorIcon(dolor: number): string {
    if (dolor <= 2) return 'sentiment_very_satisfied';
    if (dolor <= 4) return 'sentiment_satisfied';
    if (dolor <= 6) return 'sentiment_neutral';
    if (dolor <= 8) return 'sentiment_dissatisfied';
    return 'sentiment_very_dissatisfied';
  }
}
