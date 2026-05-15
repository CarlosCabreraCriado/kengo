import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { ClipboardService } from '../../../../core/services/clipboard.service';
import type { TipoCodigoAcceso } from '@kengo/shared-models';

export interface GenerarCodigoDialogData {
  clinicaId: string;
  esAdmin?: boolean;
  tipoInicial?: TipoCodigoAcceso | null;
  /**
   * Si se proporciona, fija el tipo del código y oculta el selector. Útil
   * cuando el dialog se invoca desde un contexto que ya determina el tipo
   * (p.ej. /mi-clinica → siempre fisioterapeuta).
   */
  tipoFijo?: TipoCodigoAcceso | null;
}

export interface GenerarCodigoDialogResult {
  /** Código generado, si la operación terminó con éxito. */
  codigo?: string;
  /** Cierre por "requiere contacto comercial". El padre debe abrir el dialog de ventas. */
  requiereContactoVentas?: boolean;
}
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
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
    Ui2RadioGroupComponent,
    Ui2PillComponent,
  ],
  templateUrl: './generar-codigo-dialog.component.html',
  styleUrl: './generar-codigo-dialog.component.css',
})
export class GenerarCodigoDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<GenerarCodigoDialogResult>);
  private readonly data = inject<GenerarCodigoDialogData>(DIALOG_DATA);

  readonly clinicaId = this.data.clinicaId;
  readonly esAdmin = this.data.esAdmin ?? false;
  readonly tipoInicial: TipoCodigoAcceso | null = this.data.tipoInicial ?? null;
  readonly tipoFijo: TipoCodigoAcceso | null = this.data.tipoFijo ?? null;

  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);
  private clipboard = inject(ClipboardService);

  form = this.fb.group({
    tipo: ['paciente' as TipoCodigoAcceso, [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
  });

  // Status del form como signal para que computed reaccione a cambios de validez.
  private formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  formValido = computed(() => this.formStatus() === 'VALID');

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

  ngOnInit() {
    const tipo = this.tipoFijo ?? this.tipoInicial;
    if (tipo) {
      this.form.patchValue({ tipo });
    }
    if (this.tipoFijo) {
      this.form.controls.tipo.disable({ emitEvent: false });
    }
  }

  loading = signal(false);
  error = signal<string | null>(null);
  codigoResult = signal<string | null>(null);
  emailEnviado = signal(false);

  async onSubmit() {
    if (!this.formValido() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    // getRawValue incluye los controles `disabled` (caso `tipoFijo`).
    const formValue = this.form.getRawValue();
    const emailValue = formValue.email?.trim() ?? '';

    const result = await this.clinicaGestionService.generarCodigo(
      this.clinicaId,
      formValue.tipo as TipoCodigoAcceso,
      { email: emailValue },
    );

    this.loading.set(false);

    if (result.success && result.codigo) {
      this.codigoResult.set(result.codigo);
      this.emailEnviado.set(result.emailEnviado || false);
      return;
    }

    if (result.errorCode === 'REQUIERE_CONTACTO_VENTAS') {
      this.dialogRef.close({ requiereContactoVentas: true });
      return;
    }

    this.error.set(result.error || 'Error al generar código');
  }

  copiarCodigo() {
    const codigo = this.codigoResult();
    if (codigo) {
      void this.clipboard.write(codigo);
    }
  }

  terminar() {
    const codigo = this.codigoResult();
    this.dialogRef.close(codigo ? { codigo } : {});
  }

  cerrar() {
    this.dialogRef.close({});
  }
}
