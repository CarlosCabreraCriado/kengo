import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { celebrateAnimation, fadeAnimation, slideUpAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-sesion-completada',
  standalone: true,
  imports: [CommonModule],
  animations: [celebrateAnimation, fadeAnimation, slideUpAnimation],
  template: `
    <div class="completada-container">
      <!-- Celebración -->
      <div class="celebracion-section" @celebrate>
        <div class="emoji-grande">🎉</div>
        <h1 class="titulo">¡Sesión completada!</h1>
        <p class="subtitulo">Has terminado todos los ejercicios de hoy</p>
      </div>

      <!-- Estadísticas -->
      <div class="stats-section" @slideUp>
        <div class="stat-card tarjeta-kengo">
          <div class="stat-row">
            <span class="stat-icon">⏱️</span>
            <div class="stat-info">
              <span class="stat-label">Tiempo total</span>
              <span class="stat-valor">{{ tiempoFormateado() }}</span>
            </div>
          </div>
        </div>

        <div class="stat-card tarjeta-kengo">
          <div class="stat-row">
            <span class="stat-icon">✓</span>
            <div class="stat-info">
              <span class="stat-label">Ejercicios</span>
              <span class="stat-valor">{{ totalEjercicios() }}/{{ totalEjercicios() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen de dolor por ejercicio -->
      @if (registros().length > 0) {
        <div class="resumen-section" @fadeAnimation>
          <h3 class="resumen-titulo">Resumen de dolor</h3>
          <div class="resumen-list">
            @for (registro of registrosConNombre(); track registro.plan_item) {
              <div class="resumen-item tarjeta-kengo">
                <span class="item-nombre">{{ registro.nombre }}</span>
                <div class="item-dolor">
                  <span class="dolor-valor" [style.color]="getDolorColor(registro.dolor_escala || 0)">
                    {{ registro.dolor_escala }}/10
                  </span>
                  <span class="dolor-emoji">{{ getDolorEmoji(registro.dolor_escala || 0) }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Mensaje motivacional -->
      <div class="mensaje-section" @fade>
        <p class="mensaje">
          Tu fisioterapeuta verá tu progreso y podrá ajustar tu plan según tus resultados.
        </p>
      </div>

      <!-- Botón volver -->
      <div class="action-section">
        <button
          type="button"
          class="btn-volver"
          (click)="volverInicio.emit()"
        >
          Volver al inicio
        </button>
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

    .completada-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      gap: 16px;
      padding: 8px 0;
      overflow: hidden;
    }

    .celebracion-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      text-align: center;
      flex-shrink: 0;
    }

    .emoji-grande {
      font-size: 3.5rem;
      line-height: 1;
      animation: bounce 1s ease-in-out;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-20px);
      }
      50% {
        transform: translateY(-10px);
      }
      70% {
        transform: translateY(-5px);
      }
    }

    .titulo {
      font-size: 1.625rem;
      font-weight: 800;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0;
    }

    .subtitulo {
      font-size: 0.9375rem;
      color: #6b7280;
      margin: 0;
      font-weight: 500;
    }

    .stats-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      flex-shrink: 0;
    }

    .stat-card {
      padding: 14px 12px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 14px;
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.06),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.1),
        inset 0 0 0 1px rgba(255, 255, 255, 0.7);
    }

    .stat-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .stat-icon {
      font-size: 1.5rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 0.6875rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }

    .stat-valor {
      font-size: 1.125rem;
      font-weight: 700;
      color: #1f2937;
    }

    .resumen-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .resumen-titulo {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #374151;
      margin: 0;
      padding-left: 4px;
      flex-shrink: 0;
    }

    .resumen-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    .resumen-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 12px;
      box-shadow:
        0 2px 12px rgba(0, 0, 0, 0.04),
        inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      transition: all 0.3s ease;
      flex-shrink: 0;
    }

    .resumen-item:hover {
      transform: translateX(4px);
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.08),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .item-nombre {
      font-size: 0.9375rem;
      color: #374151;
      font-weight: 500;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 16px;
    }

    .item-dolor {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .dolor-valor {
      font-size: 0.9375rem;
      font-weight: 700;
    }

    .dolor-emoji {
      font-size: 1.375rem;
    }

    .mensaje-section {
      flex-shrink: 0;
    }

    .mensaje {
      font-size: 0.8125rem;
      color: #6b7280;
      text-align: center;
      margin: 0;
      line-height: 1.5;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 12px;
    }

    .action-section {
      flex-shrink: 0;
      padding-top: 8px;
    }

    .btn-volver {
      width: 100%;
      padding: 18px 32px;
      border: none;
      border-radius: 18px;
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
      color: white;
      font-size: 1.0625rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 28px rgba(31, 41, 55, 0.25);
    }

    .btn-volver:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 36px rgba(31, 41, 55, 0.35);
    }

    .btn-volver:active {
      transform: translateY(-1px);
    }
  `,
})
export class SesionCompletadaComponent {
  @Output() volverInicio = new EventEmitter<void>();

  private registroService = inject(RegistroSesionService);

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
      const item = plan?.items?.find((i) => i.id === reg.plan_item);
      return {
        ...reg,
        nombre: item?.ejercicio?.nombre_ejercicio || 'Ejercicio',
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
    return colores[dolor] || '#6b7280';
  }

  getDolorEmoji(dolor: number): string {
    if (dolor <= 2) return '😊';
    if (dolor <= 4) return '🙂';
    if (dolor <= 6) return '😐';
    if (dolor <= 8) return '😣';
    return '😖';
  }
}
