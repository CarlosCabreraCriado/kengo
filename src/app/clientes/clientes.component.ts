import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css',
})
export class ClientesComponent {
  public clientes = [
    {
      id: 1,
      nombre: 'Emilio',
      apellidos: 'Diaz Tejera',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 2,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      telefono: '690574534',
      email: 'emilio@gmail.com',
    },
    {
      id: 3,
      nombre: 'Emilio',
      apellidos: 'González',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 4,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 5,
      nombre: 'Emilio',
      apellidos: 'González',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 6,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 7,
      nombre: 'Emilio',
      apellidos: 'González',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
    {
      id: 8,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      email: 'emilio@gmail.com',
      telefono: '690574534',
    },
  ];
}
