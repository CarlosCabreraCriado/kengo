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
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .resumen-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      gap: 16px;
      overflow: hidden;
    }

    .header-section {
      text-align: center;
      padding: 8px 0;
      flex-shrink: 0;
    }

    .titulo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 4px;
    }

    .subtitulo {
      font-size: 0.9375rem;
      color: #e75c3e;
      font-weight: 500;
      margin: 0;
    }

    .ejercicios-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 4px;
    }

    .ejercicio-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 16px;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.06),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
      position: relative;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }

    .ejercicio-card:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.1),
        inset 0 0 0 1px rgba(255, 255, 255, 0.7);
    }

    .ejercicio-imagen {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      background: #f3f4f6;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .ejercicio-imagen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .ejercicio-card:hover .ejercicio-imagen img {
      transform: scale(1.05);
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
      font-size: 0.9375rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 28px;
    }

    .ejercicio-detalles {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
    }

    .separador {
      color: #e75c3e;
      font-weight: 600;
    }

    .dias-semana {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }

    .dia {
      padding: 3px 8px;
      background: rgba(231, 92, 62, 0.1);
      color: #e75c3e;
      border-radius: 6px;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .ejercicio-numero {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6875rem;
      font-weight: 700;
      color: white;
      box-shadow: 0 2px 8px rgba(231, 92, 62, 0.3);
    }

    .footer-section {
      flex-shrink: 0;
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }

    .contador {
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
      margin: 0;
      padding: 6px 16px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 16px;
    }

    .btn-comenzar {
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

    .btn-comenzar:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 16px 40px rgba(231, 92, 62, 0.45);
    }

    .btn-comenzar:active:not(:disabled) {
      transform: translateY(-1px);
    }

    .btn-comenzar:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-comenzar .arrow {
      font-size: 1.5rem;
      transition: transform 0.3s ease;
    }

    .btn-comenzar:hover:not(:disabled) .arrow {
      transform: translateX(6px);
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
