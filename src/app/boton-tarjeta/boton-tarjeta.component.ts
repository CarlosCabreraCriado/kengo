import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-boton-tarjeta',
  standalone: true,
  imports: [],
  templateUrl: './boton-tarjeta.component.html',
  styleUrl: './boton-tarjeta.component.css',
})
export class BotonTarjetaComponent {
  @Input({ required: true }) tipo = 'centro';
}
