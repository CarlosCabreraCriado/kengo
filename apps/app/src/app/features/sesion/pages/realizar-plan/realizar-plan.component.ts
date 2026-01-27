import {
  Component,
  inject,
  OnInit,
  computed,
  HostListener,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RegistroSesionService } from '../../data-access/registro-sesion.service';

// Pantallas
import { ResumenSesionComponent } from './pantallas/resumen-sesion/resumen-sesion.component';
import { EjercicioActivoComponent } from './pantallas/ejercicio-activo/ejercicio-activo.component';
import { DescansoComponent } from './pantallas/descanso/descanso.component';
import {
  FeedbackFinalComponent,
  FeedbackFinalData,
} from './pantallas/feedback-final/feedback-final.component';

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
    FeedbackFinalComponent,
  ],
  animations: [slideAnimation, fadeAnimation],
  template: `
    <section class="fixed inset-0 flex flex-col">
      <!-- Contenido principal -->
      <main
        class="flex flex-1 flex-col overflow-hidden"
        [@slide]="pantallaIndex()"
      >
        @switch (estadoPantalla()) {
          @case ('resumen') {
            <app-resumen-sesion (comenzar)="onComenzar()" />
          }
          @case ('ejercicio') {
            <app-ejercicio-activo
              (completarSerie)="onCompletarSerie()"
              (pausar)="onPausar()"
              (salir)="onIntentarSalir()"
            />
          }
          @case ('descanso') {
            <app-descanso
              (saltar)="onSaltarDescanso()"
              (tiempoAgotado)="onDescansoTerminado()"
              (agregarTiempo)="onAgregarTiempo($event)"
              (salir)="onIntentarSalir()"
            />
          }
          @case ('feedback-final') {
            <app-feedback-final
              (enviarFeedback)="onEnviarFeedbackFinal($event)"
            />
          }
        }
      </main>

      <!-- Loading overlay -->
      @if (cargando()) {
        <div
          class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white/95 backdrop-blur-md"
        >
          <div
            class="h-14 w-14 animate-spin rounded-full border-4 border-zinc-200 border-t-[#e75c3e]"
          ></div>
          <span class="text-base font-medium text-zinc-500"
            >Cargando tu plan...</span
          >
        </div>
      }

      <!-- Error overlay -->
      @if (error()) {
        <div
          class="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 px-4 backdrop-blur-md"
          @fade
        >
          <div
            class="tarjeta-kengo flex max-w-sm flex-col items-center gap-5 rounded-3xl p-8 text-center"
          >
            <span class="material-symbols-outlined text-6xl text-red-400">sentiment_dissatisfied</span>
            <h2 class="text-base font-medium text-zinc-700">{{ error() }}</h2>
            <button
              type="button"
              class="cta-button flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold text-white"
              (click)="reintentar()"
            >
              Reintentar
            </button>
            <button
              type="button"
              class="flex h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-zinc-200 text-sm font-semibold text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-600"
              (click)="onVolverInicio()"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      }

      <!-- Modal de confirmación de salida -->
      @if (mostrarConfirmacionSalida()) {
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          (click)="cancelarSalida()"
          @fade
        >
          <div
            class="flex max-w-[320px] flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <span class="material-symbols-outlined text-4xl text-orange-600">warning</span>
            </div>

            <div class="flex flex-col gap-2">
              <h2 class="m-0 text-lg font-bold text-zinc-800">Salir de la sesión</h2>
              <p class="m-0 text-sm text-zinc-500">
                Tu progreso en esta sesión se perderá. ¿Estás seguro de que quieres salir?
              </p>
            </div>

            <div class="flex w-full flex-col gap-2">
              <button
                type="button"
                class="flex h-12 w-full items-center justify-center rounded-xl bg-zinc-800 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
                (click)="confirmarSalida()"
              >
                Sí, salir
              </button>
              <button
                type="button"
                class="flex h-12 w-full items-center justify-center rounded-xl border-[1.5px] border-zinc-200 text-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                (click)="cancelarSalida()"
              >
                Continuar sesión
              </button>
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

    section {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .cta-button {
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      box-shadow: 0 4px 16px rgba(231, 92, 62, 0.35);
    }

    .cta-button:hover {
      box-shadow: 0 6px 20px rgba(231, 92, 62, 0.45);
    }
  `,
})
export class RealizarPlanComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private registroService = inject(RegistroSesionService);

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
      return; // La sesion ya esta lista desde actividad-personal
    }

    // Flujo original: cargar por planId de la ruta
    const planId = this.route.snapshot.paramMap.get('planId');
    const success = await this.registroService.iniciarSesion(
      planId ? parseInt(planId, 10) : undefined,
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
