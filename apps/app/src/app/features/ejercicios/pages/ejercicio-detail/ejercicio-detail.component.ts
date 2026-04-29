import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { Ejercicio, Usuario, Categoria } from '../../../../../types/global';

import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { RutinaBuilderService } from '../../../rutinas/data-access/rutina-builder.service';
import { EjerciciosService } from '../../data-access/ejercicios.service';
import { SessionService } from '../../../../core/auth/services/session.service';

import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import { VideoEjercicioComponent } from '../../../../shared/ui/video-ejercicio/video-ejercicio.component';
import {
  Ui2BackButtonComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2SectionLabelComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

@Component({
  selector: 'app-ejercicio-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SafeHtmlPipe,
    VideoEjercicioComponent,
    Ui2BackButtonComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SectionLabelComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './ejercicio-detail.component.html',
  styleUrl: './ejercicio-detail.component.css',
})
export class EjercicioDetailComponent {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private ejerciciosService = inject(EjerciciosService);
  private planBuilderService = inject(PlanBuilderService);
  private rutinaBuilderService = inject(RutinaBuilderService);
  public sessionService = inject(SessionService);
  private dialog = inject(Dialog);

  // Estado del ejercicio
  id = signal<string | null>(null);
  ejercicio = signal<Ejercicio | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Presets de series y repeticiones
  readonly seriesPresets = [1, 3, 5];
  readonly repeticionesPresets = [10, 15, 20];

  // Signals para selección (inicializados con defaults del ejercicio)
  seriesSeleccionadas = signal<number | null>(null);
  repeticionesSeleccionadas = signal<number | null>(null);

  // Flags para mostrar input "Otro"
  mostrarOtroSeries = signal<boolean>(false);
  mostrarOtroRepeticiones = signal<boolean>(false);

  // Detectar modo rutina (crear plantilla sin paciente)
  readonly isRutinaMode = computed(() => this.rutinaBuilderService.isActive());

  // Lookup de categorias para resolver nombres a partir de IDs
  private readonly categoriasMap = computed(() => {
    const cats = this.ejerciciosService.categoriasRes.value() ?? [];
    const map = new Map<string, string>();
    for (const c of cats as Categoria[]) {
      map.set(c.id, c.nombre);
    }
    return map;
  });

  // Tags resueltos a nombres legibles
  readonly categoriasNombres = computed<string[]>(() => {
    const ej = this.ejercicio();
    if (!ej?.categoria?.length) return [];
    const map = this.categoriasMap();
    return ej.categoria.map((id) => map.get(id) ?? id).filter(Boolean);
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((idParam) => {
        this.error.set(null);
        this.ejercicio.set(null);
        this.id.set(idParam ?? null);
        this.cargar();
      });

    // Re-hidratar desde cache si esta disponible
    effect(() => {
      const id = this.id();
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
    const id = this.id();
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
      const seriesDefault = ej.seriesDefecto ?? 3;
      const repsDefault = ej.repeticionesDefecto ?? 10;

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

  getVideoUrl(id?: number | string | null) {
    return id ? this.ejerciciosService.getVideoUrl(String(id)) : '';
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

  onSeriesOtroChange(value: string | number) {
    const val = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isNaN(val) && val > 0) this.seriesSeleccionadas.set(val);
  }

  onRepeticionesOtroChange(value: string | number) {
    const val = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isNaN(val) && val > 0) this.repeticionesSeleccionadas.set(val);
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
      this.rutinaBuilderService.add(ejercicio, options);
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
