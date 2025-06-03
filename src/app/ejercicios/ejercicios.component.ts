import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { OnInit } from '@angular/core';

import { EjerciciosService } from '../services/ejercicios.service';
import { Ejercicio } from '../models/Global';

@Component({
  selector: 'app-ejercicios',
  standalone: true,
  imports: [RouterLink, MatCardModule],
  templateUrl: './ejercicios.component.html',
  styleUrl: './ejercicios.component.css',
})
export class EjerciciosComponent implements OnInit {
  public ejercicios: Ejercicio[] = [];

  constructor(private ejerciciosService: EjerciciosService) {
    this.ejerciciosService.ejercicios$.subscribe((ejercicios) => {
      console.log('Ejercicios: ', ejercicios);
      if (ejercicios) {
        this.ejercicios = ejercicios;
      }
    });
  }

  ngOnInit() {
    console.log('EjerciciosComponent initialized');
    this.ejerciciosService.getEjercicios();
  }
}
