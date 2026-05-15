import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { clinicaCode } from '../../../../shared';
import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
} from '../../../../shared/ui-v2';

@Component({
  standalone: true,
  selector: 'app-vincular-clinica-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
  ],
  templateUrl: './vincular-clinica-dialog.component.html',
  styleUrl: './vincular-clinica-dialog.component.css',
})
export class VincularClinicaDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private fb = inject(FormBuilder);
  private clinicaGestionService = inject(ClinicaGestionService);

  form = this.fb.group({
    codigo: ['', clinicaCode()],
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
      this.dialogRef.close(true);
    } else {
      this.error.set(result.error || 'Error al vincular');
    }
  }

  cerrar() {
    this.dialogRef.close(false);
  }

  formatCodigo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    this.form.patchValue({ codigo: input.value });
  }
}
