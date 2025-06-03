import { Component, OnInit } from '@angular/core';
import { Ejercicio } from '../models/Global';

import { EjerciciosService } from '../services/ejercicios.service';
import { ActivatedRoute } from '@angular/router';

//Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

//Formularios:
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from '@angular/forms';

@Component({
  selector: 'app-detalle-ejercicio',
  imports: [
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './detalle-ejercicio.component.html',
  styleUrl: './detalle-ejercicio.component.css',
})
export class DetalleEjercicioComponent implements OnInit {
  private id_ejercicio: number | null = null;
  public ejercicio: Ejercicio | null = null;

  //Formulario:
  public formularioDetalleEjercicio: FormGroup;

  constructor(
    private ejerciciosService: EjerciciosService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
  ) {
    this.formularioDetalleEjercicio = this.fb.group({
      series: [3, [Validators.required]],
      repeticiones: [15, [Validators.required]],
      peso: [0, [Validators.required]],
      duracion: [0, [Validators.required]],
      nota: ['', [Validators.required]],
    });
  }

  ngOnInit() {
    this.id_ejercicio = Number(this.route.snapshot.paramMap.get('id')!) || null;
    console.log('Ejercicio:', this.id_ejercicio);
    this.ejerciciosService
      .getEjercicioById(this.id_ejercicio)
      .subscribe((ejercicio) => {
        this.ejercicio = ejercicio;
      });

    console.log('Ejercicio encontrado:', this.ejercicio);
  }
}
