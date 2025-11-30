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
    .completada-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 16px 0;
      min-height: 70vh;
    }

    .celebracion-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 0;
      text-align: center;
    }

    .emoji-grande {
      font-size: 4rem;
      line-height: 1;
    }

    .titulo {
      font-size: 1.75rem;
      font-weight: 800;
      color: #1f2937;
      margin: 0;
    }

    .subtitulo {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
    }

    .stats-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .stat-card {
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 16px;
    }

    .stat-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stat-icon {
      font-size: 1.5rem;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-valor {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
    }

    .resumen-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .resumen-titulo {
      font-size: 1rem;
      font-weight: 600;
      color: #374151;
      margin: 0;
    }

    .resumen-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .resumen-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 12px;
    }

    .item-nombre {
      font-size: 0.875rem;
      color: #374151;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 12px;
    }

    .item-dolor {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .dolor-valor {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .dolor-emoji {
      font-size: 1.25rem;
    }

    .mensaje-section {
      padding: 16px 0;
    }

    .mensaje {
      font-size: 0.875rem;
      color: #6b7280;
      text-align: center;
      margin: 0;
      line-height: 1.6;
    }

    .action-section {
      margin-top: auto;
      padding-top: 16px;
    }

    .btn-volver {
      width: 100%;
      padding: 18px 32px;
      border: none;
      border-radius: 16px;
      background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
      color: white;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 8px 24px rgba(31, 41, 55, 0.2);
    }

    .btn-volver:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(31, 41, 55, 0.3);
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
