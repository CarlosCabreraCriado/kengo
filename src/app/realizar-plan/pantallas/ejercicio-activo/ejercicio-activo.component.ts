import { Component, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { VideoEjercicioComponent } from '../../componentes/video-ejercicio/video-ejercicio.component';
import { ContadorSeriesComponent } from '../../componentes/contador-series/contador-series.component';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-ejercicio-activo',
  standalone: true,
  imports: [
    CommonModule,
    VideoEjercicioComponent,
    ContadorSeriesComponent,
    TemporizadorComponent,
  ],
  animations: [fadeAnimation],
  template: `
    <div class="ejercicio-container">
      <!-- Video -->
      <div class="video-section">
        <app-video-ejercicio
          [videoUrl]="videoUrl()"
          [posterUrl]="posterUrl()"
          [autoplay]="true"
        />
      </div>

      <!-- Info del ejercicio -->
      <div class="info-section" @fade>
        <h2 class="ejercicio-nombre">{{ ejercicio()?.ejercicio?.nombre_ejercicio }}</h2>

        <!-- Contador de series -->
        <app-contador-series
          [serie]="serieActual()"
          [total]="totalSeries()"
        />

        <!-- Objetivo -->
        <div class="objetivo-section">
          @if (esTemporizador()) {
            <app-temporizador
              [tiempoInicial]="duracionSeg()"
              [autoIniciar]="true"
              label="segundos"
              (tiempoAgotado)="onTiempoAgotado()"
            />
          } @else {
            <div class="repeticiones-display">
              <span class="numero">{{ repeticiones() }}</span>
              <span class="texto">repeticiones</span>
            </div>
          }
        </div>

        <!-- Instrucciones -->
        @if (instrucciones()) {
          <div class="instrucciones tarjeta-kengo">
            <span class="instrucciones-icon">💡</span>
            <p class="instrucciones-texto">{{ instrucciones() }}</p>
          </div>
        }
      </div>

      <!-- Botón completar -->
      <div class="action-section">
        <button
          type="button"
          class="btn-completar"
          (click)="completarSerie.emit()"
        >
          @if (esUltimaSerie()) {
            Completar ejercicio
          } @else {
            Completar serie
          }
          <span class="check">✓</span>
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

    .ejercicio-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .video-section {
      margin: 0 -20px;
      flex-shrink: 0;
      max-height: 35vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    }

    .info-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
      flex: 1;
      min-height: 0;
      padding: 16px 0;
      overflow-y: auto;
    }

    .ejercicio-nombre {
      font-size: 1.625rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
      padding: 0 8px;
      text-wrap: balance;
    }

    .objetivo-section {
      display: flex;
      justify-content: center;
      flex-shrink: 0;
    }

    .repeticiones-display {
      position: relative;
      width: 140px;
      height: 140px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 50%;
      box-shadow:
        0 8px 32px rgba(231, 92, 62, 0.15),
        inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      transition: all 0.3s ease;
    }

    .repeticiones-display:hover {
      transform: scale(1.02);
      box-shadow:
        0 12px 40px rgba(231, 92, 62, 0.2),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .repeticiones-display .numero {
      font-size: 2.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(231, 92, 62, 0.2));
    }

    .repeticiones-display .texto {
      font-size: 0.7rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 500;
    }

    .instrucciones {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 18px;
      width: 100%;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.06),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
      transition: all 0.3s ease;
    }

    .instrucciones:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.1),
        inset 0 0 0 1px rgba(255, 255, 255, 0.7);
    }

    .instrucciones-icon {
      font-size: 1.375rem;
      flex-shrink: 0;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .instrucciones-texto {
      font-size: 0.9rem;
      color: #4b5563;
      margin: 0;
      text-align: left;
      line-height: 1.6;
    }

    .action-section {
      flex-shrink: 0;
      padding-top: 12px;
    }

    .btn-completar {
      width: 100%;
      padding: 18px 32px;
      border: none;
      border-radius: 18px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      font-size: 1.0625rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(16, 185, 129, 0.35);
    }

    .btn-completar:hover {
      transform: translateY(-3px);
      box-shadow: 0 16px 40px rgba(16, 185, 129, 0.45);
    }

    .btn-completar:active {
      transform: translateY(-1px);
    }

    .btn-completar .check {
      font-size: 1.375rem;
      transition: transform 0.3s ease;
    }

    .btn-completar:hover .check {
      transform: scale(1.2);
    }
  `,
})
export class EjercicioActivoComponent {
  @Output() completarSerie = new EventEmitter<void>();
  @Output() pausar = new EventEmitter<void>();

  private registroService = inject(RegistroSesionService);

  readonly ejercicio = this.registroService.ejercicioActual;
  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly esUltimaSerie = this.registroService.esUltimaSerie;
  readonly esTemporizador = this.registroService.esTipoTemporizador;

  readonly videoUrl = computed(() => {
    const videoId = this.ejercicio()?.ejercicio?.video;
    return videoId ? this.registroService.getVideoUrl(videoId) : null;
  });

  readonly posterUrl = computed(() => {
    const portadaId = this.ejercicio()?.ejercicio?.portada;
    return portadaId ? this.registroService.getAssetUrl(portadaId, 800, 450) : null;
  });

  readonly duracionSeg = computed(() => this.ejercicio()?.duracion_seg || 30);

  readonly repeticiones = computed(() => this.ejercicio()?.repeticiones || 12);

  readonly instrucciones = computed(
    () => this.ejercicio()?.instrucciones_paciente || ''
  );

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    // Completar serie automáticamente
    this.completarSerie.emit();
  }
}
