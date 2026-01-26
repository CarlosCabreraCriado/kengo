import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
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
    vincularEmail: [true],
    email: ['', [Validators.email]],
    usosMaximos: [1 as number | null],
    diasExpiracion: [null as number | null],
  });

  // Convertir valueChanges a signal para reactividad
  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  // Validación: si vincularEmail está activo, email es obligatorio
  emailValido = computed(() => {
    const value = this.formValue();
    if (!value.vincularEmail) return true;
    const email = value.email?.trim() || '';
    // Verificar que hay email y que es válido (formato básico)
    return email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });

  // El formulario es válido si pasa validaciones base Y la validación de email
  formValido = computed(() => this.form.valid && this.emailValido());

  loading = signal(false);
  error = signal<string | null>(null);
  codigoResult = signal<string | null>(null);
  emailEnviado = signal(false);

  async onSubmit() {
    if (!this.formValido() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const formValue = this.form.value;
    // Solo enviar email si vincularEmail está activo y hay un email válido
    const emailValue = formValue.vincularEmail && formValue.email?.trim()
      ? formValue.email.trim()
      : null;

    const result = await this.clinicaGestionService.generarCodigo(
      this.clinicaId,
      formValue.tipo as TipoCodigoAcceso,
      {
        usosMaximos: formValue.usosMaximos || null,
        diasExpiracion: formValue.diasExpiracion || null,
        email: emailValue,
      }
    );

    this.loading.set(false);

    if (result.success && result.codigo) {
      this.codigoResult.set(result.codigo);
      this.emailEnviado.set(result.emailEnviado || false);
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
