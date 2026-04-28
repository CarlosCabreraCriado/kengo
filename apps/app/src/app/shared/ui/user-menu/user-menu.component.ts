import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/services/session.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import type { RolUsuario } from '../../../../types/global';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  public sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  open = input.required<boolean>();
  closed = output<void>();

  modoPaciente = this.sessionService.enModoPaciente;

  irAPerfil(): void {
    this.closed.emit();
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    this.closed.emit();
    await this.authService.logout();
  }

  onToggleModo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.sessionService.puedeAlternarModo()) return;
    const nuevo: RolUsuario = this.modoPaciente() ? 'fisio' : 'paciente';
    this.sessionService.setRolUsuario(nuevo);
    this.closed.emit();
    this.router.navigateByUrl('/inicio');
  }

  cerrar(): void {
    this.closed.emit();
  }
}
