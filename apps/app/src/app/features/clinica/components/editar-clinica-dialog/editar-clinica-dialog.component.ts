import { Component, EventEmitter, Input, Output, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Dialog } from '@angular/cdk/dialog';
import { environment as env } from '../../../../../environments/environment';

import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import { ImageUploadComponent } from '../../../../shared/ui/image-upload/image-upload.component';
import type { Clinica, ClinicaImagen, UpdateClinicaPayload } from '../../../../../types/global';

const MAX_GALLERY_IMAGES = 5;
const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp'];

@Component({
  standalone: true,
  selector: 'app-editar-clinica-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './editar-clinica-dialog.component.html',
  styleUrl: './editar-clinica-dialog.component.css',
})
export class EditarClinicaDialogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) clinica!: Clinica;
  @Output() cerrar = new EventEmitter<void>();
  @Output() clinicaActualizada = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private dialog = inject(Dialog);
  private clinicaGestionService = inject(ClinicaGestionService);
  private clinicasService = inject(ClinicasService);

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    telefono: [''],
    email: ['', [Validators.email]],
    direccion: [''],
    postal: [''],
    nif: [''],
    color_primario: ['#e75c3e'],
  });

  loading = signal(false);
  error = signal<string | null>(null);

  // Logo state
  logoFile = signal<File | null>(null);
  existingLogoId = signal<string | null>(null);
  removeLogo = signal(false);

  // Gallery images state
  newImageFiles = signal<File[]>([]);
  existingImages = signal<ClinicaImagen[]>([]);
  imagesToDelete = signal<number[]>([]);

  // Preview URLs for cleanup
  private previewUrls: string[] = [];

  // Computed: Logo preview URL
  logoPreviewUrl = computed(() => {
    const file = this.logoFile();
    if (file) {
      const url = URL.createObjectURL(file);
      this.previewUrls.push(url);
      return url;
    }
    if (this.removeLogo()) return null;
    const id = this.existingLogoId();
    return id ? `${env.DIRECTUS_URL}/assets/${id}?fit=cover&width=200&height=200` : null;
  });

  // Computed: Can add more images
  canAddMoreImages = computed(() => {
    const existing = this.existingImages().length - this.imagesToDelete().length;
    const newImages = this.newImageFiles().length;
    return existing + newImages < MAX_GALLERY_IMAGES;
  });

  // Computed: Remaining slots for images
  remainingImageSlots = computed(() => {
    const existing = this.existingImages().length - this.imagesToDelete().length;
    const newImages = this.newImageFiles().length;
    return MAX_GALLERY_IMAGES - existing - newImages;
  });

  ngOnInit() {
    if (this.clinica) {
      this.form.patchValue({
        nombre: this.clinica.nombre || '',
        telefono: this.clinica.telefono || '',
        email: this.clinica.email || '',
        direccion: this.clinica.direccion || '',
        postal: this.clinica.postal || '',
        nif: this.clinica.nif || '',
        color_primario: this.clinica.color_primario || '#e75c3e',
      });

      // Initialize logo
      this.existingLogoId.set(this.clinica.logo ?? null);

      // Initialize gallery images
      this.existingImages.set(this.clinica.imagenes ?? []);
    }
  }

  ngOnDestroy() {
    // Clean up preview URLs
    this.previewUrls.forEach(url => URL.revokeObjectURL(url));
  }

  // === Logo Methods ===

  openLogoUploader() {
    const dialogRef = this.dialog.open<{ file: File }>(ImageUploadComponent, {
      data: {
        url_perfil: this.existingLogoId() ? `${env.DIRECTUS_URL}/assets/${this.existingLogoId()}?fit=cover` : null,
        resizeToWidth: 512,
        format: 'png',
        quality: 100,
        precargar: !!this.existingLogoId() && !this.removeLogo(),
      },
      width: '100%',
      maxWidth: '500px',
    });

    dialogRef.closed.subscribe((result) => {
      if (result?.file) {
        this.logoFile.set(result.file);
        this.removeLogo.set(false);
      }
    });
  }

  clearLogo() {
    this.logoFile.set(null);
    this.removeLogo.set(true);
  }

  // === Gallery Methods ===

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
      this.newImageFiles.update(current => [...current, ...validFiles]);
    }

    // Clear input to allow re-selecting same files
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
    this.newImageFiles.update(current => {
      const updated = [...current];
      updated.splice(index, 1);
      return updated;
    });
  }

  markImageForDeletion(junctionId: number) {
    this.imagesToDelete.update(current => [...current, junctionId]);
  }

  isImageMarkedForDeletion(junctionId: number): boolean {
    return this.imagesToDelete().includes(junctionId);
  }

  restoreImage(junctionId: number) {
    this.imagesToDelete.update(current => current.filter(id => id !== junctionId));
  }

  getNewImagePreviewUrl(file: File): string {
    const url = URL.createObjectURL(file);
    this.previewUrls.push(url);
    return url;
  }

  getExistingImageUrl(fileId: string): string {
    return `${env.DIRECTUS_URL}/assets/${fileId}?fit=cover&width=200&height=150`;
  }

  // === Submit ===

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      // 1. Upload new logo if changed
      let logoId: string | null | undefined = undefined;
      if (this.logoFile()) {
        const result = await this.clinicaGestionService.uploadFile(this.logoFile()!);
        if (!result.success) {
          throw new Error(result.error || 'Error al subir el logo');
        }
        logoId = result.fileId;
      } else if (this.removeLogo()) {
        logoId = null;
      }

      // 2. Upload new gallery images
      const newImageIds: string[] = [];
      for (const file of this.newImageFiles()) {
        const result = await this.clinicaGestionService.uploadFile(file);
        if (!result.success) {
          throw new Error(result.error || 'Error al subir imagen de galería');
        }
        if (result.fileId) {
          newImageIds.push(result.fileId);
        }
      }

      // 3. Build payload
      const formValue = this.form.value;
      const payload: UpdateClinicaPayload = {
        nombre: formValue.nombre?.trim() || undefined,
        telefono: formValue.telefono?.trim() || null,
        email: formValue.email?.trim() || null,
        direccion: formValue.direccion?.trim() || null,
        postal: formValue.postal?.trim() || null,
        nif: formValue.nif?.trim() || null,
        color_primario: formValue.color_primario || null,
      };

      // Add logo if changed
      if (logoId !== undefined) {
        payload.logo = logoId;
      }

      // Add images operations if there are changes
      const hasImageChanges = newImageIds.length > 0 || this.imagesToDelete().length > 0;
      if (hasImageChanges) {
        payload.imagenes = {};
        if (newImageIds.length > 0) {
          payload.imagenes.create = newImageIds.map(id => ({ directus_files_id: id }));
        }
        if (this.imagesToDelete().length > 0) {
          payload.imagenes.delete = this.imagesToDelete();
        }
      }

      // 4. Update clinic
      const result = await this.clinicaGestionService.actualizarClinica(
        this.clinica.id_clinica,
        payload
      );

      if (result.success) {
        // Refresh clinic data
        this.clinicasService.misClinicasRes.reload();
        this.clinicaActualizada.emit();
      } else {
        this.error.set(result.error || 'Error al actualizar la clínica');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al actualizar la clínica');
    } finally {
      this.loading.set(false);
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.cerrar.emit();
    }
  }
}
