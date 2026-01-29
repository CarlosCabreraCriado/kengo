import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  OnInit,
  ViewChild,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-descanso',
  standalone: true,
  imports: [CommonModule, TemporizadorComponent],
  animations: [fadeAnimation],
  template: `
    <div class="descanso-container">
      <!-- Fondo animado con orbes flotantes -->
      <div class="ambient-background">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>

      <!-- Header flotante -->
      <header class="floating-header">
        <!-- Botón salir -->
        <button type="button" class="header-btn" (click)="salir.emit()">
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

      <!-- Contenido principal centrado -->
      <main class="main-content">
        <!-- Indicador de respiración -->
        <div class="breath-hint" [class.inhale]="breathPhase() === 'inhale'">
          <span class="breath-text">{{
            breathPhase() === 'inhale' ? 'Inhala' : 'Exhala'
          }}</span>
        </div>

        <!-- Timer principal con anillo de respiración -->
        <div class="timer-zone" [class.warning]="isWarning()">
          <!-- Anillo exterior de respiración -->
          <div
            class="breath-ring"
            [class.inhale]="breathPhase() === 'inhale'"
          ></div>

          <!-- Timer central -->
          <div class="timer-core">
            <app-temporizador
              #temporizador
              [tiempoInicial]="tiempoDescanso()"
              [autoIniciar]="true"
              label="segundos"
              [umbralAdvertencia]="5"
              (tiempoAgotado)="onTiempoAgotado()"
              (tick)="onTick($event)"
            />
          </div>
        </div>

        <!-- Info próxima serie -->
        <div class="next-series-card" @fade>
          <div class="next-label">
            <span class="material-symbols-outlined icon-sm">navigate_next</span>
            <span>Próxima</span>
          </div>
          <div class="next-value">
            Serie {{ serieActual() }} de {{ totalSeries() }}
          </div>
        </div>
      </main>

      <!-- Panel de acciones -->
      <footer class="actions-panel">
        <button type="button" class="action-btn secondary" (click)="onAgregarTiempo()">
          <span class="material-symbols-outlined">add</span>
          <span class="btn-label">+15s</span>
        </button>

        <button type="button" class="action-btn primary" (click)="saltar.emit()">
          <span class="btn-label">Continuar</span>
          <span class="material-symbols-outlined icon-filled">arrow_forward</span>
        </button>
      </footer>
    </div>
  `,
  styles: `
    @reference "tailwindcss";

    /* === Variables === */
    :host {
      --primary: var(--kengo-primary);
      --primary-dark: var(--kengo-primary-dark);
      --tertiary: var(--kengo-tertiary);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --breath-duration: 4s;

      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* === Contenedor principal === */
    .descanso-container {
      position: relative;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background: linear-gradient(
        165deg,
        #fef8f7 0%,
        #ffede8 35%,
        #fff5f0 70%,
        #fffaf8 100%
      );
    }

    /* === Fondo ambiente con orbes === */
    .ambient-background {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.5;
      animation: float 20s ease-in-out infinite;
    }

    .orb-1 {
      width: 300px;
      height: 300px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-primary-rgb), 0.25) 0%,
        transparent 70%
      );
      top: -100px;
      right: -80px;
      animation-delay: 0s;
    }

    .orb-2 {
      width: 250px;
      height: 250px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-tertiary-rgb), 0.2) 0%,
        transparent 70%
      );
      bottom: 10%;
      left: -60px;
      animation-delay: -7s;
    }

    .orb-3 {
      width: 200px;
      height: 200px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-primary-rgb), 0.15) 0%,
        transparent 70%
      );
      top: 40%;
      right: -40px;
      animation-delay: -14s;
    }

    @keyframes float {
      0%, 100% {
        transform: translate(0, 0) scale(1);
      }
      25% {
        transform: translate(20px, -30px) scale(1.05);
      }
      50% {
        transform: translate(-15px, 20px) scale(0.95);
      }
      75% {
        transform: translate(25px, 15px) scale(1.02);
      }
    }

    /* === Header flotante === */
    .floating-header {
      position: relative;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: calc(var(--safe-top) + 16px) 20px 12px;
      gap: 16px;
    }

    .header-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      color: var(--primary);
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.92);
        background: rgba(255, 255, 255, 0.8);
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
      gap: 6px;
    }

    .progress-text {
      display: flex;
      align-items: baseline;
      gap: 2px;
      font-weight: 600;
    }

    .progress-current {
      font-size: 1rem;
      color: #1f2937;
    }

    .progress-separator {
      font-size: 0.85rem;
      color: #9ca3af;
    }

    .progress-total {
      font-size: 0.85rem;
      color: #6b7280;
    }

    .progress-bar {
      width: 80px;
      height: 4px;
      border-radius: 2px;
      background: rgba(var(--kengo-primary-rgb), 0.12);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--primary), var(--tertiary));
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* === Contenido principal === */
    .main-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 24px;
      padding: 0 24px;
    }

    /* Indicador de respiración */
    .breath-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 20px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      transition: all 0.5s ease;
    }

    .breath-hint.inhale {
      background: rgba(var(--kengo-primary-rgb), 0.08);
      border-color: rgba(var(--kengo-primary-rgb), 0.15);
    }

    .breath-text {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
      transition: color 0.5s ease;
    }

    .breath-hint.inhale .breath-text {
      color: var(--primary);
    }

    /* === Zona del timer === */
    .timer-zone {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Anillo de respiración */
    .breath-ring {
      position: absolute;
      width: calc(100% + 40px);
      height: calc(100% + 40px);
      border-radius: 50%;
      border: 2px solid rgba(var(--kengo-primary-rgb), 0.15);
      transition: all var(--breath-duration) cubic-bezier(0.4, 0, 0.6, 1);
      animation: breathe var(--breath-duration) ease-in-out infinite;
    }

    .breath-ring::before {
      content: '';
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.08);
      animation: breathe var(--breath-duration) ease-in-out infinite;
      animation-delay: 0.15s;
    }

    .breath-ring.inhale {
      border-color: rgba(var(--kengo-primary-rgb), 0.25);
    }

    @keyframes breathe {
      0%, 100% {
        transform: scale(1);
        opacity: 0.6;
      }
      50% {
        transform: scale(1.08);
        opacity: 1;
      }
    }

    /* Timer core */
    .timer-core {
      position: relative;
      z-index: 2;
    }

    /* Override del temporizador para este contexto */
    .timer-zone ::ng-deep .timer-container {
      width: clamp(180px, 45vw, 220px);
      height: auto;
      aspect-ratio: 1;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow:
        0 8px 40px rgba(var(--kengo-primary-rgb), 0.12),
        0 2px 12px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .timer-zone ::ng-deep .timer-value {
      font-size: clamp(2.5rem, 12vw, 4rem);
      font-weight: 700;
      color: #1f2937;
    }

    .timer-zone ::ng-deep .timer-label {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .timer-zone ::ng-deep .timer-progress {
      stroke: var(--primary);
      stroke-width: 6;
    }

    .timer-zone ::ng-deep .timer-bg {
      stroke: rgba(var(--kengo-primary-rgb), 0.08);
      stroke-width: 6;
    }

    /* Estado de advertencia */
    .timer-zone.warning ::ng-deep .timer-container {
      animation: pulse-warning 0.8s ease-in-out infinite;
      box-shadow:
        0 8px 40px rgba(var(--kengo-tertiary-rgb), 0.25),
        0 2px 12px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .timer-zone.warning ::ng-deep .timer-value {
      color: var(--tertiary);
    }

    .timer-zone.warning .breath-ring {
      border-color: rgba(var(--kengo-tertiary-rgb), 0.3);
    }

    @keyframes pulse-warning {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.02);
      }
    }

    /* === Card próxima serie === */
    .next-series-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 14px 28px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .next-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9ca3af;
    }

    .icon-sm {
      font-size: 1rem;
    }

    .next-value {
      font-size: 1.1rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    /* === Panel de acciones === */
    .actions-panel {
      position: relative;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px calc(var(--safe-bottom) + 24px);
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
        transform: scale(0.96);
      }
    }

    .action-btn.secondary {
      height: 52px;
      padding: 0 20px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1.5px solid rgba(var(--kengo-primary-rgb), 0.2);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      color: #64748b;

      span.material-symbols-outlined {
        font-size: 1.25rem;
        color: var(--primary);
      }

      .btn-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #4b5563;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.9);
        border-color: var(--primary);
      }
    }

    .action-btn.primary {
      flex: 1;
      max-width: 220px;
      height: 56px;
      padding: 0 24px;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      box-shadow:
        0 4px 20px rgba(var(--kengo-primary-rgb), 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
      color: white;

      .btn-label {
        font-size: 1rem;
        font-weight: 700;
      }

      span.material-symbols-outlined {
        font-size: 1.35rem;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          0 6px 24px rgba(var(--kengo-primary-rgb), 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.15);
      }
    }

    .icon-filled {
      font-variation-settings:
        'FILL' 1,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24;
    }

    /* === Desktop === */
    @media (min-width: 768px) {
      .descanso-container {
        padding: 0 32px;
      }

      .timer-zone ::ng-deep .timer-container {
        width: clamp(200px, 30vw, 260px);
      }

      .timer-zone ::ng-deep .timer-value {
        font-size: clamp(3rem, 6vw, 4.5rem);
      }

      .breath-ring {
        width: calc(100% + 60px);
        height: calc(100% + 60px);
      }

      .actions-panel {
        max-width: 480px;
        margin: 0 auto;
        gap: 16px;
      }

      .action-btn.primary {
        max-width: 260px;
      }
    }

    @media (min-width: 1024px) {
      .orb-1 {
        width: 400px;
        height: 400px;
      }

      .orb-2 {
        width: 350px;
        height: 350px;
      }

      .orb-3 {
        width: 280px;
        height: 280px;
      }
    }
  `,
})
export class DescansoComponent implements OnInit, OnDestroy {
  @Output() saltar = new EventEmitter<void>();
  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() agregarTiempo = new EventEmitter<number>();
  @Output() salir = new EventEmitter<void>();

  @ViewChild('temporizador') temporizador!: TemporizadorComponent;

  private registroService = inject(RegistroSesionService);
  private breathInterval: ReturnType<typeof setInterval> | null = null;

  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly tiempoDescanso = computed(
    () => this.registroService.ejercicioActual()?.descanso_seg || 45,
  );

  // Progreso de la sesión
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  // Estado de la animación de respiración
  readonly breathPhase = signal<'inhale' | 'exhale'>('inhale');

  // Estado de advertencia (últimos 5 segundos)
  readonly isWarning = signal(false);

  ngOnInit(): void {
    // Ciclo de respiración: 4s inhalar, 4s exhalar
    this.breathInterval = setInterval(() => {
      this.breathPhase.update((phase) =>
        phase === 'inhale' ? 'exhale' : 'inhale',
      );
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.breathInterval) {
      clearInterval(this.breathInterval);
    }
  }

  onTick(segundosRestantes: number): void {
    this.isWarning.set(segundosRestantes <= 5 && segundosRestantes > 0);
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    this.tiempoAgotado.emit();
  }

  onAgregarTiempo(): void {
    if (this.temporizador) {
      this.temporizador.agregarTiempo(15);
    }
    this.agregarTiempo.emit(15);
  }
}
