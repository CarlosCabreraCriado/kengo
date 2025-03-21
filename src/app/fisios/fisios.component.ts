import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-fisios',
  standalone: true,
  imports: [],
  templateUrl: './fisios.component.html',
  styleUrl: './fisios.component.css',
})
export class FisiosComponent implements OnInit {
  public datosCargados = false;
  public fisios = [
    {
      id: 1,
      nombre: 'Emilio',
      apellidos: 'Diaz Tejera',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 2,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      puesto: 'Fisioterapeuta',
      altura: '1.80m',
    },
    {
      id: 3,
      nombre: 'Emilio',
      apellidos: 'González',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 4,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 5,
      nombre: 'Emilio',
      apellidos: 'González',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 6,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 7,
      nombre: 'Emilio',
      apellidos: 'González',
      puesto: 'Fisioterapeuta',
    },
    {
      id: 8,
      nombre: 'Carlos',
      apellidos: 'Cabrera',
      puesto: 'Fisioterapeuta',
    },
  ];

  ngOnInit() {
    console.log('HOLA EMI');
    console.log(this.fisios);
    console.log(this.fisios[0]);
    console.log(this.fisios[0].apellidos[1]);
    console.log(this.fisios[0]['altura']);

    console.log(23); //--> NUMBER
    console.log(false, true); //--> BOOLEAN
    console.log('EMILIO'); //--> STRING
    console.log(null); //--> NULL
    console.log(undefined); //--> UNDEFINED

    console.log([]); //--> ARRAY
    console.log({}); //--> OBJETO
  }
}
