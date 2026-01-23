import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { MatDateRangePicker } from '@angular/material/datepicker';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { EjercicioPlan } from '../../../../../types/global';
import { environment as env } from '../../../../../environments/environment';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-plan-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    SafeHtmlPipe,
  ],
  templateUrl: './plan-builder.component.html',
  styleUrl: './plan-builder.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PlanBuilderComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private sessionService = inject(SessionService);
  private breakpointObserver = inject(BreakpointObserver);
  svc = inject(PlanBuilderService);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe(['(min-width: 1024px)'])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  diasNombres: Record<string, string> = {
    L: 'Lunes',
    M: 'Martes',
    X: 'Miercoles',
    J: 'Jueves',
    V: 'Viernes',
    S: 'Sabado',
    D: 'Domingo',
  };

  isLoading = signal(false);
  isSaving = signal(false);

  // Signals para modo edicion por seccion
  editandoDetalles = signal(false);
  ejercicioEditando = signal<number | null>(null);

  // Presets de duracion
  duracionPresets = [
    { label: '1 sem', dias: 7 },
    { label: '2 sem', dias: 14 },
    { label: '1 mes', dias: 30 },
    { label: '2 meses', dias: 60 },
  ];
  duracionSeleccionada = signal<number | 'custom'>(30); // 1 mes por defecto

  // Date range picker
  @ViewChild('rangePicker') rangePicker!: MatDateRangePicker<Date>;
  minDate = new Date(); // No permitir fechas anteriores a hoy
  rangeStart: Date | null = null;
  rangeEnd: Date | null = null;

  // Computed para UI
  isEditMode = computed(() => this.svc.isEditMode());
  paciente = computed(() => this.svc.paciente());
  items = computed(() => this.svc.items());
  totalItems = computed(() => this.svc.totalItems());
  canSubmit = computed(() => this.svc.canSubmit() && !this.isSaving());

  pageTitle = computed(() =>
    this.isEditMode() ? 'Editar Plan' : 'Configurar Plan',
  );

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_inicio: [''],
    fecha_fin: [''],
  });

  ngOnInit() {
    const planId = this.route.snapshot.params['id'];
    const pacienteId = this.route.snapshot.queryParams['paciente'];

    if (planId) {
      // Modo edicion
      this.loadPlanForEdit(+planId);
    } else if (pacienteId) {
      // Modo nuevo con paciente
      this.svc.ensurePacienteLoaded(pacienteId);
      this.syncFormFromService();
    } else {
      // Verificar que hay paciente y ejercicios
      if (!this.svc.paciente() || this.svc.items().length === 0) {
        this.snackBar.open(
          'Selecciona un paciente y ejercicios primero',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/mis-pacientes']);
        return;
      }
      this.syncFormFromService();
    }
  }

  ngOnDestroy() {
    // Cerrar drawer si estaba abierto
    this.svc.closeDrawer();
  }

  private async loadPlanForEdit(planId: number) {
    this.isLoading.set(true);
    try {
      const success = await this.svc.loadPlanForEdit(planId);
      if (success) {
        this.syncFormFromService();
      } else {
        this.snackBar.open('No se pudo cargar el plan', 'OK', {
          duration: 3000,
        });
        this.router.navigate(['/planes']);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private syncFormFromService() {
    const fechaInicio = this.svc.fecha_inicio() || this.getTomorrowString();
    const tituloExistente = this.svc.titulo();
    const descripcionExistente = this.svc.descripcion();

    // Generar titulo y descripcion por defecto si no existen
    const titulo = tituloExistente || this.generarTituloPorDefecto(fechaInicio);
    const descripcion =
      descripcionExistente || this.generarDescripcionPorDefecto();

    this.form.patchValue({
      titulo,
      descripcion,
      fecha_inicio: fechaInicio,
      fecha_fin: this.svc.fecha_fin() || '',
    });

    // Si no hay fecha fin, calcularla con la duracion por defecto
    if (!this.svc.fecha_fin()) {
      this.calcularFechaFin();
    }
  }

  private generarTituloPorDefecto(fechaInicio: string): string {
    const paciente = this.svc.paciente();
    const nombrePaciente = paciente ? paciente.first_name : 'Paciente';
    const fechaFormateada = this.formatDateShort(fechaInicio);
    return `Plan ${nombrePaciente} ${fechaFormateada}`;
  }

  private formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    return `${day} ${months[date.getMonth()]}`;
  }

  private generarDescripcionPorDefecto(): string {
    const paciente = this.svc.paciente();
    const fisio = this.sessionService.usuario();
    const fechaHoy = this.formatDateFull(new Date());

    const nombrePaciente = paciente
      ? `${paciente.first_name} ${paciente.last_name}`
      : 'el paciente';
    const nombreFisio = fisio
      ? `${fisio.first_name} ${fisio.last_name}`
      : 'nuestro equipo';

    return `Plan personalizado realizado específicamente para ${nombrePaciente} por nuestro equipo de fisioterapeutas (${nombreFisio}) el ${fechaHoy}.`;
  }

  private formatDateFull(date: Date): string {
    const day = date.getDate();
    const months = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const year = date.getFullYear();
    return `${day} de ${months[date.getMonth()]} de ${year}`;
  }

  private syncServiceFromForm() {
    const v = this.form.value;
    this.svc.titulo.set(v.titulo || '');
    this.svc.descripcion.set(v.descripcion || '');
    this.svc.fecha_inicio.set(v.fecha_inicio || null);
    this.svc.fecha_fin.set(v.fecha_fin || null);
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

  isDia(it: EjercicioPlan, d: string) {
    return it.dias_semana?.includes(d);
  }

  toggleDia(i: number, d: string) {
    const it = this.svc.items()[i];
    const set = new Set(it.dias_semana || []);
    if (set.has(d)) {
      set.delete(d);
    } else {
      set.add(d);
    }
    this.svc.updateItem(i, { dias_semana: Array.from(set) });
  }

  removeEjercicio(ejercicioId: number) {
    this.svc.removeEjercicio(ejercicioId);
  }

  // ========= Actions =========

  async guardarPlan() {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Completa los campos requeridos', 'OK', {
        duration: 3000,
      });
      return;
    }

    this.syncServiceFromForm();

    if (!this.canSubmit()) {
      this.snackBar.open('Faltan datos para guardar', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving.set(true);
    try {
      let planId: number | null;

      if (this.isEditMode()) {
        planId = await this.svc.updatePlan();
      } else {
        planId = await this.svc.submitPlan();
      }
      console.warn('Plan ID recibido', planId);

      if (planId) {
        this.snackBar.open(
          this.isEditMode() ? 'Plan actualizado' : 'Plan creado',
          'OK',
          { duration: 2000 },
        );
        this.router.navigate(['/planes', planId, 'resumen']);
      } else {
        this.snackBar.open('Error al guardar el plan', 'OK', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error guardando plan:', error);
      this.snackBar.open('Error al guardar', 'OK', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  async guardarComoPlantilla() {
    // Import dialog dinamicamente para evitar dependencia circular
    const { DialogoGuardarRutinaComponent } = await import(
      '../../../rutinas/components/dialogo-guardar-rutina/dialogo-guardar-rutina.component'
    );

    const dialogRef = this.dialog.open(DialogoGuardarRutinaComponent, {
      width: '400px',
      data: { nombreSugerido: this.form.value.titulo || '' },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.isSaving.set(true);
        try {
          const rutinaId = await this.svc.saveAsRutina(
            result.nombre,
            result.descripcion,
            result.visibilidad,
          );

          if (rutinaId) {
            this.snackBar.open('Plantilla guardada', 'OK', { duration: 2000 });
          } else {
            this.snackBar.open('Error al guardar plantilla', 'OK', {
              duration: 3000,
            });
          }
        } finally {
          this.isSaving.set(false);
        }
      }
    });
  }

  async cargarPlantilla() {
    const { SelectorRutinaComponent } = await import(
      '../../../rutinas/components/selector-rutina/selector-rutina.component'
    );

    const dialogRef = this.dialog.open(SelectorRutinaComponent, {
      width: '600px',
      maxHeight: '80vh',
    });

    dialogRef.afterClosed().subscribe(async (rutinaId) => {
      if (rutinaId) {
        this.isLoading.set(true);
        try {
          const success = await this.svc.loadFromRutina(rutinaId);
          if (success) {
            this.snackBar.open('Plantilla cargada', 'OK', { duration: 2000 });
            // Actualizar titulo si estaba vacio
            if (!this.form.value.titulo && this.svc.titulo()) {
              this.form.patchValue({ titulo: this.svc.titulo() });
            }
          } else {
            this.snackBar.open('Error al cargar plantilla', 'OK', {
              duration: 3000,
            });
          }
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  cancelar() {
    this.location.back();
  }

  // ========= Helpers =========

  assetUrl(id: string | null | undefined, w = 200, h = 200) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }

  avatarUrl(id: string | null | undefined) {
    if (!id) return 'assets/default-avatar.png';
    return `${env.DIRECTUS_URL}/assets/${id}?width=80&height=80&fit=cover&format=webp`;
  }

  trackByIndex(index: number) {
    return index;
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  }

  // ========= Manejo de fechas con presets =========

  seleccionarDuracion(dias: number) {
    this.duracionSeleccionada.set(dias);
    this.calcularFechaFin();
  }

  seleccionarPersonalizado() {
    // Inicializar las fechas del range picker
    const fechaInicio = this.form.value.fecha_inicio;
    const fechaFin = this.form.value.fecha_fin;

    this.rangeStart = fechaInicio ? new Date(fechaInicio) : new Date();
    this.rangeEnd = fechaFin ? new Date(fechaFin) : null;

    // Abrir el picker
    setTimeout(() => this.rangePicker?.open(), 0);
  }

  onStartDateChange(date: Date | null) {
    if (date) {
      this.rangeStart = date;
      this.form.patchValue({ fecha_inicio: this.toDateString(date) });
    }
  }

  onEndDateChange(date: Date | null) {
    if (date) {
      this.rangeEnd = date;
      this.form.patchValue({ fecha_fin: this.toDateString(date) });
      this.duracionSeleccionada.set('custom');
    }
  }

  private calcularFechaFin() {
    const fechaInicio = this.form.value.fecha_inicio;
    const dias = this.duracionSeleccionada();

    if (fechaInicio && typeof dias === 'number') {
      const inicio = new Date(fechaInicio);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias);
      this.form.patchValue({ fecha_fin: this.toDateString(fin) });
    }
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getTodayString(): string {
    return this.toDateString(new Date());
  }

  getTomorrowString(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.toDateString(tomorrow);
  }

  getDuracionLabel(): string {
    const dias = this.duracionSeleccionada();
    if (!dias) return '';
    const preset = this.duracionPresets.find((p) => p.dias === dias);
    return preset ? preset.label : `${dias} días`;
  }
}
