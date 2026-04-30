import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { SessionService } from '../../../core/auth/services/session.service';
import type { RolUsuario } from '../../../../types/global';
import { Ui2AvatarComponent } from '../avatar/avatar.component';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Web topbar V2 — barra superior desktop con saludo + fecha + bell + avatar dropdown.
 * Versión simplificada (sin buscador ni CTA secundario). Renderizada solo en md+.
 */
@Component({
  selector: 'ui2-web-topbar',
  standalone: true,
  imports: [Ui2AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ui2-topbar">
      <div class="ui2-topbar__greeting">
        <span class="ui2-topbar__eyebrow">{{ eyebrow() }}</span>
        <h2 class="ui2-topbar__title">Hola {{ userName() }} 👋</h2>
      </div>

      <div class="ui2-topbar__right">
        <button
          type="button"
          class="ui2-topbar__bell"
          aria-label="Notificaciones"
          (click)="bellClick.emit()"
        >
          <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
          @if (hasNotifications()) {
            <span class="ui2-topbar__bell-dot" aria-hidden="true"></span>
          }
        </button>

        <div class="ui2-topbar__avatar-wrap">
          <button
            type="button"
            class="ui2-topbar__avatar-btn"
            [attr.aria-expanded]="menuOpen()"
            aria-haspopup="menu"
            aria-label="Abrir menú de usuario"
            (click)="toggleMenu($event)"
          >
            <ui2-avatar
              [name]="userName()"
              [src]="avatarUrl()"
              size="sm"
              [border]="true"
            ></ui2-avatar>
          </button>

          @if (menuOpen()) {
            <div class="ui2-user-menu" role="menu">
              <button type="button" class="ui2-user-menu__item" role="menuitem" (click)="irAPerfil()">
                <span class="material-symbols-outlined" aria-hidden="true">person</span>
                <span>Mi perfil</span>
              </button>

              @if (sessionService.puedeAlternarModo()) {
                <button
                  type="button"
                  class="ui2-user-menu__item ui2-user-menu__item--switch"
                  role="switch"
                  [attr.aria-checked]="modoFisio()"
                  (click)="onToggleModo($event)"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
                  <span class="ui2-user-menu__label">Modo fisio</span>
                  <span class="ui2-user-menu__switch" [class.ui2-user-menu__switch--on]="modoFisio()" aria-hidden="true">
                    <span class="ui2-user-menu__thumb"></span>
                  </span>
                </button>
              }

              <button
                type="button"
                class="ui2-user-menu__item ui2-user-menu__item--danger"
                role="menuitem"
                (click)="cerrarSesion()"
              >
                <span class="material-symbols-outlined" aria-hidden="true">logout</span>
                <span>Cerrar sesión</span>
              </button>
            </div>
            <div class="ui2-user-menu__backdrop" aria-hidden="true" (click)="cerrarMenu()"></div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; position: relative; z-index: 60; }
    .ui2-topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 32px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(10px) saturate(180%);
      -webkit-backdrop-filter: blur(10px) saturate(180%);
    }
    .ui2-topbar__greeting {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .ui2-topbar__eyebrow {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-500);
      letter-spacing: 0.3px;
      line-height: 1;
      text-transform: capitalize;
    }
    .ui2-topbar__title {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 22px;
      letter-spacing: -0.2px;
      color: var(--ink-900);
      line-height: 1;
      margin: 6px 0 0;
    }

    .ui2-topbar__right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .ui2-topbar__bell {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      background: white;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--ink-700);
      box-shadow: var(--shadow-card);
    }
    .ui2-topbar__bell .material-symbols-outlined { font-size: 20px; }
    .ui2-topbar__bell-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--kengo-primary);
      border: 1.5px solid white;
    }

    .ui2-topbar__avatar-wrap { position: relative; }
    .ui2-topbar__avatar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      border-radius: 9999px;
    }
    .ui2-topbar__avatar-btn:focus-visible {
      outline: 2px solid var(--kengo-primary);
      outline-offset: 2px;
    }

    /* Dropdown menu (idéntico al de patient-header / sidebar) */
    .ui2-user-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 1100;
      min-width: 220px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: var(--shadow-card-strong), 0 10px 40px rgba(0, 0, 0, 0.12);
      animation: ui2-topbar-menu-in 0.18s ease-out;
    }
    @keyframes ui2-topbar-menu-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .ui2-user-menu__item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border: 0;
      background: transparent;
      text-align: left;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink-700);
      cursor: pointer;
    }
    .ui2-user-menu__item:hover { background: var(--cream-100); }
    .ui2-user-menu__item .material-symbols-outlined {
      font-size: 20px;
      color: var(--ink-500);
    }
    .ui2-user-menu__item:hover .material-symbols-outlined { color: var(--kengo-primary); }
    .ui2-user-menu__item--switch { border-top: 1px solid rgba(0, 0, 0, 0.05); }
    .ui2-user-menu__item--switch:hover { background: var(--cream-50); }
    .ui2-user-menu__label { flex: 1; }
    .ui2-user-menu__item--danger {
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      color: var(--danger);
    }
    .ui2-user-menu__item--danger .material-symbols-outlined { color: var(--danger); }
    .ui2-user-menu__item--danger:hover { background: rgba(239, 68, 68, 0.08); }
    .ui2-user-menu__switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 40px;
      height: 24px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.18);
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .ui2-user-menu__switch--on { background: var(--kengo-primary); }
    .ui2-user-menu__thumb {
      position: absolute;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s;
    }
    .ui2-user-menu__switch--on .ui2-user-menu__thumb { transform: translateX(16px); }
    .ui2-user-menu__backdrop {
      position: fixed;
      inset: 0;
      z-index: 1099;
    }
  `],
})
export class Ui2WebTopbarComponent {
  readonly userName = input<string>('Usuario');
  readonly avatarUrl = input<string | null>(null);
  readonly hasNotifications = input<boolean>(false);
  readonly bellClick = output<void>();

  public readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly modoPaciente = this.sessionService.enModoPaciente;
  readonly modoFisio = computed(() => !this.modoPaciente());

  readonly eyebrow = computed(() => {
    const now = new Date();
    const weekday = WEEKDAYS[now.getDay()];
    const day = now.getDate();
    const month = MONTHS[now.getMonth()];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${weekday} ${day} de ${month} · ${hh}:${mm}`;
  });

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuOpen.set(false);
  }

  irAPerfil(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    this.menuOpen.set(false);
    await this.authService.logout();
  }

  onToggleModo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.sessionService.puedeAlternarModo()) return;
    const nuevo: RolUsuario = this.modoPaciente() ? 'fisio' : 'paciente';
    this.sessionService.setRolUsuario(nuevo);
    this.menuOpen.set(false);
    this.router.navigateByUrl('/inicio');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) this.cerrarMenu();
  }
}
