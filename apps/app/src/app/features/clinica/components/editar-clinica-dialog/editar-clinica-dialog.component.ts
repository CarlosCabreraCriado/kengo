import { Component, EventEmitter, Input, Output, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import type { Clinica } from '../../../../../types/global';

@Component({
  standalone: true,
  selector: 'app-editar-clinica-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './editar-clinica-dialog.component.html',
  styleUrl: './editar-clinica-dialog.component.css',
})
export class EditarClinicaDialogComponent implements OnInit {
  @Input({ required: true }) clinica!: Clinica;
  @Output() cerrar = new EventEmitter<void>();
  @Output() clinicaActualizada = new EventEmitter<void>();

  private fb = inject(FormBuilder);
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
    }
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.form.value;
    const result = await this.clinicaGestionService.actualizarClinica(
      this.clinica.id_clinica,
      {
        nombre: formValue.nombre?.trim() || undefined,
        telefono: formValue.telefono?.trim() || null,
        email: formValue.email?.trim() || null,
        direccion: formValue.direccion?.trim() || null,
        postal: formValue.postal?.trim() || null,
        nif: formValue.nif?.trim() || null,
        color_primario: formValue.color_primario || null,
      }
    );

    this.loading.set(false);

    if (result.success) {
      // Refrescar los datos de las clínicas
      this.clinicasService.misClinicasRes.reload();
      this.clinicaActualizada.emit();
    } else {
      this.error.set(result.error || 'Error al actualizar la clínica');
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.cerrar.emit();
    }
  }
}
