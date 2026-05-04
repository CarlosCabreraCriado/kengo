import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  Ui2ButtonComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2InputComponent,
  Ui2RadioGroupComponent,
  Ui2TextareaComponent,
  type Ui2RadioOption,
} from '../../../../shared/ui-v2';

export interface DialogoGuardarRutinaData {
  nombreSugerido?: string;
}

export interface DialogoGuardarRutinaResult {
  nombre: string;
  descripcion: string;
  visibilidad: 'privado' | 'clinica';
}

@Component({
  selector: 'app-dialogo-guardar-rutina',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2InputComponent,
    Ui2TextareaComponent,
    Ui2RadioGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-dialog-host>
      <ui2-dialog-header
        title="Guardar rutina"
        subtitle="Reutiliza esta selección de ejercicios cuando lo necesites"
        (closeClick)="cancelar()"
      ></ui2-dialog-header>

      <ui2-dialog-content>
        <form [formGroup]="form" class="dgr-form" (ngSubmit)="guardar()">
          <ui2-input
            label="Nombre de la rutina"
            placeholder="Ej: Rutina fortalecimiento rodilla"
            iconLeft="title"
            formControlName="nombre"
            [required]="true"
            [error]="nombreError()"
          ></ui2-input>

          <ui2-textarea
            label="Descripción"
            placeholder="Para qué se usa esta rutina, contexto..."
            formControlName="descripcion"
            [rows]="3"
          ></ui2-textarea>

          <ui2-radio-group
            label="Visibilidad"
            [options]="visibilidadOptions"
            formControlName="visibilidad"
          ></ui2-radio-group>
        </form>
      </ui2-dialog-content>

      <ui2-dialog-actions align="end">
        <ui2-button variant="secondary" (clicked)="cancelar()">Cancelar</ui2-button>
        <ui2-button
          variant="primary"
          iconLeft="bookmark_add"
          [disabled]="!form.valid"
          (clicked)="guardar()"
        >Guardar rutina</ui2-button>
      </ui2-dialog-actions>
    </ui2-dialog-host>
  `,
  styles: [`
    :host { display: block; }
    .dgr-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
  `],
})
export class DialogoGuardarRutinaComponent {
  private dialogRef = inject(DialogRef<DialogoGuardarRutinaResult>);
  private data = inject<DialogoGuardarRutinaData>(DIALOG_DATA, { optional: true });
  private fb = inject(FormBuilder);

  readonly visibilidadOptions: Ui2RadioOption[] = [
    {
      value: 'privado',
      label: 'Privada',
      description: 'Solo tú puedes verla y usarla',
    },
    {
      value: 'clinica',
      label: 'Clínica',
      description: 'Visible para los fisios de tu clínica',
    },
  ];

  form = this.fb.group({
    nombre: [
      this.data?.nombreSugerido || '',
      [Validators.required, Validators.minLength(3)],
    ],
    descripcion: [''],
    visibilidad: ['privado' as 'privado' | 'clinica'],
  });

  readonly nombreError = computed(() => {
    const ctrl = this.form.controls.nombre;
    if (!ctrl.touched) return null;
    if (ctrl.hasError('required')) return 'El nombre es requerido';
    if (ctrl.hasError('minlength')) return 'Mínimo 3 caracteres';
    return null;
  });

  guardar(): void {
    if (this.form.valid) {
      const result: DialogoGuardarRutinaResult = {
        nombre: this.form.value.nombre!,
        descripcion: this.form.value.descripcion || '',
        visibilidad: (this.form.value.visibilidad as 'privado' | 'clinica') || 'privado',
      };
      this.dialogRef.close(result);
    } else {
      this.form.markAllAsTouched();
    }
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
