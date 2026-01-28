import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { EjercicioPlan, DiaSemana } from '../../../../../types/global';
import { environment as env } from '../../../../../environments/environment';
import { SafeHtmlPipe, KENGO_BREAKPOINTS } from '../../../../shared';

@Component({
  selector: 'app-rutina-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    RouterLink,
    SafeHtmlPipe,
  ],
  templateUrl: './rutina-builder.component.html',
  styleUrl: './rutina-builder.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class RutinaBuilderComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private router = inject(Router);
  private dialog = inject(Dialog);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private breakpointObserver = inject(BreakpointObserver);
  svc = inject(PlanBuilderService);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  dias: DiaSemana[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  diasNombres: Record<DiaSemana, string> = {
    L: 'Lunes',
    M: 'Martes',
    X: 'Miercoles',
    J: 'Jueves',
    V: 'Viernes',
    S: 'Sabado',
    D: 'Domingo',
  };

  isSaving = signal(false);

  // Signals para modo edicion por ejercicio
  ejercicioEditando = signal<number | null>(null);

  // Computed para UI
  items = computed(() => this.svc.items());
  totalItems = computed(() => this.svc.totalItems());
  canSave = computed(() => this.svc.canSaveAsRutina() && !this.isSaving());

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    visibilidad: ['privado' as 'privado' | 'publico'],
  });

  ngOnInit() {
    // Verificar que estamos en modo rutina y hay ejercicios
    if (!this.svc.isRutinaMode()) {
      this.toastService.show('Inicia la creación de plantilla primero');
      this.router.navigate(['/galeria/rutinas']);
      return;
    }

    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios primero');
      this.router.navigate(['/galeria/ejercicios']);
      return;
    }
  }

  ngOnDestroy() {
    this.svc.closeDrawer();
  }

  // ========= Drag & Drop =========

  onDrop(ev: CdkDragDrop<unknown[]>) {
    if (ev.previousIndex === ev.currentIndex) return;
    this.svc.reorder(ev.previousIndex, ev.currentIndex);
  }

  // ========= Exercise Updates =========

  update(i: number, patch: Partial<EjercicioPlan>) {
    this.svc.updateItem(i, patch);
  }

  isDia(it: EjercicioPlan, d: DiaSemana) {
    return it.dias_semana?.includes(d);
  }

  toggleDia(i: number, d: DiaSemana) {
    const it = this.svc.items()[i];
    const set = new Set(it.dias_semana || []);
    if (set.has(d)) {
      set.delete(d);
    } else {
      set.add(d);
    }
    this.svc.updateItem(i, { dias_semana: Array.from(set) as DiaSemana[] });
  }

  removeEjercicio(ejercicioId: number) {
    this.svc.removeEjercicio(ejercicioId);
    // Si no quedan ejercicios, volver a la galería
    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios a la plantilla');
      this.router.navigate(['/galeria/ejercicios']);
    }
  }

  // ========= Actions =========

  async guardarPlantilla() {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.toastService.show('Completa los campos requeridos');
      return;
    }

    if (!this.canSave()) {
      this.toastService.show('Faltan datos para guardar');
      return;
    }

    this.isSaving.set(true);
    try {
      const v = this.form.value;
      const rutinaId = await this.svc.saveAsRutina(
        v.nombre || 'Plantilla sin nombre',
        v.descripcion || '',
        v.visibilidad || 'privado',
      );

      if (rutinaId) {
        this.toastService.show('Plantilla guardada');
        this.svc.exitRutinaMode();
        this.router.navigate(['/galeria/rutinas']);
      } else {
        this.toastService.show('Error al guardar plantilla', 'error');
      }
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      this.toastService.show('Error al guardar', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  cancelar() {
    // Volver a galería de ejercicios manteniendo el modo rutina
    this.location.back();
  }

  salirModoRutina() {
    this.svc.exitRutinaMode();
    this.router.navigate(['/galeria/rutinas']);
  }

  // ========= Helpers =========

  assetUrl(id: string | null | undefined, w = 200, h = 200) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }

  trackByIndex(index: number) {
    return index;
  }
}
