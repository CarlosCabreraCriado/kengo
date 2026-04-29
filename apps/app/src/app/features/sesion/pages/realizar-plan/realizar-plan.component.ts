import {
  Component,
  inject,
  OnInit,
  computed,
  HostListener,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SesionStateService } from '../../data-access/sesion-state.service';

// Pantallas
import { ResumenSesionComponent } from './pantallas/resumen-sesion/resumen-sesion.component';
import { EjercicioActivoComponent } from './pantallas/ejercicio-activo/ejercicio-activo.component';
import { DescansoComponent } from './pantallas/descanso/descanso.component';
import {
  FeedbackFinalComponent,
  FeedbackFinalData,
} from './pantallas/feedback-final/feedback-final.component';

// Componentes adicionales
import { TimelineSesionComponent } from './componentes/timeline-sesion/timeline-sesion.component';
import {
  PreviewEjercicioDialogComponent,
  PreviewEjercicioData,
} from '../../../../shared/ui/preview-ejercicio/preview-ejercicio-dialog.component';
import { DialogService } from '../../../../shared/ui/dialog/dialog.service';
import { EjercicioPlan } from '../../../../../types/global';
import {
  Ui2ButtonComponent,
  Ui2IconBadgeComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

// Animaciones
import { slideAnimation, fadeAnimation } from './realizar-plan.animations';

@Component({
  selector: 'app-realizar-plan',
  standalone: true,
  imports: [
    ResumenSesionComponent,
    EjercicioActivoComponent,
    DescansoComponent,
    FeedbackFinalComponent,
    TimelineSesionComponent,
    Ui2ButtonComponent,
    Ui2IconBadgeComponent,
    Ui2SpinnerComponent,
  ],
  animations: [slideAnimation, fadeAnimation],
  template: `
    <section class="rp-shell">
      <main class="rp-main" [@slide]="pantallaIndex()">
        @switch (estadoPantalla()) {
          @case ('resumen') {
            <app-resumen-sesion (comenzar)="onComenzar()" />
          }
          @case ('ejercicio') {
            <app-ejercicio-activo
              (completarSerie)="onCompletarSerie()"
              (pausar)="onPausar()"
              (salir)="onIntentarSalir()"
              (abrirTimeline)="timelineAbierto.set(true)"
              (previewEjercicio)="onPreviewEjercicio($event)"
            />
          }
          @case ('descanso') {
            <app-descanso
              (saltar)="onSaltarDescanso()"
              (tiempoAgotado)="onDescansoTerminado()"
              (agregarTiempo)="onAgregarTiempo($event)"
              (salir)="onIntentarSalir()"
              (abrirTimeline)="timelineAbierto.set(true)"
              (previewEjercicio)="onPreviewEjercicio($event)"
            />
          }
          @case ('feedback-final') {
            <app-feedback-final
              (enviarFeedback)="onEnviarFeedbackFinal($event)"
            />
          }
        }
      </main>

      <app-timeline-sesion
        [isOpen]="timelineAbierto()"
        (closed)="timelineAbierto.set(false)"
        (previewEjercicio)="onPreviewEjercicio($event)"
      />

      @if (cargando()) {
        <div class="rp-overlay rp-overlay--loading">
          <ui2-spinner size="lg" />
          <span class="rp-overlay__hint">Cargando tu plan…</span>
        </div>
      }

      @if (error()) {
        <div class="rp-overlay rp-overlay--error" @fade>
          <div class="rp-state">
            <ui2-icon-badge icon="sentiment_dissatisfied" color="var(--danger)" [size]="64" [radius]="20" />
            <h2 class="rp-state__title">{{ error() }}</h2>
            <div class="rp-state__actions">
              <ui2-button variant="primary" size="lg" [fullWidth]="true" (clicked)="reintentar()">
                Reintentar
              </ui2-button>
              <ui2-button variant="secondary" size="md" [fullWidth]="true" (clicked)="onVolverInicio()">
                Volver al inicio
              </ui2-button>
            </div>
          </div>
        </div>
      }

      @if (mostrarConfirmacionSalida()) {
        <div class="rp-overlay rp-overlay--confirm" (click)="cancelarSalida()" @fade>
          <div class="rp-state rp-state--confirm" (click)="$event.stopPropagation()">
            <ui2-icon-badge icon="warning" color="var(--warning)" [size]="64" [radius]="20" />
            <div class="rp-state__text">
              <h2 class="rp-state__title">Salir de la sesión</h2>
              <p class="rp-state__message">
                Tu progreso en esta sesión se perderá. ¿Estás seguro de que quieres salir?
              </p>
            </div>
            <div class="rp-state__actions">
              <ui2-button variant="danger" size="md" [fullWidth]="true" (clicked)="confirmarSalida()">
                Sí, salir
              </ui2-button>
              <ui2-button variant="secondary" size="md" [fullWidth]="true" (clicked)="cancelarSalida()">
                Continuar sesión
              </ui2-button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 100;
    }
    .rp-shell {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .rp-main {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
    }
    .rp-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 20px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .rp-overlay--loading {
      flex-direction: column;
      gap: 16px;
      background: rgba(250, 247, 242, 0.92);
    }
    .rp-overlay--error {
      background: rgba(250, 247, 242, 0.92);
    }
    .rp-overlay--confirm {
      z-index: 200;
      background: rgba(0, 0, 0, 0.45);
    }
    .rp-overlay__hint {
      font-family: Galvji, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-500);
    }
    .rp-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      max-width: 360px;
      padding: 28px 24px;
      border-radius: 22px;
      background: white;
      box-shadow: var(--shadow-card-strong);
      text-align: center;
    }
    .rp-state--confirm { max-width: 340px; }
    .rp-state__title {
      margin: 0;
      font-family: KengoDisplay, Galvji, sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: var(--ink-900);
      letter-spacing: -0.2px;
    }
    .rp-state__message {
      margin: 0;
      font-size: 13px;
      color: var(--ink-500);
      line-height: 1.45;
    }
    .rp-state__text {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .rp-state__actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
  `,
})
export class RealizarPlanComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private registroService = inject(SesionStateService);
  private dialogService = inject(DialogService);

  // Estado desde el servicio
  readonly estadoPantalla = this.registroService.estadoPantalla;

  // Estado local
  readonly cargando = computed(() => {
    // En modo multi-plan, verificar ejerciciosMultiPlan
    if (this.registroService.modoMultiPlan()) {
      return (
        this.registroService.ejerciciosMultiPlan().length === 0 &&
        !this._error()
      );
    }
    // En modo normal, verificar planActivo
    return !this.registroService.planActivo() && !this._error();
  });
  private _error = computed(() => '');

  readonly error = this._error;

  // Modal de confirmación
  readonly mostrarConfirmacionSalida = signal(false);

  // Timeline drawer
  readonly timelineAbierto = signal(false);

  // Para la animación de slide
  readonly pantallaIndex = computed(() => {
    const estados = ['resumen', 'ejercicio', 'descanso', 'feedback-final'];
    return estados.indexOf(this.estadoPantalla());
  });

  // Gestos táctiles
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    this.inicializarSesion();
  }

  private async inicializarSesion(): Promise<void> {
    // Si ya hay una sesion multi-plan configurada, usarla
    if (
      this.registroService.modoMultiPlan() &&
      this.registroService.configSesion()
    ) {
      // Si viene de actividad-personal con skipResumen, comenzar directamente
      if (this.registroService.configSesion()?.skipResumen) {
        await this.onComenzar();
      }
      return;
    }

    // Flujo original: cargar por planId de la ruta
    const planId = this.route.snapshot.paramMap.get('planId');
    const success = await this.registroService.iniciarSesion(
      planId ?? undefined,
    );

    if (!success) {
      // El error se manejará a través del estado del servicio
    }
  }

  // Handlers de eventos
  async onComenzar(): Promise<void> {
    await this.registroService.comenzarSesion();
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

  async onEnviarFeedbackFinal(data: FeedbackFinalData): Promise<void> {
    await this.registroService.aplicarFeedbackFinal(data);
    this.onVolverInicio();
  }

  onVolverInicio(): void {
    this.registroService.resetearEstado();
    this.router.navigate(['/inicio']);
  }

  onIntentarSalir(): void {
    this.mostrarConfirmacionSalida.set(true);
  }

  confirmarSalida(): void {
    this.mostrarConfirmacionSalida.set(false);
    this.onVolverInicio();
  }

  cancelarSalida(): void {
    this.mostrarConfirmacionSalida.set(false);
  }

  reintentar(): void {
    this.inicializarSesion();
  }

  onPreviewEjercicio(event: { ejercicio: EjercicioPlan; index: number }): void {
    const ej = event.ejercicio;
    const currentIdx = this.registroService.ejercicioActualIndex();

    const data: PreviewEjercicioData = {
      ejercicio: ej,
      index: event.index,
      totalEjercicios: this.registroService.totalEjercicios(),
      videoUrl: this.registroService.getVideoUrl(ej.ejercicio?.video),
      posterUrl: this.registroService.getAssetUrl(ej.ejercicio?.portada, 800, 450),
      estado:
        event.index < currentIdx
          ? 'completado'
          : event.index === currentIdx
            ? 'activo'
            : 'pendiente',
    };

    this.dialogService.open(PreviewEjercicioDialogComponent, {
      data,
      maxWidth: '420px',
      maxHeight: '85vh',
    });
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
