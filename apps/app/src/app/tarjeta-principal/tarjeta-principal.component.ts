import { Component, Signal, signal } from '@angular/core';
import { AppService } from '../services/app.service';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';

@Component({
  selector: 'app-tarjeta-principal',
  standalone: true,
  imports: [MatButtonModule, RouterLink, SafeHtmlPipe],
  templateUrl: './tarjeta-principal.component.html',
  styleUrl: './tarjeta-principal.component.css',
})
export class TarjetaPrincipalComponent {
  public userRole = this.appService.rolUsuario;

  public pacientes = [
    {
      nombre: 'Juan Perez',
      fotoPerfil: 'https://via.placeholder.com/150',
    },
    {
      nombre: 'Maria Lopez',
      fotoPerfil: 'https://via.placeholder.com/150',
    },
    {
      nombre: 'Carlos Gomez',
      fotoPerfil: 'https://via.placeholder.com/150',
    },
  ];

  public ejercicios = [
    {
      id_ejercicio: 5,
      nombre_ejercicio: 'Tobillo Trasero',
      series_defecto: '3',
      repeticiones_defecto: '15',
      video: 'c951f547-32ac-46fa-8216-af57d595e7c1',
      descripcion: 'Ejercicio para fortalecer el tobillo.',
      portada: 'e9f90c83-68bb-4e14-8eeb-90689271577f',
      categoria: [2],
      portada_url: '../assets/ejercicio.PNG',
    },
    {
      id_ejercicio: 6,
      nombre_ejercicio: 'Tobillo Rodillo',
      series_defecto: '3',
      repeticiones_defecto: '15',
      video: '589b0b73-d39d-4157-8670-c01e9dddd4ed',
      descripcion: null,
      portada: '64a88502-1e78-4bad-b72b-f7c1a3d50dda',
      categoria: [3],
      portada_url: '../assets/ejercicio.PNG',
    },
    {
      id_ejercicio: 7,
      nombre_ejercicio: 'Tobillo Elastico',
      series_defecto: '3',
      repeticiones_defecto: '15',
      video: '81a629df-2ba0-4144-966a-98f72ceb2901',
      descripcion: null,
      portada: '1ddb1553-d89b-4609-809c-5fea344f0f44',
      categoria: [4],
      portada_url: '../assets/ejercicio.PNG',
    },
  ];

  constructor(private appService: AppService) {}
}
