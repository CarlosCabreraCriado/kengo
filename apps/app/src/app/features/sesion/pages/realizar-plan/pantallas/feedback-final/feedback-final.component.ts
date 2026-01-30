import {
  Component,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegistroSesionService } from '../../../../data-access/registro-sesion.service';
import { EscalaDolorComponent } from '../../componentes/escala-dolor/escala-dolor.component';
import { fadeAnimation, staggerAnimation } from '../../realizar-plan.animations';

export interface FeedbackFinalData {
  feedbacks: {
    planItemId: number;
    dolor: number;
    nota?: string;
  }[];
  observacionesGenerales?: string;
}

@Component({
  selector: 'app-feedback-final',
  standalone: true,
  imports: [
    FormsModule,
    EscalaDolorComponent,
  ],
  animations: [fadeAnimation, staggerAnimation],
  template: `
    <div class="feedback-container">
      <!-- Fondo animado con orbes flotantes -->
      <div class="ambient-background">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="orb orb-4"></div>
      </div>

      <!-- Confetti cuando se completa -->
      @if (todosCompletados()) {
        <div class="confetti-container">
          @for (i of confettiPieces; track i) {
            <div
              class="confetti"
              [style.--delay]="i * 0.08 + 's'"
              [style.--x]="getConfettiX(i)"
              [style.--rotation]="getConfettiRotation(i)"
            ></div>
          }
        </div>
      }

      <!-- Header sticky -->
      <header class="floating-header">
        <div class="header-content">
          <!-- Icono de celebración -->
          <div class="celebration-badge">
            <div class="badge-glow"></div>
            <span class="material-symbols-outlined icon-filled">celebration</span>
          </div>

          <!-- Título y progreso -->
          <div class="header-info">
            <h1 class="header-title">¡Sesión completada!</h1>
            <p class="header-subtitle">Cuéntanos cómo te sentiste</p>
          </div>

          <!-- Indicador de progreso circular - solo en modo detallado -->
          @if (modoDetallado()) {
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 44 44">
                <circle
                  class="progress-ring-bg"
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke-width="4"
                />
                <circle
                  class="progress-ring-fill"
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke-width="4"
                  [style.stroke-dasharray]="circumference"
                  [style.stroke-dashoffset]="progressOffset()"
                />
              </svg>
              <span class="progress-text">{{ ejerciciosConDolor() }}/{{ totalEjercicios() }}</span>
            </div>
          }
        </div>
      </header>

      <!-- Contenido scrolleable -->
      <main class="main-content">
        <div class="exercises-list">
          @if (!modoDetallado()) {
            <!-- ========== MODO SIMPLIFICADO (por defecto) ========== -->
            <article class="global-feedback-card" @fade>
              <div class="session-summary">
                <span class="material-symbols-outlined summary-icon">fitness_center</span>
                <span class="summary-text">{{ totalEjercicios() }} ejercicios completados</span>
              </div>

              <app-escala-dolor
                label="¿Cómo te sentiste durante la sesión?"
                [valor]="dolorGlobal()"
                (valorChange)="onDolorGlobalChange($event)"
              />
            </article>

            <!-- Botón para expandir a modo detallado -->
            <button
              type="button"
              class="expand-detail-btn"
              (click)="activarModoDetallado()"
            >
              <span class="material-symbols-outlined detail-icon">tune</span>
              <span class="detail-text">Dar feedback detallado por ejercicio</span>
              <span class="material-symbols-outlined arrow-icon">chevron_right</span>
            </button>

            <!-- Observaciones generales -->
            <article class="observations-card" @fade>
              <div class="observations-header">
                <span class="material-symbols-outlined observations-icon">forum</span>
                <span class="observations-title">Observaciones generales</span>
                <span class="observations-optional">(opcional)</span>
              </div>
              <textarea
                class="observations-input"
                placeholder="¿Algún comentario para tu fisioterapeuta?"
                rows="4"
                [(ngModel)]="observacionesGenerales"
              ></textarea>
            </article>
          } @else {
            <!-- ========== MODO DETALLADO ========== -->
            <!-- Botón para volver a modo simplificado -->
            <button
              type="button"
              class="collapse-detail-btn"
              (click)="desactivarModoDetallado()"
            >
              <span class="material-symbols-outlined arrow-icon">chevron_left</span>
              <span class="detail-text">Volver a feedback simplificado</span>
            </button>

            @for (ejercicio of ejerciciosCompletados(); track ejercicio.planItemId; let i = $index) {
              <article
                class="exercise-card"
                [class.completed]="dolorPorEjercicio().get(ejercicio.planItemId) !== undefined"
                @fade
              >
                <!-- Header del ejercicio -->
                <div class="exercise-header">
                  <div class="exercise-number">
                    @if (dolorPorEjercicio().get(ejercicio.planItemId) !== undefined) {
                      <span class="material-symbols-outlined icon-filled check-icon">check</span>
                    } @else {
                      {{ i + 1 }}
                    }
                  </div>
                  <div class="exercise-info">
                    <span class="exercise-name">{{ ejercicio.nombre }}</span>
                    @if (dolorPorEjercicio().get(ejercicio.planItemId) !== undefined) {
                      <span
                        class="dolor-badge"
                        [style.background]="getDolorColor(dolorPorEjercicio().get(ejercicio.planItemId)!)"
                      >
                        {{ dolorPorEjercicio().get(ejercicio.planItemId) }}/10
                      </span>
                    }
                  </div>
                </div>

                <!-- Escala de dolor -->
                <app-escala-dolor
                  label="Nivel de dolor"
                  [valor]="dolorPorEjercicio().get(ejercicio.planItemId) ?? null"
                  (valorChange)="onDolorChange(ejercicio.planItemId, $event)"
                />

                <!-- Sección de nota (colapsable) -->
                <div class="note-section">
                  <button
                    type="button"
                    class="note-toggle"
                    (click)="toggleNota(ejercicio.planItemId)"
                  >
                    <span class="material-symbols-outlined note-icon">edit_note</span>
                    <span class="note-label">
                      {{ notasPorEjercicio().get(ejercicio.planItemId) ? 'Editar nota' : 'Agregar nota' }}
                    </span>
                    <span
                      class="material-symbols-outlined expand-icon"
                      [class.rotated]="notasExpandidas().has(ejercicio.planItemId)"
                    >expand_more</span>
                  </button>

                  @if (notasExpandidas().has(ejercicio.planItemId)) {
                    <div class="note-input-container" @fade>
                      <textarea
                        class="note-input"
                        placeholder="Describe cómo te sentiste durante este ejercicio..."
                        rows="3"
                        [ngModel]="notasPorEjercicio().get(ejercicio.planItemId) || ''"
                        (ngModelChange)="onNotaChange(ejercicio.planItemId, $event)"
                      ></textarea>
                    </div>
                  }
                </div>
              </article>
            }

            <!-- Observaciones generales -->
            <article class="observations-card" @fade>
              <div class="observations-header">
                <span class="material-symbols-outlined observations-icon">forum</span>
                <span class="observations-title">Observaciones generales</span>
                <span class="observations-optional">(opcional)</span>
              </div>
              <textarea
                class="observations-input"
                placeholder="¿Cómo te sentiste durante la sesión en general? ¿Algún comentario para tu fisioterapeuta?"
                rows="4"
                [(ngModel)]="observacionesGenerales"
              ></textarea>
            </article>
          }
        </div>
      </main>

      <!-- Footer con CTA -->
      <footer class="actions-footer">
        <div class="footer-content">
          @if (!todosCompletados()) {
            <div class="incomplete-hint">
              <span class="material-symbols-outlined hint-icon">info</span>
              @if (modoDetallado()) {
                <span>Completa la escala de dolor de todos los ejercicios</span>
              } @else {
                <span>Indica cómo te sentiste durante la sesión</span>
              }
            </div>
          }

          <button
            type="button"
            class="cta-button"
            [class.ready]="todosCompletados()"
            [disabled]="!todosCompletados()"
            (click)="onFinalizar()"
          >
            <span class="btn-text">Finalizar sesión</span>
            <span class="material-symbols-outlined btn-icon icon-filled">arrow_forward</span>
            <div class="btn-shimmer"></div>
          </button>
        </div>
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
      --surface: rgba(255, 255, 255, 0.6);
      --border: rgba(255, 255, 255, 0.5);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);

      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* === Contenedor principal === */
    .feedback-container {
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
      width: 280px;
      height: 280px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-primary-rgb), 0.25) 0%,
        transparent 70%
      );
      top: -80px;
      right: -60px;
      animation-delay: 0s;
    }

    .orb-2 {
      width: 220px;
      height: 220px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-tertiary-rgb), 0.2) 0%,
        transparent 70%
      );
      bottom: 15%;
      left: -50px;
      animation-delay: -7s;
    }

    .orb-3 {
      width: 180px;
      height: 180px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-primary-rgb), 0.15) 0%,
        transparent 70%
      );
      top: 35%;
      right: -30px;
      animation-delay: -14s;
    }

    .orb-4 {
      width: 150px;
      height: 150px;
      background: radial-gradient(
        circle,
        rgba(var(--kengo-tertiary-rgb), 0.15) 0%,
        transparent 70%
      );
      top: 60%;
      left: 20%;
      animation-delay: -10s;
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

    /* === Confetti === */
    .confetti-container {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      height: 200px;
      pointer-events: none;
      overflow: hidden;
      z-index: 100;
    }

    .confetti {
      position: absolute;
      top: -20px;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      animation: confetti-fall 3s ease-out forwards;
      animation-delay: var(--delay);
      left: var(--x);
      transform: rotate(var(--rotation));
    }

    .confetti:nth-child(odd) {
      background: var(--primary);
    }

    .confetti:nth-child(even) {
      background: var(--tertiary);
    }

    .confetti:nth-child(3n) {
      width: 8px;
      height: 12px;
      border-radius: 4px;
    }

    @keyframes confetti-fall {
      0% {
        opacity: 1;
        transform: translateY(0) rotate(0deg) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(250px) rotate(720deg) scale(0.5);
      }
    }

    /* === Header flotante === */
    .floating-header {
      position: sticky;
      top: 0;
      z-index: 50;
      padding: calc(var(--safe-top) + 16px) 20px 16px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 0 4px 24px rgba(var(--kengo-primary-rgb), 0.08);
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 600px;
      margin: 0 auto;
    }

    /* Badge de celebración */
    .celebration-badge {
      position: relative;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow:
        0 4px 16px rgba(var(--kengo-primary-rgb), 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .badge-glow {
      position: absolute;
      inset: -4px;
      border-radius: 20px;
      background: linear-gradient(135deg, var(--primary), var(--tertiary));
      opacity: 0.3;
      filter: blur(8px);
      animation: glow-pulse 2s ease-in-out infinite;
    }

    @keyframes glow-pulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.05); }
    }

    .celebration-badge .material-symbols-outlined {
      position: relative;
      z-index: 1;
      font-size: 1.75rem;
      color: white;
      animation: bounce-soft 2s ease-in-out infinite;
    }

    @keyframes bounce-soft {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    /* Info del header */
    .header-info {
      flex: 1;
      min-width: 0;
    }

    .header-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .header-subtitle {
      margin: 2px 0 0;
      font-size: 0.8rem;
      font-weight: 500;
      color: #64748b;
    }

    /* Anillo de progreso */
    .progress-ring-container {
      position: relative;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }

    .progress-ring {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .progress-ring-bg {
      stroke: rgba(var(--kengo-primary-rgb), 0.12);
    }

    .progress-ring-fill {
      stroke: var(--primary);
      stroke-linecap: round;
      transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .progress-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--primary);
    }

    /* === Contenido principal === */
    .main-content {
      position: relative;
      z-index: 10;
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      padding-bottom: calc(var(--safe-bottom) + 140px);
    }

    .exercises-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 600px;
      margin: 0 auto;
    }

    /* === Tarjeta de feedback global (modo simplificado) === */
    .global-feedback-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 20px;
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    .session-summary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 18px;
      margin-bottom: 18px;
      background: linear-gradient(135deg, rgba(var(--kengo-primary-rgb), 0.08) 0%, rgba(var(--kengo-tertiary-rgb), 0.06) 100%);
      border-radius: 14px;
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.1);
    }

    .summary-icon {
      font-size: 1.3rem;
      color: var(--primary);
    }

    .summary-text {
      font-size: 0.95rem;
      font-weight: 600;
      color: #374151;
    }

    /* === Botones de expansión/colapso === */
    .expand-detail-btn,
    .collapse-detail-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.12);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .expand-detail-btn:hover,
    .collapse-detail-btn:hover {
      background: rgba(255, 255, 255, 0.7);
      border-color: rgba(var(--kengo-primary-rgb), 0.2);
    }

    .expand-detail-btn:active,
    .collapse-detail-btn:active {
      transform: scale(0.99);
    }

    .detail-icon {
      font-size: 1.25rem;
      color: var(--primary);
    }

    .detail-text {
      flex: 1;
      text-align: left;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
    }

    .arrow-icon {
      font-size: 1.25rem;
      color: #9ca3af;
    }

    .collapse-detail-btn {
      margin-bottom: 8px;
    }

    .collapse-detail-btn .arrow-icon {
      color: var(--primary);
    }

    .collapse-detail-btn .detail-text {
      text-align: center;
      color: var(--primary);
      font-weight: 600;
    }

    /* === Tarjeta de ejercicio === */
    .exercise-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 20px;
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
      transition: all 0.3s ease;
    }

    .exercise-card.completed {
      border-color: rgba(34, 197, 94, 0.2);
      box-shadow:
        0 4px 24px rgba(34, 197, 94, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    /* Header del ejercicio */
    .exercise-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .exercise-number {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(var(--kengo-primary-rgb), 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--primary);
      flex-shrink: 0;
      transition: all 0.3s ease;
    }

    .exercise-card.completed .exercise-number {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
    }

    .check-icon {
      font-size: 1.25rem;
    }

    .exercise-info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .exercise-name {
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .dolor-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    /* Sección de nota */
    .note-section {
      margin-top: 14px;
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.02);
      overflow: hidden;
    }

    .note-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 12px 14px;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .note-toggle:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    .note-toggle:active {
      background: rgba(0, 0, 0, 0.05);
    }

    .note-icon {
      font-size: 1.15rem;
      color: #9ca3af;
    }

    .note-label {
      flex: 1;
      text-align: left;
      font-size: 0.8rem;
      font-weight: 500;
      color: #6b7280;
    }

    .expand-icon {
      font-size: 1.25rem;
      color: #9ca3af;
      transition: transform 0.3s ease;
    }

    .expand-icon.rotated {
      transform: rotate(180deg);
    }

    .note-input-container {
      padding: 0 14px 14px;
    }

    .note-input {
      width: 100%;
      padding: 14px;
      border: 1.5px solid rgba(var(--kengo-primary-rgb), 0.15);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.8);
      font-size: 0.875rem;
      color: #374151;
      resize: none;
      transition: all 0.2s ease;
    }

    .note-input::placeholder {
      color: #9ca3af;
    }

    .note-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-primary-rgb), 0.1);
    }

    /* === Tarjeta de observaciones === */
    .observations-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 20px;
      box-shadow:
        0 4px 24px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    .observations-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }

    .observations-icon {
      font-size: 1.25rem;
      color: var(--tertiary);
    }

    .observations-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #1f2937;
    }

    .observations-optional {
      font-size: 0.75rem;
      font-weight: 500;
      color: #9ca3af;
    }

    .observations-input {
      width: 100%;
      padding: 16px;
      border: 1.5px solid rgba(var(--kengo-tertiary-rgb), 0.2);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.7);
      font-size: 0.875rem;
      color: #374151;
      resize: none;
      transition: all 0.2s ease;
    }

    .observations-input::placeholder {
      color: #9ca3af;
    }

    .observations-input:focus {
      outline: none;
      border-color: var(--tertiary);
      box-shadow: 0 0 0 3px rgba(var(--kengo-tertiary-rgb), 0.15);
    }

    /* === Footer con CTA === */
    .actions-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 50;
      padding: 16px 20px calc(var(--safe-bottom) + 20px);
      background: linear-gradient(
        to top,
        rgba(255, 248, 247, 0.98) 60%,
        rgba(255, 248, 247, 0) 100%
      );
    }

    .footer-content {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .incomplete-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 12px;
      border: 1px solid rgba(var(--kengo-primary-rgb), 0.1);
    }

    .hint-icon {
      font-size: 1rem;
      color: var(--primary);
    }

    .incomplete-hint span:last-child {
      font-size: 0.75rem;
      font-weight: 500;
      color: #64748b;
    }

    /* Botón CTA */
    .cta-button {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      height: 58px;
      border: none;
      border-radius: 20px;
      background: linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%);
      cursor: not-allowed;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cta-button.ready {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      cursor: pointer;
      box-shadow:
        0 4px 24px rgba(var(--kengo-primary-rgb), 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .cta-button.ready:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 32px rgba(var(--kengo-primary-rgb), 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .cta-button.ready:active {
      transform: translateY(0) scale(0.98);
    }

    .btn-text {
      font-size: 1.05rem;
      font-weight: 700;
      color: white;
    }

    .btn-icon {
      font-size: 1.35rem;
      color: white;
    }

    /* Shimmer effect en botón ready */
    .btn-shimmer {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.2) 50%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .cta-button.ready .btn-shimmer {
      opacity: 1;
      animation: shimmer 2.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    .icon-filled {
      font-variation-settings:
        'FILL' 1,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24;
    }

    /* === Estilos para la escala de dolor embebida === */
    :host ::ng-deep .escala-container {
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: none;
    }

    /* === Desktop === */
    @media (min-width: 768px) {
      .floating-header {
        padding: calc(var(--safe-top) + 20px) 32px 20px;
      }

      .celebration-badge {
        width: 56px;
        height: 56px;
      }

      .header-title {
        font-size: 1.3rem;
      }

      .main-content {
        padding: 24px 32px;
        padding-bottom: calc(var(--safe-bottom) + 160px);
      }

      .exercises-list {
        gap: 20px;
      }

      .exercise-card,
      .observations-card,
      .global-feedback-card {
        padding: 24px;
        border-radius: 28px;
      }

      .expand-detail-btn,
      .collapse-detail-btn {
        padding: 18px 20px;
        border-radius: 18px;
      }

      .actions-footer {
        padding: 20px 32px calc(var(--safe-bottom) + 24px);
      }

      .cta-button {
        height: 62px;
        border-radius: 22px;
      }

      .orb-1 { width: 350px; height: 350px; }
      .orb-2 { width: 280px; height: 280px; }
      .orb-3 { width: 220px; height: 220px; }
      .orb-4 { width: 180px; height: 180px; }
    }

    @media (min-width: 1024px) {
      .exercises-list {
        max-width: 700px;
      }

      .orb-1 { width: 400px; height: 400px; }
      .orb-2 { width: 320px; height: 320px; }
      .orb-3 { width: 260px; height: 260px; }
      .orb-4 { width: 200px; height: 200px; }
    }
  `,
})
export class FeedbackFinalComponent {
  @Output() enviarFeedback = new EventEmitter<FeedbackFinalData>();

  private registroService = inject(RegistroSesionService);

  // Estado interno - modo de feedback
  private _modoDetallado = signal(false);
  readonly modoDetallado = this._modoDetallado.asReadonly();

  // Dolor global para modo simplificado
  private _dolorGlobal = signal<number | null>(null);
  readonly dolorGlobal = this._dolorGlobal.asReadonly();

  // Estado interno - modo detallado
  private _dolorPorEjercicio = signal<Map<number, number>>(new Map());
  private _notasPorEjercicio = signal<Map<number, string>>(new Map());
  private _notasExpandidas = signal<Set<number>>(new Set());
  observacionesGenerales = '';

  // Para el anillo de progreso circular
  readonly circumference = 2 * Math.PI * 18; // r = 18

  // Confetti pieces
  readonly confettiPieces = Array.from({ length: 20 }, (_, i) => i);

  // Computed - lista de ejercicios completados
  readonly ejerciciosCompletados = computed(() => {
    const lista = this.registroService.ejerciciosList();
    return lista.map((ej) => ({
      planItemId: this.registroService.modoMultiPlan()
        ? (ej as any).planItemId
        : ej.id,
      nombre: ej.ejercicio?.nombre_ejercicio || 'Ejercicio',
    }));
  });

  readonly totalEjercicios = computed(() => this.ejerciciosCompletados().length);

  readonly dolorPorEjercicio = this._dolorPorEjercicio.asReadonly();
  readonly notasPorEjercicio = this._notasPorEjercicio.asReadonly();
  readonly notasExpandidas = this._notasExpandidas.asReadonly();

  readonly ejerciciosConDolor = computed(() => this._dolorPorEjercicio().size);

  // Validación para modo detallado (todos los ejercicios con dolor)
  readonly todosCompletadosDetallado = computed(() => {
    const total = this.ejerciciosCompletados().length;
    const completados = this._dolorPorEjercicio().size;
    return total > 0 && completados === total;
  });

  // Validación para modo simplificado (solo dolor global)
  readonly puedeFinalizarSimplificado = computed(() =>
    this._dolorGlobal() !== null
  );

  // Validación unificada según el modo activo
  readonly todosCompletados = computed(() =>
    this._modoDetallado()
      ? this.todosCompletadosDetallado()
      : this.puedeFinalizarSimplificado()
  );

  // Progreso para el anillo circular (stroke-dashoffset)
  readonly progressOffset = computed(() => {
    const total = this.totalEjercicios();
    if (total === 0) return this.circumference;
    const progress = this.ejerciciosConDolor() / total;
    return this.circumference * (1 - progress);
  });

  // Colores de dolor para los badges
  private readonly dolorColores: Record<number, string> = {
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

  getDolorColor(dolor: number): string {
    return this.dolorColores[dolor] || '#6b7280';
  }

  // Confetti helpers
  getConfettiX(index: number): string {
    return `${5 + (index * 4.5)}%`;
  }

  getConfettiRotation(index: number): string {
    return `${(index * 37) % 360}deg`;
  }

  toggleNota(planItemId: number): void {
    this._notasExpandidas.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(planItemId)) {
        newSet.delete(planItemId);
      } else {
        newSet.add(planItemId);
      }
      return newSet;
    });
  }

  onDolorChange(planItemId: number, dolor: number): void {
    this._dolorPorEjercicio.update((map) => {
      const newMap = new Map(map);
      newMap.set(planItemId, dolor);
      return newMap;
    });
  }

  onNotaChange(planItemId: number, nota: string): void {
    this._notasPorEjercicio.update((map) => {
      const newMap = new Map(map);
      if (nota.trim()) {
        newMap.set(planItemId, nota.trim());
      } else {
        newMap.delete(planItemId);
      }
      return newMap;
    });
  }

  // Métodos para el modo simplificado/detallado
  onDolorGlobalChange(dolor: number): void {
    this._dolorGlobal.set(dolor);
  }

  activarModoDetallado(): void {
    // Si hay dolor global, copiarlo a todos los ejercicios sin valor
    const dolorGlobal = this._dolorGlobal();
    if (dolorGlobal !== null) {
      this._dolorPorEjercicio.update((map) => {
        const newMap = new Map(map);
        this.ejerciciosCompletados().forEach((ej) => {
          if (!newMap.has(ej.planItemId)) {
            newMap.set(ej.planItemId, dolorGlobal);
          }
        });
        return newMap;
      });
    }
    this._modoDetallado.set(true);
  }

  desactivarModoDetallado(): void {
    this._modoDetallado.set(false);
  }

  onFinalizar(): void {
    if (!this.todosCompletados()) return;

    let feedbacks: FeedbackFinalData['feedbacks'];

    if (this._modoDetallado()) {
      // Modo detallado: comportamiento actual
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: this._dolorPorEjercicio().get(ej.planItemId)!,
        nota: this._notasPorEjercicio().get(ej.planItemId),
      }));
    } else {
      // Modo simplificado: aplicar dolor global a todos
      const dolorGlobal = this._dolorGlobal()!;
      feedbacks = this.ejerciciosCompletados().map((ej) => ({
        planItemId: ej.planItemId,
        dolor: dolorGlobal,
        nota: undefined,
      }));
    }

    this.enviarFeedback.emit({
      feedbacks,
      observacionesGenerales: this.observacionesGenerales.trim() || undefined,
    });
  }
}
