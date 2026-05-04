import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';

import { SubscriptionService } from '../../../../core/billing/subscription.service';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2InputComponent,
  Ui2TextareaComponent,
  Ui2ButtonComponent,
} from '../../../../shared/ui-v2';

export interface ContactarVentasDialogData {
  clinicId: string;
  fisiosActuales: number;
  telefonoSugerido?: string;
}

export interface ContactarVentasDialogResult {
  ok: true;
}

@Component({
  standalone: true,
  selector: 'app-contactar-ventas-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2InputComponent,
    Ui2TextareaComponent,
    Ui2ButtonComponent,
  ],
  templateUrl: './contactar-ventas-dialog.component.html',
})
export class ContactarVentasDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef =
    inject<DialogRef<ContactarVentasDialogResult | null>>(DialogRef);
  private readonly subs = inject(SubscriptionService);
  protected readonly data = inject<ContactarVentasDialogData>(DIALOG_DATA);

  protected readonly enviando = signal(false);

  protected readonly form = this.fb.group({
    mensaje: this.fb.control(this.mensajeSugerido(), {
      validators: [Validators.required, Validators.minLength(10)],
      nonNullable: true,
    }),
    telefono: this.fb.control(this.data.telefonoSugerido ?? '', {
      nonNullable: true,
    }),
  });

  protected readonly mensajeError = computed(() => {
    const ctrl = this.form.controls.mensaje;
    if (!ctrl.touched) return null;
    if (ctrl.errors?.['required']) return 'Cuéntanos brevemente qué necesitas';
    if (ctrl.errors?.['minlength']) return 'Mínimo 10 caracteres';
    return null;
  });

  private mensajeSugerido(): string {
    const n = this.data.fisiosActuales;
    return `Hola, gestiono una clínica con ${n} fisioterapeutas y necesito un plan a medida. ¿Podemos hablar?`;
  }

  protected cerrar(): void {
    this.dialogRef.close(null);
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { mensaje, telefono } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      const ok = await this.subs.contactarVentas(
        this.data.clinicId,
        mensaje.trim(),
        telefono.trim() ? telefono.trim() : undefined,
      );
      if (ok) {
        this.dialogRef.close({ ok: true });
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
