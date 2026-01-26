import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';

@Component({
  standalone: true,
  selector: 'app-vincular-clinica-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './vincular-clinica-dialog.component.html',
  styleUrl: './vincular-clinica-dialog.component.css',
})
export class VincularClinicaDialogComponent {
  @Output() cerrar = new EventEmitter<void>();
  @Output() vinculacionExitosa = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);

  form = this.fb.group({
    codigo: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(8)]],
  });

  loading = signal(false);
  error = signal<string | null>(null);

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const codigo = this.form.value.codigo?.trim().toUpperCase() || '';
    const result = await this.clinicaGestionService.vincularConCodigo(codigo);

    this.loading.set(false);

    if (result.success) {
      this.vinculacionExitosa.emit();
    } else {
      this.error.set(result.error || 'Error al vincular');
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.cerrar.emit();
    }
  }

  formatCodigo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    this.form.patchValue({ codigo: input.value });
  }
}
