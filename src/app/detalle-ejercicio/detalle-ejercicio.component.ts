import { Component, OnInit } from '@angular/core';
import { Ejercicio } from '../models/Global';

import { EjerciciosService } from '../services/ejercicios.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-detalle-ejercicio',
  imports: [],
  templateUrl: './detalle-ejercicio.component.html',
  styleUrl: './detalle-ejercicio.component.css',
})
export class DetalleEjercicioComponent implements OnInit {
  private id_ejercicio: number | null = null;
  public ejercicio: Ejercicio | null = null;

  constructor(
    private ejerciciosService: EjerciciosService,
    private route: ActivatedRoute,
  ) {}

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
