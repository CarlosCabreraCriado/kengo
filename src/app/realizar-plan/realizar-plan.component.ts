import {
  Component,
  inject,
  OnInit,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RegistroSesionService } from '../services/registro-sesion.service';

// Pantallas
import { ResumenSesionComponent } from './pantallas/resumen-sesion/resumen-sesion.component';
import { EjercicioActivoComponent } from './pantallas/ejercicio-activo/ejercicio-activo.component';
import { DescansoComponent } from './pantallas/descanso/descanso.component';
import { FeedbackEjercicioComponent } from './pantallas/feedback-ejercicio/feedback-ejercicio.component';
import { SesionCompletadaComponent } from './pantallas/sesion-completada/sesion-completada.component';

// Animaciones
import { slideAnimation, fadeAnimation } from './realizar-plan.animations';

@Component({
  selector: 'app-realizar-plan',
  standalone: true,
  imports: [
    CommonModule,
    ResumenSesionComponent,
    EjercicioActivoComponent,
    DescansoComponent,
    FeedbackEjercicioComponent,
    SesionCompletadaComponent,
  ],
  animations: [slideAnimation, fadeAnimation],
  template: `
    <div class="realizar-plan-container">
      <!-- Header -->
      <header class="header" @fade>
        <button
          type="button"
          class="btn-back"
          (click)="volverAtras()"
        >
          <span class="icon">←</span>
          <span class="text">{{ textoBotonAtras() }}</span>
        </button>

        @if (estadoPantalla() !== 'resumen' && estadoPantalla() !== 'completado') {
          <div class="progreso-header">
            <span class="progreso-texto">
              {{ ejercicioActualIndex() + 1 }}/{{ totalEjercicios() }}
            </span>
            <div class="progreso-bar">
              <div
                class="progreso-fill"
                [style.width.%]="progresoSesion()"
              ></div>
            </div>
          </div>
        }
      </header>

      <!-- Contenido principal -->
      <main class="content" [@slide]="pantallaIndex()">
        @switch (estadoPantalla()) {
          @case ('resumen') {
            <app-resumen-sesion
              (comenzar)="onComenzar()"
            />
          }
          @case ('ejercicio') {
            <app-ejercicio-activo
              (completarSerie)="onCompletarSerie()"
              (pausar)="onPausar()"
            />
          }
          @case ('descanso') {
            <app-descanso
              (saltar)="onSaltarDescanso()"
              (tiempoAgotado)="onDescansoTerminado()"
              (agregarTiempo)="onAgregarTiempo($event)"
            />
          }
          @case ('feedback') {
            <app-feedback-ejercicio
              (enviarFeedback)="onEnviarFeedback($event)"
            />
          }
          @case ('completado') {
            <app-sesion-completada
              (volverInicio)="onVolverInicio()"
            />
          }
        }
      </main>

      <!-- Loading overlay -->
      @if (cargando()) {
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <span class="loading-text">Cargando tu plan...</span>
        </div>
      }

      <!-- Error overlay -->
      @if (error()) {
        <div class="error-overlay" @fade>
          <div class="error-card tarjeta-kengo">
            <span class="error-icon">😕</span>
            <h2>{{ error() }}</h2>
            <button
              type="button"
              class="btn-primary"
              (click)="reintentar()"
            >
              Reintentar
            </button>
            <button
              type="button"
              class="btn-secondary"
              (click)="onVolverInicio()"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .realizar-plan-container {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.8));
      backdrop-filter: blur(12px);
    }

    .btn-back {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: none;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-back:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    .btn-back .icon {
      font-size: 1.25rem;
    }

    .progreso-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .progreso-texto {
      font-size: 0.875rem;
      font-weight: 600;
      color: #6b7280;
    }

    .progreso-bar {
      width: 80px;
      height: 6px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .progreso-fill {
      height: 100%;
      background: #e75c3e;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 16px 32px;
      overflow-x: hidden;
    }

    .loading-overlay,
    .error-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(8px);
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(231, 92, 62, 0.2);
      border-top-color: #e75c3e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-text {
      font-size: 1rem;
      color: #6b7280;
    }

    .error-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
      text-align: center;
      max-width: 320px;
    }

    .error-icon {
      font-size: 3rem;
    }

    .error-card h2 {
      font-size: 1rem;
      color: #374151;
      margin: 0;
    }

    .btn-primary {
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      background: #e75c3e;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary:hover {
      background: #d14d31;
      transform: translateY(-1px);
    }

    .btn-secondary {
      width: 100%;
      padding: 12px 24px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: transparent;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      border-color: #d1d5db;
      background: rgba(0, 0, 0, 0.02);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class RealizarPlanComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private registroService = inject(RegistroSesionService);

  // Estado desde el servicio
  readonly estadoPantalla = this.registroService.estadoPantalla;
  readonly ejercicioActualIndex = this.registroService.ejercicioActualIndex;
  readonly totalEjercicios = this.registroService.totalEjercicios;
  readonly progresoSesion = this.registroService.progresoSesion;

  // Estado local
  readonly cargando = computed(() => !this.registroService.planActivo() && !this._error());
  private _error = computed(() => '');

  readonly error = this._error;

  // Para la animación de slide
  readonly pantallaIndex = computed(() => {
    const estados = ['resumen', 'ejercicio', 'descanso', 'feedback', 'completado'];
    return estados.indexOf(this.estadoPantalla());
  });

  readonly textoBotonAtras = computed(() => {
    switch (this.estadoPantalla()) {
      case 'resumen':
        return 'Inicio';
      case 'ejercicio':
        return 'Pausar';
      case 'descanso':
      case 'feedback':
        return 'Volver';
      case 'completado':
        return 'Inicio';
      default:
        return 'Atrás';
    }
  });

  // Gestos táctiles
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    this.inicializarSesion();
  }

  private async inicializarSesion(): Promise<void> {
    const planId = this.route.snapshot.paramMap.get('planId');
    const success = await this.registroService.iniciarSesion(
      planId ? parseInt(planId, 10) : undefined
    );

    if (!success) {
      // El error se manejará a través del estado del servicio
    }
  }

  // Handlers de eventos
  onComenzar(): void {
    this.registroService.comenzarSesion();
  }

  onCompletarSerie(): void {
    this.registroService.completarSerie();
  }

  onPausar(): void {
    this.registroService.pausarSesion();
  }

  onSaltarDescanso(): void {
    this.registroService.saltarDescanso();
  }

  onDescansoTerminado(): void {
    this.registroService.finalizarDescanso();
  }

  onAgregarTiempo(segundos: number): void {
    this.registroService.agregarTiempoDescanso(segundos);
  }

  onEnviarFeedback(feedback: { dolor: number; nota?: string }): void {
    this.registroService.registrarFeedback(feedback.dolor, feedback.nota);
  }

  onVolverInicio(): void {
    this.registroService.resetearEstado();
    this.router.navigate(['/inicio']);
  }

  volverAtras(): void {
    switch (this.estadoPantalla()) {
      case 'resumen':
      case 'completado':
        this.onVolverInicio();
        break;
      case 'ejercicio':
        this.onPausar();
        break;
      default:
        // En otros estados, volver al ejercicio
        this.registroService.estadoPantalla.set('ejercicio');
    }
  }

  reintentar(): void {
    this.inicializarSesion();
  }

  // Gestos táctiles para swipe
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const diff = this.touchStartX - this.touchEndX;
    const threshold = 100;

    // Solo permitir swipe en ciertos estados
    if (this.estadoPantalla() !== 'ejercicio') return;

    if (diff > threshold) {
      // Swipe izquierda -> completar serie
      // No hacer nada automático, el usuario debe tocar el botón
    } else if (diff < -threshold) {
      // Swipe derecha -> pausar
      this.onPausar();
    }
  }
}
