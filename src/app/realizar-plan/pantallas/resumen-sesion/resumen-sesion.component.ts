import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { slideUpAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-resumen-sesion',
  standalone: true,
  imports: [CommonModule],
  animations: [slideUpAnimation],
  template: `
    <div class="resumen-container">
      <!-- Título -->
      <div class="header-section" @slideUp>
        <h1 class="titulo">Tu sesión de hoy</h1>
        @if (plan()) {
          <p class="subtitulo">{{ plan()!.titulo }}</p>
        }
      </div>

      <!-- Lista de ejercicios -->
      <div class="ejercicios-list">
        @for (item of ejercicios(); track item.id; let i = $index) {
          <div class="ejercicio-card tarjeta-kengo" @slideUp>
            <div class="ejercicio-imagen">
              @if (item.ejercicio.portada) {
                <img
                  [src]="getImageUrl(item.ejercicio.portada)"
                  [alt]="item.ejercicio.nombre_ejercicio"
                />
              } @else {
                <div class="imagen-placeholder">🏋️</div>
              }
            </div>

            <div class="ejercicio-info">
              <h3 class="ejercicio-nombre">{{ item.ejercicio.nombre_ejercicio }}</h3>
              <div class="ejercicio-detalles">
                @if (item.series && item.series > 1) {
                  <span class="detalle">{{ item.series }} series</span>
                  <span class="separador">×</span>
                }
                @if (item.duracion_seg) {
                  <span class="detalle">{{ formatDuracion(item.duracion_seg) }}</span>
                } @else {
                  <span class="detalle">{{ item.repeticiones || 12 }} reps</span>
                }
              </div>
              @if (item.dias_semana && item.dias_semana.length > 0) {
                <div class="dias-semana">
                  @for (dia of item.dias_semana; track dia) {
                    <span class="dia">{{ dia }}</span>
                  }
                </div>
              }
            </div>

            <div class="ejercicio-numero">{{ i + 1 }}</div>
          </div>
        }
      </div>

      <!-- Contador y botón -->
      <div class="footer-section">
        <p class="contador">{{ ejercicios().length }} ejercicios hoy</p>

        <button
          type="button"
          class="btn-comenzar"
          (click)="comenzar.emit()"
          [disabled]="ejercicios().length === 0"
        >
          Comenzar sesión
          <span class="arrow">→</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    .resumen-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-top: 16px;
    }

    .header-section {
      text-align: center;
    }

    .titulo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px;
    }

    .subtitulo {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
    }

    .ejercicios-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ejercicio-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    .ejercicio-imagen {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      background: #f3f4f6;
    }

    .ejercicio-imagen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .imagen-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #e75c3e 0%, #efc048 100%);
    }

    .ejercicio-info {
      flex: 1;
      min-width: 0;
    }

    .ejercicio-nombre {
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ejercicio-detalles {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .separador {
      color: #d1d5db;
    }

    .dias-semana {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }

    .dia {
      padding: 2px 8px;
      background: rgba(231, 92, 62, 0.1);
      color: #e75c3e;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .ejercicio-numero {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: #9ca3af;
    }

    .footer-section {
      margin-top: auto;
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }

    .contador {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
    }

    .btn-comenzar {
      width: 100%;
      max-width: 320px;
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

    .btn-comenzar:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(231, 92, 62, 0.4);
    }

    .btn-comenzar:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-comenzar:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-comenzar .arrow {
      font-size: 1.25rem;
      transition: transform 0.2s ease;
    }

    .btn-comenzar:hover .arrow {
      transform: translateX(4px);
    }
  `,
})
export class ResumenSesionComponent {
  @Output() comenzar = new EventEmitter<void>();

  private registroService = inject(RegistroSesionService);

  readonly plan = this.registroService.planActivo;
  readonly ejercicios = computed(() => this.plan()?.items || []);

  getImageUrl(id: string): string {
    return this.registroService.getAssetUrl(id, 128, 128);
  }

  formatDuracion(segundos: number): string {
    if (segundos < 60) {
      return `${segundos} seg`;
    }
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }
}
