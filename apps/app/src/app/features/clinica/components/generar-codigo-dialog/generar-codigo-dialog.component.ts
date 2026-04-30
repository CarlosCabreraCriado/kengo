import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { emailOptional } from '../../../../shared';
import type { TipoCodigoAcceso } from '@kengo/shared-models';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
  Ui2ToggleComponent,
  Ui2RadioGroupComponent,
  Ui2PillComponent,
  type Ui2RadioOption,
} from '../../../../shared/ui-v2';

@Component({
  standalone: true,
  selector: 'app-generar-codigo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2ToggleComponent,
    Ui2RadioGroupComponent,
    Ui2PillComponent,
  ],
  templateUrl: './generar-codigo-dialog.component.html',
  styleUrl: './generar-codigo-dialog.component.css',
})
export class GenerarCodigoDialogComponent implements OnInit {
  @Input({ required: true }) clinicaId!: string;
  @Input() esAdmin = false;
  @Input() tipoInicial: TipoCodigoAcceso | null = null;

  @Output() cerrar = new EventEmitter<void>();
  @Output() codigoGenerado = new EventEmitter<string>();
  /**
   * Se emite cuando la mutation falla con `REQUIERE_CONTACTO_VENTAS` (la
   * clínica supera el límite del plan autoservicio). El padre debe cerrar
   * este diálogo y abrir el formulario de contacto comercial.
   */
  @Output() requiereContactoVentas = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);

  form = this.fb.group({
    tipo: ['paciente' as TipoCodigoAcceso, [Validators.required]],
    vincularEmail: [true],
    email: ['', emailOptional],
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

  // Opciones radio reactivas según permisos
  tipoOptions = computed<Ui2RadioOption[]>(() => {
    const opts: Ui2RadioOption[] = [
      {
        value: 'paciente',
        label: 'Paciente',
        description: 'Se unirá como paciente de la clínica',
      },
    ];
    if (this.esAdmin) {
      opts.push({
        value: 'fisioterapeuta',
        label: 'Fisioterapeuta',
        description: 'Podrá gestionar pacientes',
      });
    }
    return opts;
  });

  // Opciones avanzadas expandibles
  showAdvanced = signal(false);

  // Sección email expandida — calculado a partir del valor
  vincularEmail = computed(() => !!this.formValue().vincularEmail);

  ngOnInit() {
    if (this.tipoInicial) {
      this.form.patchValue({ tipo: this.tipoInicial });
    }
  }

  loading = signal(false);
  error = signal<string | null>(null);
  codigoResult = signal<string | null>(null);
  emailEnviado = signal(false);

  toggleAdvanced() {
    this.showAdvanced.update((v) => !v);
  }

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
      return;
    }

    if (result.errorCode === 'REQUIERE_CONTACTO_VENTAS') {
      this.requiereContactoVentas.emit();
      return;
    }

    this.error.set(result.error || 'Error al generar código');
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
