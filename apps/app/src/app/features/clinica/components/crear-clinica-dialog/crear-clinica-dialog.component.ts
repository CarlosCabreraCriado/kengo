import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { ImageUploadComponent } from '../../../../shared/ui/image-upload/image-upload.component';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { emailOptional } from '../../../../shared';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
  Ui2StepperComponent,
  Ui2StepComponent,
  Ui2CardComponent,
  Ui2SectionLabelComponent,
} from '../../../../shared/ui-v2';

const MAX_GALLERY_IMAGES = 5;
const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp'];
const TRIAL_DAYS = 14;

/** Paleta de colores predefinidos (alineada con el diálogo de editar clínica). */
const COLOR_PRESETS = [
  '#1e1e1e', '#64748b', '#78716c', '#92400e', '#a16207',
  '#dc2626', '#e75c3e', '#ea580c', '#d97706', '#ca8a04',
  '#eab308', '#a3a30a', '#16a34a', '#059669', '#0891b2',
  '#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777',
  '#be123c',
];

@Component({
  standalone: true,
  selector: 'app-crear-clinica-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2StepperComponent,
    Ui2StepComponent,
    Ui2CardComponent,
    Ui2SectionLabelComponent,
  ],
  templateUrl: './crear-clinica-dialog.component.html',
  styleUrl: './crear-clinica-dialog.component.css',
})
export class CrearClinicaDialogComponent implements OnDestroy {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private fb = inject(FormBuilder);
  private dialog = inject(Dialog);
  private clinicaGestionService = inject(ClinicaGestionService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  readonly colorPresets = COLOR_PRESETS;
  readonly trialDays = TRIAL_DAYS;

  // Stepper state
  currentStep = signal(0);
  readonly totalSteps = 5;
  readonly isFirstStep = computed(() => this.currentStep() === 0);
  readonly isLastStep = computed(() => this.currentStep() === this.totalSteps - 1);

  // Form (todos los campos en un único FormGroup, repartidos visualmente entre pasos)
  form = this.fb.group({
    // Paso 2 — información básica
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    nombreComercial: ['', [Validators.maxLength(15)]],
    nif: [''],
    // Paso 3 — contacto
    telefono: [''],
    email: ['', emailOptional],
    web: ['', [
      Validators.pattern(/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[^\s]*)?$/i),
    ]],
    direccion: [''],
    postal: [''],
    // Paso 4 — branding
    colorPrimario: ['#e75c3e'],
  });

  loading = signal(false);
  error = signal<string | null>(null);

  // Logo state (subida diferida — el File vive en memoria hasta confirmar)
  logoFile = signal<File | null>(null);

  // Gallery state
  newImageFiles = signal<File[]>([]);

  // URLs de preview que requieren limpieza para evitar fugas de memoria
  private previewUrls: string[] = [];

  logoPreviewUrl = computed(() => {
    const file = this.logoFile();
    if (!file) return null;
    const url = URL.createObjectURL(file);
    this.previewUrls.push(url);
    return url;
  });

  canAddMoreImages = computed(
    () => this.newImageFiles().length < MAX_GALLERY_IMAGES,
  );
  remainingImageSlots = computed(
    () => MAX_GALLERY_IMAGES - this.newImageFiles().length,
  );

  // Resumen — útil para el paso 5
  hasContacto = computed(() => {
    const v = this.form.value;
    return !!(v.telefono || v.email || v.web || v.direccion || v.postal);
  });

  ngOnDestroy() {
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  // === Navegación stepper ===

  /** Devuelve true si los controls del paso indicado son válidos. */
  isStepValid(index: number): boolean {
    if (index === 1) {
      // Paso "Información básica"
      return (
        this.form.get('nombre')!.valid &&
        this.form.get('nombreComercial')!.valid
      );
    }
    if (index === 2) {
      // Paso "Contacto"
      return (
        this.form.get('email')!.valid &&
        this.form.get('web')!.valid
      );
    }
    return true;
  }

  goNext() {
    const i = this.currentStep();
    if (i >= this.totalSteps - 1) return;
    if (!this.isStepValid(i)) {
      this.markStepTouched(i);
      return;
    }
    this.currentStep.set(i + 1);
  }

  goBack() {
    const i = this.currentStep();
    if (i === 0) return;
    this.currentStep.set(i - 1);
  }

  onStepperIndexChange(index: number) {
    // El stepper en modo lineal permite retroceder libremente; el avance
    // hacia adelante lo gobierna `goNext` para validar antes de saltar.
    if (index < this.currentStep()) {
      this.currentStep.set(index);
    }
  }

  private markStepTouched(index: number) {
    const map: Record<number, string[]> = {
      1: ['nombre', 'nombreComercial', 'nif'],
      2: ['telefono', 'email', 'web', 'direccion', 'postal'],
    };
    (map[index] ?? []).forEach((name) =>
      this.form.get(name)?.markAsTouched(),
    );
  }

  // === Logo ===

  openLogoUploader() {
    const ref = this.dialog.open<{ file: File }>(ImageUploadComponent, {
      data: {
        url_perfil: null,
        resizeToWidth: 512,
        format: 'png',
        quality: 100,
        precargar: false,
      },
      width: '100%',
      maxWidth: '500px',
      panelClass: 'ui-dialog-panel',
    });

    ref.closed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result?.file) {
          this.logoFile.set(result.file);
        }
      });
  }

  clearLogo() {
    this.logoFile.set(null);
  }

  // === Galería ===

  onGalleryImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    const remainingSlots = this.remainingImageSlots();
    const validFiles: File[] = [];

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (this.validateFile(file)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      this.newImageFiles.update((current) => [...current, ...validFiles]);
    }

    input.value = '';
  }

  private validateFile(file: File): boolean {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      this.error.set('Formato no válido. Usa PNG, JPG o WebP.');
      return false;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.error.set(`El archivo supera ${MAX_FILE_SIZE_MB} MB.`);
      return false;
    }
    this.error.set(null);
    return true;
  }

  removeNewImage(index: number) {
    this.newImageFiles.update((current) => {
      const updated = [...current];
      updated.splice(index, 1);
      return updated;
    });
  }

  getNewImagePreviewUrl(file: File): string {
    const url = URL.createObjectURL(file);
    this.previewUrls.push(url);
    return url;
  }

  // === Colores ===

  selectColor(color: string) {
    this.form.patchValue({ colorPrimario: color });
  }

  /** Calcula una versión más oscura del color hex (15%) para el gradient de preview. */
  getDarkerColor(hex: string | null | undefined): string {
    if (!hex) return '#c94a2f';
    const rgb = this.hexToRgb(hex);
    const darker = {
      r: Math.max(0, Math.round(rgb.r * 0.85)),
      g: Math.max(0, Math.round(rgb.g * 0.85)),
      b: Math.max(0, Math.round(rgb.b * 0.85)),
    };
    return `#${this.componentToHex(darker.r)}${this.componentToHex(darker.g)}${this.componentToHex(darker.b)}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 231, g: 92, b: 62 };
  }

  private componentToHex(c: number): string {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  // === Submit ===

  async onSubmit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // 1. Subir logo + galería a R2. Capturamos errores SIN abortar la creación:
    //    si las imágenes fallan, la clínica se crea igual y avisamos al usuario.
    let logoKey: string | undefined;
    const imageKeys: string[] = [];
    let imageUploadFailed = false;

    try {
      if (this.logoFile()) {
        const r = await this.clinicaGestionService.uploadFile(
          this.logoFile()!,
          'logos',
        );
        if (r.success && r.fileId) {
          logoKey = r.fileId;
        } else {
          imageUploadFailed = true;
        }
      }
      for (const file of this.newImageFiles()) {
        const r = await this.clinicaGestionService.uploadFile(
          file,
          'clinic-files',
        );
        if (r.success && r.fileId) {
          imageKeys.push(r.fileId);
        } else {
          imageUploadFailed = true;
        }
      }
    } catch {
      imageUploadFailed = true;
    }

    // 2. Crear la clínica (con o sin imágenes según éxito).
    const formValue = this.form.value;
    const result = await this.clinicaGestionService.crearClinica({
      nombre: formValue.nombre!.trim(),
      nombreComercial: formValue.nombreComercial?.trim() || undefined,
      telefono: formValue.telefono?.trim() || undefined,
      email: formValue.email?.trim() || undefined,
      web: formValue.web?.trim() || undefined,
      direccion: formValue.direccion?.trim() || undefined,
      postal: formValue.postal?.trim() || undefined,
      nif: formValue.nif?.trim() || undefined,
      colorPrimario: formValue.colorPrimario || undefined,
      logo: logoKey,
      addImageKeys: imageKeys.length ? imageKeys : undefined,
    });

    this.loading.set(false);

    if (!result.success) {
      this.error.set(result.error || 'Error al crear la clínica');
      return;
    }

    if (imageUploadFailed) {
      this.toast.warning(
        'Clínica creada, pero algunas imágenes no se pudieron subir. Podrás añadirlas desde "Editar clínica".',
      );
    }
    this.dialogRef.close(true);
  }

  cerrar() {
    this.dialogRef.close(false);
  }
}
