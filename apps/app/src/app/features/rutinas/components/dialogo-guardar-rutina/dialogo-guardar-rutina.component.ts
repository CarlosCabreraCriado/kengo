import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

import {
  DialogContainerComponent,
  DialogHeaderComponent,
  DialogContentComponent,
  DialogActionsComponent,
} from '../../../../shared/ui/dialog';

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
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
  ],
  template: `
    <ui-dialog-container>
      <ui-dialog-header title="Guardar como plantilla" (closeClick)="cancelar()">
        <span class="material-symbols-outlined text-amber-500">bookmark_add</span>
      </ui-dialog-header>

      <ui-dialog-content>
        <form [formGroup]="form" class="space-y-4">
          <div class="flex flex-col gap-1.5">
            <label for="nombre" class="text-sm font-medium text-gray-700">Nombre de la plantilla</label>
            <input
              id="nombre"
              type="text"
              formControlName="nombre"
              placeholder="Ej: Rutina fortalecimiento rodilla"
              class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              [class.border-red-500]="form.controls.nombre.invalid && form.controls.nombre.touched"
            />
            @if (form.controls.nombre.hasError('required') && form.controls.nombre.touched) {
              <span class="text-xs text-red-600">El nombre es requerido</span>
            }
            @if (form.controls.nombre.hasError('minlength') && form.controls.nombre.touched) {
              <span class="text-xs text-red-600">Mínimo 3 caracteres</span>
            }
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="descripcion" class="text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              id="descripcion"
              formControlName="descripcion"
              rows="3"
              placeholder="Descripción de la plantilla..."
              class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="visibilidad" class="text-sm font-medium text-gray-700">Visibilidad</label>
            <select
              id="visibilidad"
              formControlName="visibilidad"
              class="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="privado">🔒 Privada - Solo yo puedo verla</option>
              <option value="publico">🌐 Pública - Otros fisios pueden usarla</option>
            </select>
          </div>
        </form>
      </ui-dialog-content>

      <ui-dialog-actions>
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          (click)="cancelar()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="!form.valid"
          (click)="guardar()"
        >
          <span class="material-symbols-outlined text-lg">save</span>
          Guardar plantilla
        </button>
      </ui-dialog-actions>
    </ui-dialog-container>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class DialogoGuardarRutinaComponent {
  private dialogRef = inject(DialogRef);
  private data = inject<DialogoGuardarRutinaData>(DIALOG_DATA, { optional: true });
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

  cancelar() {
    this.dialogRef.close();
  }
}
