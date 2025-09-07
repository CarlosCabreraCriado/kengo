import { Component, inject, signal, effect } from '@angular/core';
import { Ejercicio } from '../../types/global';

import { PlanBuilderService } from '../services/plan-builder.service';
import { EjerciciosService } from '../services/ejercicios.service';
import { ActivatedRoute } from '@angular/router';

//Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { RouterLink } from '@angular/router';

//RxJS
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

//Formularios:
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-detalle-ejercicio',
  imports: [
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
  ],
  templateUrl: './detalle-ejercicio.component.html',
  styleUrl: './detalle-ejercicio.component.css',
})
export class DetalleEjercicioComponent {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private ejerciciosService = inject(EjerciciosService);
  private planBuilderService = inject(PlanBuilderService);

  //Formulario:
  public formularioDetalleEjercicio = this.fb.group({
    series: [0, [Validators.min(0)]],
    repeticiones: [0, [Validators.min(0)]],
    peso: [0, [Validators.min(0)]],
    duracion: [0, [Validators.min(0)]],
    observaciones: [''],
  });

  // estado
  id_ejercicio = signal<string | number | null>(null);
  ejercicio = signal<Ejercicio | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((idParam) => {
        this.error.set(null);
        this.ejercicio.set(null);
        this.id_ejercicio.set(idParam ?? null);
        this.cargar();
      });

    // Si tu lista (resource) cambia después (p. ej., al navegar hacia atrás),
    // intenta re-hidratar desde caché automáticamente:
    effect(() => {
      const id = this.id_ejercicio();
      if (!id) return;
      const cached = this.ejerciciosService.findInCacheById(id);
      if (cached && !this.ejercicio()) {
        this.ejercicio.set(cached);
        this.loading.set(false);
        this.error.set(null);
      }
    });
  }

  private initFormFromExercise(ex: Ejercicio) {
    // Valores por defecto del ejercicio → formulario
    this.formularioDetalleEjercicio.reset({
      series: Number(ex.series_defecto) || 0,
      repeticiones: Number(ex.repeticiones_defecto) || 0,
      peso: 0,
      duracion: 0,
      observaciones: '',
    });
  }

  private cargar() {
    //this.id_ejercicio = Number(this.route.snapshot.paramMap.get('id')!) || null;
    //
    const id = this.id_ejercicio();
    if (!id) return;

    // 1) Primero busca en el resource ya cargado (lista/página actual)
    const cached = this.ejerciciosService.findInCacheById(id);
    if (cached) {
      this.ejercicio.set(cached);
      this.initFormFromExercise(cached);
      this.loading.set(false);
      return;
    }

    // 2) Si no está en caché, pide al servidor
    this.loading.set(true);
    this.ejerciciosService.getEjercicioById$(id).subscribe({
      next: (ex: Ejercicio) => {
        this.ejercicio.set(ex);
        this.initFormFromExercise(ex);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error(err);
        this.error.set('No se pudo cargar el ejercicio.');
        this.loading.set(false);
      },
    });
  }

  restablecerValores() {
    const ex = this.ejercicio();
    if (ex) this.initFormFromExercise(ex);
  }

  getAssetUrl(id: number | string) {
    return this.ejerciciosService.getAssetUrl(String(id));
  }

  onSubmit() {
    if (this.formularioDetalleEjercicio.invalid || !this.ejercicio()) return;

    const payload = {
      ejercicio_id: this.ejercicio()!.id_ejercicio,
      ...this.formularioDetalleEjercicio.getRawValue(),
    };

    // Aquí puedes emitir/guardar/añadir al plan, etc.
    console.log('[detalle-ejercicio] payload', payload);
  }

  asignarEjercicio() {
    const ejercicio = this.ejercicio();
    if (ejercicio) {
      this.planBuilderService.addEjercicio(ejercicio);
    }
  }
}
