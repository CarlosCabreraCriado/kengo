import { Component, inject, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { Ejercicio, Usuario } from '../../types/global';

import { PlanBuilderService } from '../services/plan-builder.service';
import { EjerciciosService } from '../services/ejercicios.service';
import { ActivatedRoute, RouterLink } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';

// RxJS
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-detalle-ejercicio',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './detalle-ejercicio.component.html',
  styleUrl: './detalle-ejercicio.component.css',
})
export class DetalleEjercicioComponent {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private ejerciciosService = inject(EjerciciosService);
  private planBuilderService = inject(PlanBuilderService);
  private dialog = inject(MatDialog);

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  // Estado del ejercicio
  id_ejercicio = signal<string | number | null>(null);
  ejercicio = signal<Ejercicio | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Estado de la UI
  videoExpandido = signal<boolean>(false);
  videoReproduciendo = signal<boolean>(true);
  duracionSeleccionada = signal<number>(60);

  // Control de gestos táctiles
  private touchStartY = 0;

  // Opciones de duración
  readonly duraciones = [
    { label: '30 seg', valor: 30 },
    { label: '1 min', valor: 60 },
    { label: '2 min', valor: 120 },
    { label: '3 min', valor: 180 },
  ];

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((idParam) => {
        this.error.set(null);
        this.ejercicio.set(null);
        this.id_ejercicio.set(idParam ?? null);
        this.cargar();
      });

    // Re-hidratar desde caché si está disponible
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

    // Primero busca en caché
    const cached = this.ejerciciosService.findInCacheById(id);
    if (cached) {
      this.ejercicio.set(cached);
      this.loading.set(false);
      return;
    }

    // Si no está en caché, pide al servidor
    this.loading.set(true);
    this.ejerciciosService.getEjercicioById$(id).subscribe({
      next: (ex: Ejercicio) => {
        this.ejercicio.set(ex);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error(err);
        this.error.set('No se pudo cargar el ejercicio.');
        this.loading.set(false);
      },
    });
  }

  getAssetUrl(id: number | string) {
    return this.ejerciciosService.getAssetUrl(String(id));
  }

  // Métodos de UI
  toggleExpandido() {
    this.videoExpandido.update((v) => !v);
  }

  toggleVideo() {
    if (!this.videoPlayer?.nativeElement) return;

    const video = this.videoPlayer.nativeElement;
    if (video.paused) {
      video.play();
      this.videoReproduciendo.set(true);
    } else {
      video.pause();
      this.videoReproduciendo.set(false);
    }
  }

  seleccionarDuracion(valor: number) {
    this.duracionSeleccionada.set(valor);
  }

  // Scroll con rueda del ratón (desktop)
  onWheel(event: WheelEvent) {
    // Scroll hacia abajo → expandir
    if (event.deltaY > 30 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Scroll hacia arriba → contraer
    if (event.deltaY < -30 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  // Gestos táctiles (móvil)
  onTouchStart(event: TouchEvent) {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = this.touchStartY - touchEndY;

    // Swipe hacia arriba (deltaY > 0) → expandir
    if (deltaY > 50 && !this.videoExpandido()) {
      this.videoExpandido.set(true);
    }
    // Swipe hacia abajo (deltaY < 0) → contraer
    if (deltaY < -50 && this.videoExpandido()) {
      this.videoExpandido.set(false);
    }
  }

  async asignarEjercicio() {
    const ejercicio = this.ejercicio();
    if (!ejercicio) return;

    // Si no hay paciente seleccionado, mostrar diálogo para seleccionar uno
    if (!this.planBuilderService.paciente()) {
      const paciente = await this.seleccionarPaciente();
      if (!paciente) return; // Usuario canceló la selección

      // Establecer el paciente seleccionado
      this.planBuilderService.paciente.set(paciente);
      localStorage.setItem('carrito:last_paciente_id', paciente.id);
      const fisioId = this.planBuilderService.fisioId();
      if (fisioId) {
        localStorage.setItem('carrito:last_fisio_id', fisioId);
      }
    }

    // Añadir el ejercicio al carrito
    this.planBuilderService.addEjercicio(ejercicio);
  }

  private async seleccionarPaciente(): Promise<Usuario | null> {
    const { SelectorPacienteComponent } = await import(
      '../selector-paciente/selector-paciente.component'
    );

    const dialogRef = this.dialog.open(SelectorPacienteComponent, {
      width: '500px',
      maxWidth: '95vw',
      maxHeight: '80vh',
    });

    return new Promise((resolve) => {
      dialogRef.afterClosed().subscribe((paciente: Usuario | undefined) => {
        resolve(paciente || null);
      });
    });
  }

  volver() {
    this.location.back();
  }
}
