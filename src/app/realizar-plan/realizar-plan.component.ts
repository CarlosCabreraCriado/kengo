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
    :host {
      display: block;
      height: 100%;
    }

    .realizar-plan-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, #fafbfc 0%, #f1f3f5 50%, #e8ecef 100%);
      overflow: hidden;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.98), rgba(255,255,255,0.85));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
    }

    .btn-back {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: none;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 14px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.04),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .btn-back:hover {
      background: rgba(255, 255, 255, 0.9);
      transform: translateX(-2px);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.08),
        inset 0 0 0 1px rgba(255, 255, 255, 0.8);
    }

    .btn-back:active {
      transform: translateX(-1px);
    }

    .btn-back .icon {
      font-size: 1.25rem;
      transition: transform 0.3s ease;
    }

    .btn-back:hover .icon {
      transform: translateX(-3px);
    }

    .progreso-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 12px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    }

    .progreso-texto {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #374151;
    }

    .progreso-bar {
      width: 100px;
      height: 8px;
      background: rgba(231, 92, 62, 0.15);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .progreso-fill {
      height: 100%;
      background: linear-gradient(90deg, #e75c3e 0%, #efc048 100%);
      border-radius: 4px;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 8px rgba(231, 92, 62, 0.3);
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 8px 20px 20px;
      overflow: hidden;
      min-height: 0;
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
      gap: 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .loading-spinner {
      width: 56px;
      height: 56px;
      border: 5px solid rgba(231, 92, 62, 0.15);
      border-top-color: #e75c3e;
      border-radius: 50%;
      animation: spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.2);
    }

    .loading-text {
      font-size: 1.0625rem;
      color: #6b7280;
      font-weight: 500;
    }

    .error-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 36px 32px;
      text-align: center;
      max-width: 340px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 24px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.08),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .error-icon {
      font-size: 3.5rem;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }

    .error-card h2 {
      font-size: 1.0625rem;
      color: #374151;
      margin: 0;
      line-height: 1.5;
    }

    .btn-primary {
      width: 100%;
      padding: 18px 28px;
      border: none;
      border-radius: 16px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      color: white;
      font-size: 1.0625rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 24px rgba(231, 92, 62, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(231, 92, 62, 0.4);
    }

    .btn-primary:active {
      transform: translateY(-1px);
    }

    .btn-secondary {
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #6b7280;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.9);
      color: #374151;
      transform: translateY(-1px);
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
