// planes/builder/plan-config.component.ts
import { Component, inject } from '@angular/core';
import { PlanBuilderService } from '../services/plan-builder.service';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EjercicioPlan } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-plan-config',
  standalone: true,
  imports: [
    MatFormFieldModule,
    ReactiveFormsModule,
    DragDropModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './plan-config.component.html',
  styleUrls: ['./plan-config.component.css'],
})
export class PlanConfigComponent {
  svc = inject(PlanBuilderService);
  fb = inject(FormBuilder);

  dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  form = this.fb.group({
    titulo: ['', [Validators.required]],
    descripcion: [''],
    inicio: [''],
    fin: [''],
  });

  constructor() {
    // hidrata señales del form
    /*
    this.form.valueChanges.subscribe((v) => {
      this.svc.titulo.set(v.titulo || '');
      this.svc.descripcion.set(v.descripcion || '');
      this.svc.fecha_inicio.set(v.inicio || null);
      this.svc.fecha_fin.set(v.fin || null);
    });
    */
  }

  onDrop(ev: CdkDragDrop<unknown[]>) {
    if (ev.previousIndex === ev.currentIndex) return;
    this.svc.reorder(ev.previousIndex, ev.currentIndex);
  }

  update(i: number, patch: Partial<EjercicioPlan>) {
    this.svc.updateItem(i, patch);
  }

  isDia(it: EjercicioPlan, d: string) {
    return it.dias_semana?.includes(d);
  }

  toggleDia(i: number, d: string) {
    const it = this.svc.items()[i];
    const set = new Set(it.dias_semana || []);
    if (set.has(d)) {
      set.delete(d);
    } else {
      set.add(d);
    }
    this.svc.updateItem(i, { dias_semana: Array.from(set) });
  }

  assetUrl(id: string | null | undefined, w = 200, h = 200) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }
}
