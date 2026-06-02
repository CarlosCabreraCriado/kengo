import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Location, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Dialog } from '@angular/cdk/dialog';

import { assetUrl } from '../../../../core/utils/asset-url';
import { RutinaBuilderService } from '../../data-access/rutina-builder.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { EjercicioPlan, DiaSemana } from '../../../../../types/global';
import { SafeHtmlPipe, useResponsive } from '../../../../shared';
import {
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2InputComponent,
  Ui2PillComponent,
  Ui2RadioGroupComponent,
  Ui2SectionComponent,
  Ui2SpinnerComponent,
  Ui2TextareaComponent,
  type Ui2RadioOption,
} from '../../../../shared/ui-v2';

@Component({
  selector: 'app-rutina-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    NgOptimizedImage,
    RouterLink,
    SafeHtmlPipe,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2InputComponent,
    Ui2PillComponent,
    Ui2RadioGroupComponent,
    Ui2SectionComponent,
    Ui2SpinnerComponent,
    Ui2TextareaComponent,
  ],
  templateUrl: './rutina-builder.component.html',
  styleUrl: './rutina-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class RutinaBuilderComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialog = inject(Dialog);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private logger = inject(LoggerService);
  svc = inject(RutinaBuilderService);

  isDesktop = useResponsive().esDesktop;

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

  readonly visibilidadOptions: Ui2RadioOption[] = [
    {
      value: 'privado',
      label: 'Privada',
      description: 'Solo tú puedes usarla',
    },
    {
      value: 'clinica',
      label: 'Clínica',
      description: 'Visible para los fisios de tu clínica',
    },
  ];

  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly isEditMode = signal(false);

  // Signals para modo edicion por ejercicio
  readonly ejercicioEditando = signal<number | null>(null);

  // Computed para UI
  readonly items = computed(() => this.svc.items());
  readonly totalItems = computed(() => this.svc.totalItems());
  readonly canSave = computed(() => this.svc.canSave() && !this.isSaving());

  readonly pageOverline = computed(() => {
    const total = this.totalItems();
    return `${total} ejercicio${total === 1 ? '' : 's'} en la plantilla`;
  });

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    visibilidad: ['privado' as 'privado' | 'clinica'],
  });

  readonly nombreError = computed<string | null>(() => {
    const c = this.form.controls.nombre;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'El nombre es requerido';
    if (c.hasError('minlength')) return 'Mínimo 3 caracteres';
    return null;
  });

  async ngOnInit() {
    const rutinaId = this.route.snapshot.paramMap.get('id');

    if (rutinaId) {
      // Modo edición: cargar rutina existente
      this.isLoading.set(true);
      const result = await this.svc.startEdit(rutinaId);
      this.isLoading.set(false);

      if (!result) {
        this.toastService.show('No se pudo cargar la rutina', 'error');
        this.router.navigate(['/rutinas']);
        return;
      }

      this.isEditMode.set(true);
      this.form.patchValue({
        nombre: this.svc.titulo(),
        descripcion: this.svc.descripcion(),
        visibilidad: result.visibilidad as 'privado' | 'clinica',
      });
      return;
    }

    // Modo creación: verificar que estamos en modo rutina y hay ejercicios
    if (!this.svc.isActive()) {
      this.toastService.show('Inicia la creación de plantilla primero');
      this.router.navigate(['/rutinas']);
      return;
    }

    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios primero');
      this.router.navigate(['/ejercicios']);
      return;
    }
  }

  ngOnDestroy() {
    this.svc.closeDrawer();
  }

  navegarACatalogo() {
    this.router.navigate(['/ejercicios']);
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

  updateNumber(i: number, key: keyof EjercicioPlan, ev: Event) {
    const v = +(ev.target as HTMLInputElement).value || 0;
    this.svc.updateItem(i, { [key]: v } as Partial<EjercicioPlan>);
  }

  updateText(i: number, key: keyof EjercicioPlan, ev: Event) {
    const v = (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.svc.updateItem(i, { [key]: v } as Partial<EjercicioPlan>);
  }

  isDia(it: EjercicioPlan, d: DiaSemana) {
    return it.diasSemana?.includes(d);
  }

  toggleDia(i: number, d: DiaSemana) {
    const it = this.svc.items()[i];
    const set = new Set(it.diasSemana || []);
    if (set.has(d)) {
      set.delete(d);
    } else {
      set.add(d);
    }
    this.svc.updateItem(i, { diasSemana: Array.from(set) as DiaSemana[] });
  }

  toggleEdicion(i: number) {
    this.ejercicioEditando.set(this.ejercicioEditando() === i ? null : i);
  }

  removeEjercicio(ejercicioId: string) {
    this.svc.remove(ejercicioId);
    // Si no quedan ejercicios, volver a la galería
    if (this.svc.items().length === 0) {
      this.toastService.show('Añade ejercicios a la plantilla');
      this.router.navigate(['/ejercicios']);
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
      const nombre = v.nombre || 'Plantilla sin nombre';
      const descripcion = v.descripcion || '';
      const visibilidad = (v.visibilidad as 'privado' | 'clinica') || 'privado';

      if (this.isEditMode()) {
        const success = await this.svc.update(nombre, descripcion, visibilidad);
        if (success) {
          this.toastService.show('Plantilla actualizada');
          // Marcar como guardado antes de salir: el guard de cambios
          // sin guardar verá `isDirty === false` durante la navegación.
          this.svc.markAsSaved();
          this.svc.exit();
          this.router.navigate(['/rutinas']);
        } else {
          this.toastService.show('Error al actualizar plantilla', 'error');
        }
      } else {
        const rutinaId = await this.svc.save(nombre, descripcion, visibilidad);
        if (rutinaId) {
          this.toastService.show('Plantilla guardada');
          this.svc.exit();
          this.router.navigate(['/rutinas']);
        } else {
          this.toastService.show('Error al guardar plantilla', 'error');
        }
      }
    } catch (error) {
      this.logger.error('Error guardando plantilla:', error);
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
    this.svc.exit();
    this.router.navigate(['/rutinas']);
  }

  // ========= Helpers =========

  assetUrl(id: string | null | undefined, w = 200, h = 200) {
    if (!id) return '';
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }

  trackByIndex(index: number) {
    return index;
  }
}
