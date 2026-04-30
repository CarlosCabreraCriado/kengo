import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import type { RolUsuario } from '../../../../types/global';
import { Ui2AvatarComponent } from '../avatar/avatar.component';
import { Ui2NotificacionesMenuComponent } from '../notificaciones-menu/notificaciones-menu.component';

/**
 * Patient header V2 — top fixed: logo K + nombre clínica + bell (con badge opcional) + avatar inicial.
 * El avatar abre un menú desplegable con: Mi perfil, Cambiar de modo (si aplica) y Cerrar sesión.
 * La campana abre el menú de notificaciones (solo en modo fisio).
 * 56px de alto. Glassmorphism cream sobre el cream-bg.
 */
@Component({
  selector: 'ui2-patient-header',
  standalone: true,
  imports: [Ui2AvatarComponent, Ui2NotificacionesMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ui2-patient-header">
      <div class="ui2-patient-header__brand">
        <span class="ui2-patient-header__logo">
          <img src="assets/logo-k.svg" alt="Kengo" />
        </span>
        <span class="ui2-patient-header__clinica">{{ clinica() }}</span>
      </div>
      <div class="ui2-patient-header__right">
        @if (sessionService.puedeRecibirNotificaciones()) {
          <div class="ui2-patient-header__bell-wrap">
            <button
              type="button"
              class="ui2-patient-header__bell"
              aria-label="Notificaciones"
              [attr.aria-expanded]="notificacionesMenuOpen()"
              aria-haspopup="dialog"
              (click)="toggleNotificacionesMenu($event)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
              @if (pendientes() > 0) {
                <span class="ui2-patient-header__bell-badge" aria-hidden="true">
                  {{ pendientes() > 9 ? '9+' : pendientes() }}
                </span>
              }
            </button>

            <ui2-notificaciones-menu
              [open]="notificacionesMenuOpen()"
              (closed)="cerrarNotificacionesMenu()"
            />
          </div>
        }
        <div class="ui2-patient-header__avatar-wrap">
          <button
            type="button"
            class="ui2-patient-header__avatar-btn"
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
              <button
                type="button"
                class="ui2-user-menu__item"
                role="menuitem"
                (click)="irAPerfil()"
              >
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
                  (keydown.space)="onToggleModo($event)"
                  (keydown.enter)="onToggleModo($event)"
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

            <div
              class="ui2-user-menu__backdrop"
              aria-hidden="true"
              (click)="cerrarMenu()"
            ></div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 60;
      display: block;
      pointer-events: none;
    }
    .ui2-patient-header {
      max-width: 720px;
      margin: 0 auto;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      pointer-events: auto;
    }
    .ui2-patient-header__brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .ui2-patient-header__logo {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: var(--shadow-card);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .ui2-patient-header__logo img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }
    .ui2-patient-header__clinica {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ui2-patient-header__right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .ui2-patient-header__bell-wrap { position: relative; }
    .ui2-patient-header__bell {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      box-shadow: var(--shadow-card);
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--ink-700);
      transition: color 0.12s;
    }
    .ui2-patient-header__bell:hover { color: var(--kengo-primary); }
    .ui2-patient-header__bell .material-symbols-outlined { font-size: 20px; }
    .ui2-patient-header__bell-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9999px;
      background: var(--kengo-primary);
      color: white;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid white;
      box-shadow: 0 2px 6px rgba(231, 92, 62, 0.35);
    }

    .ui2-patient-header__avatar-wrap {
      position: relative;
    }
    .ui2-patient-header__avatar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      border-radius: 9999px;
    }
    .ui2-patient-header__avatar-btn:focus-visible {
      outline: 2px solid var(--kengo-primary);
      outline-offset: 2px;
    }

    /* Dropdown menu */
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
      animation: ui2-user-menu-in 0.18s ease-out;
    }
    @keyframes ui2-user-menu-in {
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
      transition: background 0.12s, color 0.12s;
    }
    .ui2-user-menu__item:hover {
      background: var(--cream-100);
    }
    .ui2-user-menu__item .material-symbols-outlined {
      font-size: 20px;
      color: var(--ink-500);
      transition: color 0.12s;
    }
    .ui2-user-menu__item:hover .material-symbols-outlined {
      color: var(--kengo-primary);
    }
    .ui2-user-menu__item--switch {
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }
    .ui2-user-menu__item--switch:hover {
      background: var(--cream-50);
    }
    .ui2-user-menu__label {
      flex: 1;
    }
    .ui2-user-menu__item--danger {
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      color: var(--danger);
    }
    .ui2-user-menu__item--danger .material-symbols-outlined {
      color: var(--danger);
    }
    .ui2-user-menu__item--danger:hover {
      background: rgba(239, 68, 68, 0.08);
    }
    .ui2-user-menu__item--danger:hover .material-symbols-outlined {
      color: var(--danger);
    }

    /* iOS-style switch dentro del item de modo */
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
    .ui2-user-menu__switch--on {
      background: var(--kengo-primary);
    }
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
    .ui2-user-menu__switch--on .ui2-user-menu__thumb {
      transform: translateX(16px);
    }

    .ui2-user-menu__backdrop {
      position: fixed;
      inset: 0;
      z-index: 1099;
    }
  `],
})
export class Ui2PatientHeaderComponent {
  readonly clinica = input<string>('Mi clínica');
  readonly userName = input<string>('Usuario');
  readonly avatarUrl = input<string | null>(null);

  public readonly sessionService = inject(SessionService);
  public readonly notificacionesService = inject(NotificacionesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly notificacionesMenuOpen = signal(false);
  readonly modoPaciente = this.sessionService.enModoPaciente;
  readonly modoFisio = computed(() => !this.modoPaciente());
  readonly pendientes = this.notificacionesService.pendientes;

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.notificacionesMenuOpen.set(false);
    this.menuOpen.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuOpen.set(false);
  }

  toggleNotificacionesMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.notificacionesMenuOpen.update((v) => !v);
  }

  cerrarNotificacionesMenu(): void {
    this.notificacionesMenuOpen.set(false);
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
    if (this.notificacionesMenuOpen()) this.cerrarNotificacionesMenu();
  }
}
