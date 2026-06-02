import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  DestroyRef,
  signal,
  computed,
} from '@angular/core';
import { assetUrl } from '../../../../core/utils/asset-url';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Dialog } from '@angular/cdk/dialog';

import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { EjercicioPlan, DiaSemana } from '../../../../../types/global';
import { SafeHtmlPipe } from '../../../../shared';
import {
  daysBetweenYMD,
  diaSemanaFromYMD,
  getMadridDate,
  offsetMadridDate,
} from '../../../../shared/utils/madrid-date.util';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2EmptyStateComponent,
  Ui2InputComponent,
  Ui2PillComponent,
  Ui2SectionLabelComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
  Ui2TextareaComponent,
} from '../../../../shared/ui-v2';
import { PlanDayTogglesComponent } from '../../components/plan-day-toggles/plan-day-toggles.component';
import { PlanWeekDotsComponent } from '../../components/plan-week-dots/plan-week-dots.component';

@Component({
  selector: 'app-plan-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    SafeHtmlPipe,
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2EmptyStateComponent,
    Ui2InputComponent,
    Ui2PillComponent,
    Ui2SectionLabelComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
    Ui2TextareaComponent,
    PlanDayTogglesComponent,
    PlanWeekDotsComponent,
  ],
  templateUrl: './plan-builder.component.html',
  styleUrl: './plan-builder.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
})
export class PlanBuilderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(Dialog);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private sessionService = inject(SessionService);
  private destroyRef = inject(DestroyRef);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'plan-builder';
  svc = inject(PlanBuilderService);

  /** Datos críticos: plan cargado (modo edición) o paciente confirmado
   *  (modo creación). En ambos casos la señal `isLoading` se enciende
   *  durante `loadPlanForEdit` y baja al terminar. */
  readonly pageReady = computed(() => !this.isLoading());

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

  isLoading = signal(false);
  isSaving = signal(false);

  ejercicioEditando = signal<number | null>(null);

  duracionPresets = [
    { id: '7', label: '1 sem', dias: 7 },
    { id: '14', label: '2 sem', dias: 14 },
    { id: '30', label: '1 mes', dias: 30 },
    { id: '60', label: '2 meses', dias: 60 },
    { id: 'custom', label: 'Otro', dias: null as number | null },
  ];

  duracionOptions: Ui2SegmentedOption[] = this.duracionPresets.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  duracionSeleccionada = signal<number | 'custom'>(30);

  duracionSeleccionadaId = computed<string>(() => {
    const v = this.duracionSeleccionada();
    return v === 'custom' ? 'custom' : String(v);
  });

  minDate = getMadridDate();

  isEditMode = computed(() => this.svc.isEditMode());
  paciente = computed(() => this.svc.paciente());
  items = computed(() => this.svc.items());
  totalItems = computed(() => this.svc.totalItems());
  canSubmit = computed(() => this.svc.canSubmit() && !this.isSaving());

  pageTitle = computed(() =>
    this.isEditMode() ? 'Editar plan' : 'Configurar plan',
  );

  backRoute = computed<unknown[]>(() => {
    const pacId = this.paciente()?.id;
    return pacId ? ['/mis-pacientes', pacId] : ['/mis-pacientes'];
  });

  tituloError = computed<string | null>(() => {
    const c = this.form.controls.titulo;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'El título es obligatorio';
    if (c.hasError('minlength')) return 'Mínimo 3 caracteres';
    return null;
  });

  pacienteNombre = computed(() => {
    const p = this.paciente();
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '';
  });

  saveDisabled = computed(
    () =>
      !this.canSubmit() ||
      (this.isEditMode() && !this.svc.isDirty()),
  );

  /**
   * El CTA inferior solo se muestra cuando hay algo que guardar:
   * - En modo creación: siempre (al haber datos en el draft).
   * - En modo edición: solo si hay cambios sin persistir (`isDirty`).
   */
  showCta = computed(() => !this.isEditMode() || this.svc.isDirty());

  /**
   * Tip resumen de duración: "30 días totales · 13 sesiones programadas".
   * Sesiones = días dentro del rango cuyo día de la semana cae en al menos un ejercicio.
   */
  resumenDuracion = computed<string | null>(() => {
    const ini = this.svc.fechaInicio();
    const fin = this.svc.fechaFin();
    if (!ini || !fin) return null;
    const totalDias = daysBetweenYMD(ini, fin) + 1;
    if (totalDias <= 0) return null;
    const diasUnion = new Set<DiaSemana>();
    for (const it of this.items()) {
      for (const d of it.diasSemana ?? []) diasUnion.add(d);
    }
    if (diasUnion.size === 0) {
      return `${totalDias} días totales`;
    }
    let sesiones = 0;
    let cursor = ini;
    for (let i = 0; i < totalDias; i++) {
      const dia = diaSemanaFromYMD(cursor);
      if (diasUnion.has(dia)) sesiones++;
      cursor = offsetMadridDateFromYmd(cursor, 1);
    }
    return `${totalDias} días totales · ${sesiones} sesion${sesiones === 1 ? '' : 'es'} programada${sesiones === 1 ? '' : 's'}`;
  });

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fechaInicio: [''],
    fechaFin: [''],
  });

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);

    const planId = this.route.snapshot.params['id'];
    const pacienteId = this.route.snapshot.queryParams['paciente'];

    if (planId) {
      if (this.svc.isAlreadyLoadedForEdit(planId)) {
        this.syncFormFromService();
      } else {
        this.loadPlanForEdit(planId);
      }
    } else if (pacienteId) {
      this.svc.ensurePacienteLoaded(pacienteId);
      this.syncFormFromService();
    } else {
      if (!this.svc.paciente() || this.svc.items().length === 0) {
        this.toastService.show('Selecciona un paciente y ejercicios primero');
        this.router.navigate(['/mis-pacientes']);
        return;
      }
      this.syncFormFromService();
    }

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.svc.titulo.set(v.titulo || '');
        this.svc.descripcion.set(v.descripcion || '');
        this.svc.fechaInicio.set(v.fechaInicio || null);
        this.svc.fechaFin.set(v.fechaFin || null);
      });
  }

  ngOnDestroy() {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
    this.svc.closeDrawer();
  }

  private async loadPlanForEdit(planId: string) {
    this.isLoading.set(true);
    try {
      const success = await this.svc.loadPlanForEdit(planId);
      if (success) {
        this.syncFormFromService();
      } else {
        this.toastService.show('No se pudo cargar el plan', 'error');
        this.router.navigate(['/mis-pacientes']);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private syncFormFromService() {
    const fechaInicio = this.svc.fechaInicio() || this.getTomorrowString();
    const tituloExistente = this.svc.titulo();
    const descripcionExistente = this.svc.descripcion();

    const titulo = tituloExistente || this.generarTituloPorDefecto(fechaInicio);
    const descripcion =
      descripcionExistente || this.generarDescripcionPorDefecto();

    this.form.patchValue({
      titulo,
      descripcion,
      fechaInicio,
      fechaFin: this.svc.fechaFin() || '',
    });

    if (!this.svc.fechaFin()) {
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
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const day = date.getUTCDate();
    const months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ];
    return `${day} ${months[date.getUTCMonth()]}`;
  }

  private generarDescripcionPorDefecto(): string {
    const paciente = this.svc.paciente();
    const fisio = this.sessionService.usuario();
    const fechaHoy = this.formatDateFull(getMadridDate());

    const nombrePaciente = paciente
      ? `${paciente.first_name} ${paciente.last_name}`
      : 'el paciente';
    const nombreFisio = fisio
      ? `${fisio.first_name} ${fisio.last_name}`
      : 'nuestro equipo';

    return `Plan personalizado realizado específicamente para ${nombrePaciente} por nuestro equipo de fisioterapeutas (${nombreFisio}) el ${fechaHoy}.`;
  }

  private formatDateFull(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const day = date.getUTCDate();
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    return `${day} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
  }

  private syncServiceFromForm() {
    const v = this.form.value;
    this.svc.titulo.set(v.titulo || '');
    this.svc.descripcion.set(v.descripcion || '');
    this.svc.fechaInicio.set(v.fechaInicio || null);
    this.svc.fechaFin.set(v.fechaFin || null);
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
    const value = (ev.target as HTMLInputElement).value;
    const num = value === '' ? null : Number(value);
    this.svc.updateItem(i, { [key]: num } as Partial<EjercicioPlan>);
  }

  updateText(i: number, key: keyof EjercicioPlan, ev: Event) {
    const value = (ev.target as HTMLTextAreaElement | HTMLInputElement).value;
    this.svc.updateItem(i, { [key]: value } as Partial<EjercicioPlan>);
  }

  isDia(it: EjercicioPlan, d: DiaSemana) {
    return it.diasSemana?.includes(d);
  }

  setDias(i: number, dias: DiaSemana[]) {
    this.svc.updateItem(i, { diasSemana: dias });
  }

  removeEjercicio(ejercicioId: string) {
    this.svc.removeEjercicio(ejercicioId);
    if (this.ejercicioEditando() !== null) {
      this.ejercicioEditando.set(null);
    }
  }

  toggleEdicion(i: number) {
    this.ejercicioEditando.set(this.ejercicioEditando() === i ? null : i);
  }

  // ========= Actions =========

  async guardarPlan() {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.toastService.show('Completa los campos requeridos');
      return;
    }

    this.syncServiceFromForm();

    if (!this.canSubmit()) {
      this.toastService.show('Faltan datos para guardar');
      return;
    }

    this.isSaving.set(true);
    try {
      let planId: string | null;
      let wasVersioned = false;

      if (this.isEditMode()) {
        if (this.svc.hasActivity()) {
          planId = await this.svc.versionPlan();
          wasVersioned = true;
        } else {
          planId = await this.svc.updatePlan();
        }
      } else {
        planId = await this.svc.submitPlan();
      }

      if (planId) {
        if (this.isEditMode()) {
          this.svc.markAsSaved();
        }
        const mensaje = wasVersioned
          ? 'Nueva versión del plan creada'
          : this.isEditMode() ? 'Plan actualizado' : 'Plan creado';
        this.toastService.show(mensaje);
        const action = this.isEditMode() || wasVersioned ? 'updated' : 'created';
        this.router.navigate(['/planes', planId], {
          queryParams: { action },
        });
      } else {
        this.toastService.show('Error al guardar el plan', 'error');
      }
    } catch (error) {
      console.error('Error guardando plan:', error);
      this.toastService.show('Error al guardar', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  async guardarComoPlantilla() {
    const { DialogoGuardarRutinaComponent } = await import(
      '../../../rutinas/components/dialogo-guardar-rutina/dialogo-guardar-rutina.component'
    );

    const dialogRef = this.dialog.open(DialogoGuardarRutinaComponent, {
      width: '400px',
      data: { nombreSugerido: this.form.value.titulo || '' },
    });

    dialogRef.closed.subscribe(async (result: unknown) => {
      const r = result as { nombre: string; descripcion: string; visibilidad: 'privado' | 'clinica' } | undefined;
      if (r) {
        this.isSaving.set(true);
        try {
          const rutinaId = await this.svc.saveAsRutina(
            r.nombre,
            r.descripcion,
            r.visibilidad,
          );
          if (rutinaId) {
            this.toastService.show('Rutina guardada');
          } else {
            this.toastService.show('Error al guardar la rutina', 'error');
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

    dialogRef.closed.subscribe(async (rutinaId: unknown) => {
      const id = rutinaId as string | undefined;
      if (id) {
        this.isLoading.set(true);
        try {
          const success = await this.svc.loadFromRutina(id);
          if (success) {
            this.toastService.show('Rutina cargada');
            if (!this.form.value.titulo && this.svc.titulo()) {
              this.form.patchValue({ titulo: this.svc.titulo() });
            }
          } else {
            this.toastService.show('Error al cargar la rutina', 'error');
          }
        } finally {
          this.isLoading.set(false);
        }
      }
    });
  }

  irAGaleria() {
    const openDrawer = this.isEditMode();
    this.router.navigate(['/ejercicios']).then(() => {
      if (openDrawer) {
        this.svc.openDrawer();
      }
    });
  }

  cancelar() {
    this.router.navigate(this.backRoute());
  }

  // ========= Helpers =========

  assetUrl(id: string | null | undefined, w = 200, h = 200) {
    if (!id) return '';
    return `${assetUrl(id, { width: w, height: h, fit: 'cover', format: 'webp' })}`;
  }

  avatarUrl(id: string | null | undefined): string | null {
    if (!id) return null;
    return `${assetUrl(id, { width: 80, height: 80, fit: 'cover', format: 'webp' })}`;
  }

  trackByIndex(index: number) {
    return index;
  }

  // ========= Manejo de fechas con presets =========

  onDuracionChange(id: string) {
    if (id === 'custom') {
      this.duracionSeleccionada.set('custom');
      return;
    }
    const dias = Number(id);
    this.duracionSeleccionada.set(dias);
    this.calcularFechaFin();
  }

  onFechaInicioChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.form.patchValue({ fechaInicio: input.value });
      this.calcularFechaFin();
    }
  }

  onFechaFinChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.form.patchValue({ fechaFin: input.value });
      this.duracionSeleccionada.set('custom');
    }
  }

  private calcularFechaFin() {
    const fechaInicio = this.form.value.fechaInicio;
    const dias = this.duracionSeleccionada();

    if (fechaInicio && typeof dias === 'number') {
      const [y, m, d] = fechaInicio.split('-').map(Number);
      const utc = new Date(Date.UTC(y, m - 1, d, 12));
      utc.setUTCDate(utc.getUTCDate() + dias);
      const fechaFin = utc.toISOString().slice(0, 10);
      this.form.patchValue({ fechaFin });
    }
  }

  getTomorrowString(): string {
    return offsetMadridDate(1);
  }
}

/**
 * Suma `offset` días a un YYYY-MM-DD interpretado como Madrid sin saltos DST.
 */
function offsetMadridDateFromYmd(ymd: string, offset: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}
