import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ui2AvatarComponent } from '../avatar/avatar.component';

/**
 * Patient header V2 — top fixed: logo K + nombre clínica + bell (con dot opcional) + avatar inicial.
 * 56px de alto. Glassmorphism cream sobre el cream-bg.
 */
@Component({
  selector: 'ui2-patient-header',
  standalone: true,
  imports: [RouterLink, Ui2AvatarComponent],
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
        <button
          type="button"
          class="ui2-patient-header__bell"
          aria-label="Notificaciones"
          (click)="bellClick.emit()"
        >
          <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
          @if (hasNotifications()) {
            <span class="ui2-patient-header__bell-dot" aria-hidden="true"></span>
          }
        </button>
        <a class="ui2-patient-header__avatar-link" routerLink="/perfil" aria-label="Perfil">
          <ui2-avatar
            [name]="userName()"
            [src]="avatarUrl()"
            size="sm"
            [border]="true"
          ></ui2-avatar>
        </a>
      </div>
    </header>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
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
    }
    .ui2-patient-header__bell .material-symbols-outlined { font-size: 20px; }
    .ui2-patient-header__bell-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--danger);
      border: 1.5px solid white;
    }
    .ui2-patient-header__avatar-link {
      display: inline-flex;
      text-decoration: none;
    }
  `],
})
export class Ui2PatientHeaderComponent {
  readonly clinica = input<string>('Mi clínica');
  readonly userName = input<string>('Usuario');
  readonly avatarUrl = input<string | null>(null);
  readonly hasNotifications = input<boolean>(false);
  readonly bellClick = output<void>();
}
