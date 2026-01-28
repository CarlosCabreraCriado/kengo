import { Component, inject, signal, effect, ViewChildren, ElementRef, QueryList, computed } from '@angular/core';
import { Location } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Ejercicio, Usuario } from '../../../../../types/global';

import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { EjerciciosService } from '../../data-access/ejercicios.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-ejercicio-detail',
  standalone: true,
  imports: [RouterLink, SafeHtmlPipe],
  templateUrl: './ejercicio-detail.component.html',
  styleUrl: './ejercicio-detail.component.css',
})
export class EjercicioDetailComponent {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private ejerciciosService = inject(EjerciciosService);
  private planBuilderService = inject(PlanBuilderService);
  private dialog = inject(Dialog);

  @ViewChildren('videoPlayer') videoPlayers!: QueryList<ElementRef<HTMLVideoElement>>;

  // Estado del ejercicio
  id_ejercicio = signal<string | number | null>(null);
  ejercicio = signal<Ejercicio | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Estado de la UI
  videoExpandido = signal<boolean>(false);
  videoReproduciendo = signal<boolean>(true);
  showPlayIndicator = signal<boolean>(false);
  videoLoaded = signal<boolean>(false);

  // Presets de series y repeticiones
  readonly seriesPresets = [1, 3, 5];
  readonly repeticionesPresets = [10, 15, 20];

  // Signals para selección (inicializados con defaults del ejercicio)
  seriesSeleccionadas = signal<number | null>(null);
  repeticionesSeleccionadas = signal<number | null>(null);

  // Flags para mostrar input "Otro"
  mostrarOtroSeries = signal<boolean>(false);
  mostrarOtroRepeticiones = signal<boolean>(false);

  onVideoLoad(): void {
    this.videoLoaded.set(true);
  }

  // Control de gestos tactiles
  private touchStartY = 0;

  // Detectar modo rutina (crear plantilla sin paciente)
  readonly isRutinaMode = computed(() => this.planBuilderService.isRutinaMode());

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((idParam) => {
        this.error.set(null);
        this.ejercicio.set(null);
        this.videoLoaded.set(false);
        this.id_ejercicio.set(idParam ?? null);
        this.cargar();
      });

    // Re-hidratar desde cache si esta disponible
    effect(() => {
      const id = this.id_ejercicio();
      if (!id) return;
      const cached = this.ejerciciosService.findInCacheById(id);
      if (cached && !this.ejercicio()) {
        this.ejercicio.set(cached);
        this.loading.set(false);
        this.error.set(null);
      }
    });
  }

  private cargar() {
    const id = this.id_ejercicio();
    if (!id) return;

    // Primero busca en cache
    const cached = this.ejerciciosService.findInCacheById(id);
    if (cached) {
      this.ejercicio.set(cached);
      this.inicializarPresets();
      this.loading.set(false);
      return;
    }

    // Si no esta en cache, pide al servidor
    this.loading.set(true);
    this.ejerciciosService.getEjercicioById$(id).subscribe({
      next: (ex: Ejercicio) => {
        this.ejercicio.set(ex);
        this.inicializarPresets();
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error(err);
        this.error.set('No se pudo cargar el ejercicio.');
        this.loading.set(false);
      },
    });
  }

  // Inicializar con valores por defecto del ejercicio
  private inicializarPresets() {
    const ej = this.ejercicio();
    if (ej) {
      const seriesDefault = parseInt(ej.series_defecto) || 3;
      const repsDefault = parseInt(ej.repeticiones_defecto) || 10;

      this.seriesSeleccionadas.set(seriesDefault);
      this.repeticionesSeleccionadas.set(repsDefault);

      // Si el valor no está en presets, mostrar "Otro"
      this.mostrarOtroSeries.set(!this.seriesPresets.includes(seriesDefault));
      this.mostrarOtroRepeticiones.set(!this.repeticionesPresets.includes(repsDefault));
    }
  }

  getAssetUrl(id: number | string) {
    return this.ejerciciosService.getAssetUrl(String(id));
  }

  // Metodos de UI
  toggleExpandido() {
    this.videoExpandido.update((v) => !v);
  }

  toggleVideo() {
    const players = this.videoPlayers?.toArray();
    if (!players || players.length === 0) return;

    // Toggle all video players (mobile and desktop)
    players.forEach((playerRef) => {
      const video = playerRef.nativeElement;
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Update state based on first player
    const firstVideo = players[0].nativeElement;
    this.videoReproduciendo.set(!firstVideo.paused);

    // Mostrar indicador de play/pause brevemente
    this.showPlayIndicator.set(true);
    setTimeout(() => this.showPlayIndicator.set(false), 600);
  }

  seleccionarSeries(valor: number | 'otro') {
    if (valor === 'otro') {
      this.mostrarOtroSeries.set(true);
    } else {
      this.seriesSeleccionadas.set(valor);
      this.mostrarOtroSeries.set(false);
    }
  }

  seleccionarRepeticiones(valor: number | 'otro') {
    if (valor === 'otro') {
      this.mostrarOtroRepeticiones.set(true);
    } else {
      this.repeticionesSeleccionadas.set(valor);
      this.mostrarOtroRepeticiones.set(false);
    }
  }

  onSeriesOtroChange(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value);
    if (val > 0) this.seriesSeleccionadas.set(val);
  }

  onRepeticionesOtroChange(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value);
    if (val > 0) this.repeticionesSeleccionadas.set(val);
  }

  // Scroll con rueda del raton (desktop)
  onWheel(event: WheelEvent) {
    // Scroll hacia arriba -> expandir video (ocultar panel)
    if (event.deltaY < -30 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Scroll hacia abajo -> contraer video (mostrar panel)
    if (event.deltaY > 30 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  // Gestos tactiles (movil)
  onTouchStart(event: TouchEvent) {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
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

  async asignarEjercicio() {
    const ejercicio = this.ejercicio();
    if (!ejercicio) return;

    const options = {
      series: this.seriesSeleccionadas() ?? 3,
      repeticiones: this.repeticionesSeleccionadas() ?? 10,
    };

    // En modo rutina, añadir directamente sin pedir paciente
    if (this.isRutinaMode()) {
      this.planBuilderService.addEjercicio(ejercicio, options);
      return;
    }

    // Modo plan: Si no hay paciente seleccionado, mostrar dialogo para seleccionar uno
    if (!this.planBuilderService.paciente()) {
      const paciente = await this.seleccionarPaciente();
      if (!paciente) return; // Usuario cancelo la seleccion

      // Establecer el paciente seleccionado
      this.planBuilderService.paciente.set(paciente);
      localStorage.setItem('carrito:last_paciente_id', paciente.id);
      const fisioId = this.planBuilderService.fisioId();
      if (fisioId) {
        localStorage.setItem('carrito:last_fisio_id', fisioId);
      }
    }

    // Anadir el ejercicio al carrito
    this.planBuilderService.addEjercicio(ejercicio, options);
  }

  private async seleccionarPaciente(): Promise<Usuario | null> {
    const { SelectorPacienteComponent } = await import(
      '../../../../shared/ui/selector-paciente/selector-paciente.component'
    );

    const dialogRef = this.dialog.open<Usuario>(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'selector-paciente-dialog',
    });

    return new Promise((resolve) => {
      dialogRef.closed.subscribe((paciente) => {
        resolve(paciente || null);
      });
    });
  }

  volver() {
    this.location.back();
  }
}
