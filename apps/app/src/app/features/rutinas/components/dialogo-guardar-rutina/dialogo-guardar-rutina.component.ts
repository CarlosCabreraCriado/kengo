import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DialogoGuardarRutinaData {
  nombreSugerido?: string;
}

export interface DialogoGuardarRutinaResult {
  nombre: string;
  descripcion: string;
  visibilidad: 'privado' | 'publico';
}

@Component({
  selector: 'app-dialogo-guardar-rutina',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title class="!flex items-center gap-2">
      <mat-icon class="material-symbols-outlined text-amber-500">bookmark_add</mat-icon>
      Guardar como plantilla
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="space-y-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Nombre de la plantilla</mat-label>
          <input
            matInput
            formControlName="nombre"
            placeholder="Ej: Rutina fortalecimiento rodilla"
          />
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>El nombre es requerido</mat-error>
          }
          @if (form.controls.nombre.hasError('minlength')) {
            <mat-error>Minimo 3 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Descripcion</mat-label>
          <textarea
            matInput
            formControlName="descripcion"
            rows="3"
            placeholder="Descripcion de la plantilla..."
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Visibilidad</mat-label>
          <mat-select formControlName="visibilidad">
            <mat-option value="privado">
              <div class="flex items-center gap-2">
                <mat-icon class="material-symbols-outlined !text-lg">lock</mat-icon>
                Privada - Solo yo puedo verla
              </div>
            </mat-option>
            <mat-option value="publico">
              <div class="flex items-center gap-2">
                <mat-icon class="material-symbols-outlined !text-lg">public</mat-icon>
                Publica - Otros fisios pueden usarla
              </div>
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        [disabled]="!form.valid"
        (click)="guardar()"
        class="!bg-amber-500 !text-white"
      >
        <mat-icon class="material-symbols-outlined">save</mat-icon>
        Guardar plantilla
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class DialogoGuardarRutinaComponent {
  private dialogRef = inject(MatDialogRef<DialogoGuardarRutinaComponent>);
  private data = inject<DialogoGuardarRutinaData>(MAT_DIALOG_DATA, { optional: true });
  private fb = inject(FormBuilder);

  form = this.fb.group({
    nombre: [this.data?.nombreSugerido || '', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    visibilidad: ['privado' as 'privado' | 'publico'],
  });

  guardar() {
    if (this.form.valid) {
      const result: DialogoGuardarRutinaResult = {
        nombre: this.form.value.nombre!,
        descripcion: this.form.value.descripcion || '',
        visibilidad: this.form.value.visibilidad!,
      };
      this.dialogRef.close(result);
    }
  }
}
