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
    .ejercicio-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 24px;
    }

    .video-section {
      margin: 0 -16px;
    }

    .info-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      text-align: center;
    }

    .ejercicio-nombre {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .objetivo-section {
      display: flex;
      justify-content: center;
      padding: 16px 0;
    }

    .repeticiones-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .repeticiones-display .numero {
      font-size: 4rem;
      font-weight: 800;
      color: #e75c3e;
      line-height: 1;
    }

    .repeticiones-display .texto {
      font-size: 1rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .instrucciones {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      width: 100%;
    }

    .instrucciones-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .instrucciones-texto {
      font-size: 0.875rem;
      color: #4b5563;
      margin: 0;
      text-align: left;
      line-height: 1.5;
    }

    .action-section {
      margin-top: auto;
      padding-top: 16px;
    }

    .btn-completar {
      width: 100%;
      padding: 20px 32px;
      border: none;
      border-radius: 16px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      font-size: 1.125rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s ease;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
    }

    .btn-completar:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
    }

    .btn-completar:active {
      transform: translateY(0);
    }

    .btn-completar .check {
      font-size: 1.25rem;
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
