import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';

/** Paleta de colores predefinidos (todos con buen contraste sobre blanco) */
const COLOR_PRESETS = [
  '#1e1e1e', // Gris muy oscuro
  '#64748b', // Slate
  '#78716c', // Stone
  '#92400e', // Brown dark
  '#a16207', // Brown amber
  '#dc2626', // Red
  '#e75c3e', // Kengo coral
  '#ea580c', // Orange
  '#d97706', // Amber
  '#ca8a04', // Yellow dark
  '#eab308', // Yellow vibrant
  '#a3a30a', // Yellow olive
  '#16a34a', // Green
  '#059669', // Emerald
  '#0891b2', // Cyan
  '#2563eb', // Blue
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#c026d3', // Fuchsia
  '#db2777', // Pink
  '#be123c', // Rose
];

@Component({
  standalone: true,
  selector: 'app-crear-clinica-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './crear-clinica-dialog.component.html',
  styleUrl: './crear-clinica-dialog.component.css',
})
export class CrearClinicaDialogComponent {
  @Output() cerrar = new EventEmitter<void>();
  @Output() clinicaCreada = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);

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

  readonly colorPresets = COLOR_PRESETS;

  selectColor(color: string) {
    this.form.patchValue({ color_primario: color });
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.form.value;
    const result = await this.clinicaGestionService.crearClinica({
      nombre: formValue.nombre?.trim() || '',
      telefono: formValue.telefono?.trim() || undefined,
      email: formValue.email?.trim() || undefined,
      direccion: formValue.direccion?.trim() || undefined,
      postal: formValue.postal?.trim() || undefined,
      nif: formValue.nif?.trim() || undefined,
      color_primario: formValue.color_primario || undefined,
    });

    this.loading.set(false);

    if (result.success) {
      this.clinicaCreada.emit();
    } else {
      this.error.set(result.error || 'Error al crear la clínica');
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.cerrar.emit();
    }
  }
}
