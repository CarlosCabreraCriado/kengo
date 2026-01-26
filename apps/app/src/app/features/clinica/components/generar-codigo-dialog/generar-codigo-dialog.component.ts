import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import type { TipoCodigoAcceso } from '@kengo/shared-models';

@Component({
  standalone: true,
  selector: 'app-generar-codigo-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './generar-codigo-dialog.component.html',
  styleUrl: './generar-codigo-dialog.component.css',
})
export class GenerarCodigoDialogComponent {
  @Input({ required: true }) clinicaId!: number;
  @Input() esAdmin = false;

  @Output() cerrar = new EventEmitter<void>();
  @Output() codigoGenerado = new EventEmitter<string>();

  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);

  form = this.fb.group({
    tipo: ['paciente' as TipoCodigoAcceso, [Validators.required]],
    usosMaximos: [null as number | null],
    diasExpiracion: [null as number | null],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  codigoResult = signal<string | null>(null);

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.form.value;
    const result = await this.clinicaGestionService.generarCodigo(
      this.clinicaId,
      formValue.tipo as TipoCodigoAcceso,
      {
        usosMaximos: formValue.usosMaximos || null,
        diasExpiracion: formValue.diasExpiracion || null,
      }
    );

    this.loading.set(false);

    if (result.success && result.codigo) {
      this.codigoResult.set(result.codigo);
    } else {
      this.error.set(result.error || 'Error al generar código');
    }
  }

  copiarCodigo() {
    const codigo = this.codigoResult();
    if (codigo) {
      navigator.clipboard.writeText(codigo);
    }
  }

  terminar() {
    const codigo = this.codigoResult();
    if (codigo) {
      this.codigoGenerado.emit(codigo);
    } else {
      this.cerrar.emit();
    }
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.terminar();
    }
  }
}
