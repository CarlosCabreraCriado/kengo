import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../auth/services/auth.service';
import { SessionService } from '../../auth/services/session.service';
import { ConvexService } from '../../convex/convex.service';
import { NetworkService } from '../../services/network.service';
import { Ui2ButtonComponent } from '../../../shared/ui-v2/button/button.component';

@Component({
  selector: 'app-connection-error',
  standalone: true,
  imports: [Ui2ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './connection-error.component.html',
  styleUrl: './connection-error.component.css',
})
export class ConnectionErrorComponent {
  private auth = inject(AuthService);
  private session = inject(SessionService);
  private convex = inject(ConvexService);
  private network = inject(NetworkService);

  readonly reintentando = signal(false);
  readonly sinRed = signal(false);

  // Mensaje secundario según el último motivo conocido del fallo.
  readonly detalle = (): string => {
    if (this.sinRed()) {
      return 'Sigues sin conexión. Comprueba el wifi o los datos móviles.';
    }
    switch (this.convex.tokenError()) {
      case 'timeout':
        return 'El servidor está tardando demasiado en responder.';
      case 'network':
        return 'Comprueba tu conexión a internet.';
      case 'server-error':
        return 'Estamos teniendo problemas técnicos puntuales.';
      default:
        return 'No hemos podido contactar con el servidor.';
    }
  };

  async reintentar(): Promise<void> {
    if (this.reintentando()) return;

    // Sin red no tiene sentido lanzar el retry (fallaría con timeout tras
    // varios segundos): avisar de inmediato.
    if (!this.network.online()) {
      this.sinRed.set(true);
      return;
    }
    this.sinRed.set(false);

    this.reintentando.set(true);
    try {
      await this.auth.reintentarConexion();
    } finally {
      this.reintentando.set(false);
    }
  }

  async cerrarSesion(): Promise<void> {
    this.session.limpiarErrorConexion();
    await this.auth.logout();
  }
}
