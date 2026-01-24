import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { ContadorSeriesComponent } from '../../componentes/contador-series/contador-series.component';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-ejercicio-activo',
  standalone: true,
  imports: [CommonModule, ContadorSeriesComponent, TemporizadorComponent],
  animations: [fadeAnimation],
  template: `
    <!-- Contenedor principal con gestos -->
    <div
      class="ejercicio-activo-container"
      (wheel)="onWheel($event)"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <!-- Sección del video -->
      <div class="video-section" [class.expanded]="videoExpandido()">
        <div class="video-wrapper" (click)="toggleVideo()">
          @if (videoUrl()) {
            <video
              #videoPlayer
              class="media-element"
              [src]="videoUrl()"
              [poster]="posterUrl() || ''"
              autoplay
              muted
              loop
              playsinline
            ></video>
          } @else if (posterUrl()) {
            <img
              [src]="posterUrl()"
              [alt]="ejercicio()?.ejercicio?.nombre_ejercicio"
              class="media-element"
            />
          } @else {
            <div class="media-placeholder">
              <div class="placeholder-icon-wrapper">
                <span class="material-symbols-outlined placeholder-icon"
                  >fitness_center</span
                >
              </div>
            </div>
          }

          <!-- Indicador play/pause flotante -->
          @if (showPlayIndicator()) {
            <div class="play-indicator-animated">
              <span class="material-symbols-outlined icon-filled">
                {{ videoReproduciendo() ? 'pause' : 'play_arrow' }}
              </span>
            </div>
          }

          <!-- Header flotante sobre el video -->
          <header class="floating-header" [class.scrolled]="videoExpandido()">
            <!-- Botón salir -->
            <button
              type="button"
              class="header-btn"
              (click)="salir.emit(); $event.stopPropagation()"
            >
              <span class="material-symbols-outlined">close</span>
            </button>

            <!-- Indicador de progreso -->
            <div class="progress-indicator">
              <div class="progress-text">
                <span class="progress-current">{{
                  ejercicioActualIndex() + 1
                }}</span>
                <span class="progress-separator">/</span>
                <span class="progress-total">{{ totalEjercicios() }}</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  [style.width.%]="progresoSesion()"
                ></div>
              </div>
            </div>

            <!-- Espacio para balance visual -->
            <div class="header-spacer"></div>
          </header>

          <!-- Swipe hint (solo cuando no está expandido y hay video) -->
          @if (!videoExpandido() && videoUrl()) {
            <div class="swipe-hint">
              <span class="material-symbols-outlined">keyboard_arrow_down</span>
              <span class="hint-text">Desliza para ver más</span>
            </div>
          }
        </div>
      </div>

      <!-- Panel de información -->
      <div class="info-panel" [class.minimized]="videoExpandido()">
        <!-- Panel handle para arrastrar -->
        <div class="panel-handle" (click)="toggleExpandido()">
          <div class="handle-bar"></div>
        </div>

        <!-- Contenido del panel (oculto cuando está minimizado) -->
        @if (!videoExpandido()) {
          <div class="panel-content" @fade>
            <!-- Nombre del ejercicio -->
            <h2 class="exercise-name">
              {{ ejercicio()?.ejercicio?.nombre_ejercicio }}
            </h2>

            <!-- Fila: Series + Objetivo -->
            <div class="stats-row">
              <!-- Contador de series visual -->
              <div class="series-tracker">
                <span class="series-label">Serie</span>
                <div class="series-dots">
                  @for (serie of seriesArray(); track serie) {
                    <div
                      class="series-dot"
                      [class.completed]="serie < serieActual()"
                      [class.current]="serie === serieActual()"
                      [class.pending]="serie > serieActual()"
                    >
                      @if (serie < serieActual()) {
                        <span class="material-symbols-outlined dot-check"
                          >check</span
                        >
                      } @else if (serie === serieActual()) {
                        <span class="dot-number">{{ serie }}</span>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Separador visual -->
              <div class="stats-divider"></div>

              <!-- Objetivo: Temporizador o Repeticiones -->
              <div class="objective-section">
                @if (esTemporizador()) {
                  <app-temporizador
                    [tiempoInicial]="duracionSeg()"
                    [autoIniciar]="true"
                    label="segundos"
                    (tiempoAgotado)="onTiempoAgotado()"
                  />
                } @else {
                  <div class="reps-display">
                    <span class="reps-number">{{ repeticiones() }}</span>
                    <span class="reps-label">repeticiones</span>
                  </div>
                }
              </div>
            </div>

            <!-- Instrucciones del fisio -->
            @if (instrucciones()) {
              <div class="instructions-card">
                <div class="instructions-icon">
                  <span class="material-symbols-outlined"
                    >tips_and_updates</span
                  >
                </div>
                <p class="instructions-text">
                  {{ instrucciones() }}
                </p>
              </div>
            }
          </div>
        }

        <!-- Barra de acciones (siempre visible) -->
        <div class="actions-bar" [class.compact]="videoExpandido()">
          @if (videoExpandido()) {
            <!-- Info mínima cuando está expandido -->
            <div class="minimal-info">
              <span class="minimal-title">{{
                ejercicio()?.ejercicio?.nombre_ejercicio
              }}</span>
              <span class="minimal-meta"
                >Serie {{ serieActual() }}/{{ totalSeries() }}</span
              >
            </div>
          }

          <div class="action-buttons">
            <!-- Botón expandir/contraer -->
            <button
              type="button"
              class="action-btn secondary"
              (click)="toggleExpandido()"
              [attr.aria-label]="
                videoExpandido() ? 'Mostrar detalles' : 'Ver video completo'
              "
            >
              <span class="material-symbols-outlined">
                {{ videoExpandido() ? 'expand_more' : 'expand_less' }}
              </span>
            </button>

            <!-- Botón completar serie -->
            <button
              type="button"
              class="action-btn primary"
              [class.final]="esUltimaSerie()"
              (click)="completarSerie.emit()"
            >
              <span class="material-symbols-outlined icon-filled">{{
                esUltimaSerie() ? 'done_all' : 'check'
              }}</span>
              @if (!videoExpandido()) {
                <span class="btn-label">{{
                  esUltimaSerie() ? 'Completar' : 'Serie lista'
                }}</span>
              }
            </button>

            <!-- Botón play/pause -->
            <button
              type="button"
              class="action-btn secondary"
              (click)="toggleVideo(); $event.stopPropagation()"
              [attr.aria-label]="videoReproduciendo() ? 'Pausar' : 'Reproducir'"
            >
              <span class="material-symbols-outlined">
                {{ videoReproduciendo() ? 'pause' : 'play_arrow' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    @reference "tailwindcss";

    /* === Variables === */
    :host {
      --transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* === Contenedor principal === */
    .ejercicio-activo-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    }

    /* === Sección del video === */
    .video-section {
      position: relative;
      flex-shrink: 0;
      height: 50dvh;
      min-height: 260px;
      transition: height var(--transition);
    }

    .video-section.expanded {
      height: calc(100dvh - 140px - var(--safe-bottom));
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      cursor: pointer;
      overflow: hidden;
    }

    .media-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }

    .video-wrapper:hover .media-element {
      transform: scale(1.02);
    }

    .media-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #2a2626 0%, #1a1818 100%);
    }

    .placeholder-icon-wrapper {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .placeholder-icon {
      font-size: 3rem;
      color: rgba(255, 255, 255, 0.2);
    }

    /* Indicador de play/pause animado */
    .play-indicator-animated {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      animation: playPop 0.6s ease-out forwards;

      span {
        font-size: 5rem;
        color: white;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }
    }

    @keyframes playPop {
      0% {
        opacity: 0;
        transform: scale(0.5);
      }
      30% {
        opacity: 1;
        transform: scale(1.1);
      }
      100% {
        opacity: 0;
        transform: scale(1.3);
      }
    }

    .icon-filled {
      font-variation-settings:
        'FILL' 1,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24;
    }

    /* === Header flotante sobre el video === */
    .floating-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: calc(var(--safe-top) + 12px) 16px 12px;
      gap: 16px;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
      transition: background var(--transition);
    }

    .floating-header.scrolled {
      background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.7) 0%,
        rgba(0, 0, 0, 0.3) 100%
      );
    }

    .header-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.92);
        background: rgba(255, 255, 255, 0.25);
      }

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: scale(1.05);
      }

      span {
        font-size: 1.35rem;
      }
    }

    .header-spacer {
      width: 44px;
    }

    /* Indicador de progreso */
    .progress-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .progress-text {
      display: flex;
      align-items: baseline;
      gap: 2px;
      font-weight: 600;
    }

    .progress-current {
      font-size: 1rem;
      color: white;
    }

    .progress-separator {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .progress-total {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .progress-bar {
      width: 72px;
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.2);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #e75c3e, #efc048);
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Swipe hint */
    .swipe-hint {
      position: absolute;
      bottom: 24px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: rgba(255, 255, 255, 0.7);
      pointer-events: none;
      animation: hintBounce 2s ease-in-out infinite;

      span {
        font-size: 1.5rem;
      }
    }

    .hint-text {
      font-size: 0.75rem;
      font-weight: 500;
    }

    @keyframes hintBounce {
      0%,
      100% {
        transform: translateY(0);
        opacity: 0.7;
      }
      50% {
        transform: translateY(-8px);
        opacity: 1;
      }
    }

    /* === Panel de información === */
    .info-panel {
      position: relative;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      z-index: 10;
      border-radius: 28px 28px 0 0;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-bottom: none;
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.15);
      margin-top: -24px;
      transition: all var(--transition);
    }

    .info-panel.minimized {
      flex: 0 0 auto;
    }

    /* Panel handle */
    .panel-handle {
      display: flex;
      justify-content: center;
      padding: 12px;
      cursor: pointer;
    }

    .handle-bar {
      width: 48px;
      height: 5px;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
    }

    .panel-handle:hover .handle-bar {
      background: rgba(0, 0, 0, 0.25);
      width: 56px;
    }

    /* Contenido del panel */
    .panel-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      gap: 16px;
      padding: 0 16px 8px;
      overflow-y: auto;
      animation: slideUp 0.4s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Nombre del ejercicio */
    .exercise-name {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 700;
      color: #1f2937;
      text-align: center;
      line-height: 1.25;
      text-wrap: balance;
    }

    /* Fila de estadísticas */
    .stats-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .stats-divider {
      width: 1px;
      height: 48px;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(0, 0, 0, 0.1) 50%,
        transparent 100%
      );
    }

    /* Series tracker */
    .series-tracker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .series-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .series-dots {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .series-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &.completed {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.35);
      }

      &.current {
        background: linear-gradient(135deg, #e75c3e, #d14d31);
        box-shadow:
          0 0 0 3px rgba(231, 92, 62, 0.2),
          0 3px 12px rgba(231, 92, 62, 0.35);
        transform: scale(1.12);
        animation: pulse-current 2s ease-in-out infinite;
      }

      &.pending {
        background: rgba(0, 0, 0, 0.04);
        border: 1.5px solid rgba(0, 0, 0, 0.1);
      }
    }

    .dot-check {
      font-size: 0.9rem;
      color: white;
    }

    .dot-number {
      font-size: 0.8rem;
      font-weight: 700;
      color: white;
    }

    @keyframes pulse-current {
      0%,
      100% {
        box-shadow:
          0 0 0 3px rgba(231, 92, 62, 0.2),
          0 3px 12px rgba(231, 92, 62, 0.35);
      }
      50% {
        box-shadow:
          0 0 0 5px rgba(231, 92, 62, 0.12),
          0 3px 16px rgba(231, 92, 62, 0.45);
      }
    }

    /* Sección de objetivo */
    .objective-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Display de repeticiones */
    .reps-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .reps-number {
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1;
      background: linear-gradient(135deg, #e75c3e, #d14d31);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .reps-label {
      font-size: 0.65rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* Instrucciones */
    .instructions-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: rgba(239, 192, 72, 0.1);
      border: 1px solid rgba(239, 192, 72, 0.25);
      border-radius: 16px;
    }

    .instructions-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(239, 192, 72, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      span {
        font-size: 1rem;
        color: #d4a93d;
      }
    }

    .instructions-text {
      margin: 0;
      font-size: 0.8125rem;
      line-height: 1.5;
      color: #4b5563;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* === Barra de acciones === */
    .actions-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 16px calc(var(--safe-bottom) + 16px);
      flex-shrink: 0;
      transition: all var(--transition);
    }

    .actions-bar.compact {
      padding-top: 8px;
      padding-bottom: calc(var(--safe-bottom) + 12px);
    }

    .minimal-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 100%;
      text-align: center;
    }

    .minimal-title {
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .minimal-meta {
      font-size: 0.75rem;
      font-weight: 500;
      color: #64748b;
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.95);
      }
    }

    .action-btn.secondary {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

      span {
        font-size: 1.35rem;
        color: #64748b;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.95);
        transform: translateY(-2px);

        span {
          color: #e75c3e;
        }
      }
    }

    .action-btn.primary {
      height: 56px;
      padding: 0 24px;
      border-radius: 20px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      box-shadow:
        0 4px 16px rgba(34, 197, 94, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: white;

      span {
        font-size: 1.5rem;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          0 6px 20px rgba(34, 197, 94, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }

      &.final {
        background: linear-gradient(135deg, #efc048 0%, #d4a93d 100%);
        box-shadow:
          0 4px 16px rgba(239, 192, 72, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);

        &:hover {
          box-shadow:
            0 6px 20px rgba(239, 192, 72, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
      }
    }

    .btn-label {
      font-size: 1rem;
      font-weight: 700;
    }

    .actions-bar.compact .action-btn.primary {
      width: 64px;
      height: 64px;
      padding: 0;
      border-radius: 50%;

      .btn-label {
        display: none;
      }
    }

    /* === Desktop: Layout horizontal === */
    @media (min-width: 1024px) {
      .ejercicio-activo-container {
        flex-direction: row;
        padding: 32px;
        gap: 40px;
        background: linear-gradient(135deg, #fef8f7 0%, #ffede8 100%);
      }

      .video-section {
        position: relative;
        flex: 1;
        max-width: 60%;
        height: auto;
        min-height: unset;
        aspect-ratio: 16 / 9;
      }

      .video-section.expanded {
        height: auto;
        max-width: 70%;
      }

      .video-wrapper {
        border-radius: 32px;
        box-shadow:
          0 25px 80px rgba(0, 0, 0, 0.18),
          0 8px 24px rgba(0, 0, 0, 0.1);
      }

      .floating-header {
        padding: 20px 24px;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.4) 0%,
          transparent 100%
        );
      }

      .swipe-hint {
        display: none;
      }

      .info-panel {
        width: 340px;
        flex-shrink: 0;
        margin-top: 0;
        border-radius: 32px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.7);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
      }

      .info-panel.minimized {
        width: 280px;
      }

      .panel-handle {
        display: none;
      }

      .panel-content {
        padding: 24px;
      }

      .exercise-name {
        font-size: 1.5rem;
      }

      .stats-row {
        padding: 24px;
        gap: 24px;
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.7);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
      }

      .stats-divider {
        height: 56px;
      }

      .series-dot {
        width: 32px;
        height: 32px;
      }

      .reps-number {
        font-size: 2.75rem;
      }

      .actions-bar {
        padding: 24px;
        padding-bottom: 24px;
      }
    }

    /* Large desktop */
    @media (min-width: 1280px) {
      .ejercicio-activo-container {
        padding: 48px;
        gap: 56px;
      }

      .info-panel {
        width: 400px;
      }

      .exercise-name {
        font-size: 1.75rem;
      }

      .stats-row {
        padding: 28px 32px;
        gap: 32px;
        border-radius: 32px;
      }

      .reps-number {
        font-size: 3rem;
      }
    }
  `,
})
export class EjercicioActivoComponent {
  @Output() completarSerie = new EventEmitter<void>();
  @Output() pausar = new EventEmitter<void>();
  @Output() salir = new EventEmitter<void>();

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  private registroService = inject(RegistroSesionService);

  readonly ejercicio = this.registroService.ejercicioActual;
  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly esUltimaSerie = this.registroService.esUltimaSerie;
  readonly esTemporizador = this.registroService.esTipoTemporizador;

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  // Estado del video
  readonly videoReproduciendo = signal<boolean>(true);
  readonly videoExpandido = signal<boolean>(false);
  readonly showPlayIndicator = signal<boolean>(false);

  // Control de gestos táctiles
  private touchStartY = 0;

  readonly videoUrl = computed(() => {
    const videoId = this.ejercicio()?.ejercicio?.video;
    return videoId ? this.registroService.getVideoUrl(videoId) : null;
  });

  readonly posterUrl = computed(() => {
    const portadaId = this.ejercicio()?.ejercicio?.portada;
    return portadaId
      ? this.registroService.getAssetUrl(portadaId, 800, 450)
      : null;
  });

  readonly duracionSeg = computed(() => this.ejercicio()?.duracion_seg || 30);

  readonly repeticiones = computed(() => this.ejercicio()?.repeticiones || 12);

  readonly instrucciones = computed(
    () => this.ejercicio()?.instrucciones_paciente || '',
  );

  // Array de series para el tracker visual
  readonly seriesArray = computed(() => {
    const total = this.totalSeries();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  toggleExpandido(): void {
    this.videoExpandido.update((v) => !v);
  }

  toggleVideo(): void {
    if (!this.videoPlayer?.nativeElement) return;

    const video = this.videoPlayer.nativeElement;
    if (video.paused) {
      video.play();
      this.videoReproduciendo.set(true);
    } else {
      video.pause();
      this.videoReproduciendo.set(false);
    }

    // Mostrar indicador de play/pause brevemente
    this.showPlayIndicator.set(true);
    setTimeout(() => this.showPlayIndicator.set(false), 600);
  }

  // Scroll con rueda del ratón (desktop)
  onWheel(event: WheelEvent): void {
    // Scroll hacia arriba -> expandir video (ocultar panel)
    if (event.deltaY < -30 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Scroll hacia abajo -> contraer video (mostrar panel)
    if (event.deltaY > 30 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  // Gestos táctiles (móvil)
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = this.touchStartY - touchEndY;

    // Swipe hacia abajo (deltaY < 0) -> expandir video (ocultar panel)
    if (deltaY < -50 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Swipe hacia arriba (deltaY > 0) -> contraer video (mostrar panel)
    if (deltaY > 50 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    // Completar serie automáticamente
    this.completarSerie.emit();
  }
}
