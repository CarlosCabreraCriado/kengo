import { Component, input } from '@angular/core';
import { Usuario } from '../../types/global';

@Component({
  selector: 'app-tarjeta-fisio',
  standalone: true,
  imports: [],
  templateUrl: './tarjeta-fisio.component.html',
  styleUrl: './tarjeta-fisio.component.css',
})
export class TarjetaFisioComponent {
  // Input preparado para uso futuro con datos reales
  // Por ahora el template mantiene datos hardcodeados
  fisio = input<Usuario | null>(null);
}
