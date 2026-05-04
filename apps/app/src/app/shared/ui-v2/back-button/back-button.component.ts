import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Back button V2 — píldora 40×40 con glassmorphism cream sobre el background.
 * Si se proporciona `route`, navega vía RouterLink; si no, emite `clicked`.
 */
@Component({
  selector: 'ui2-back-button',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (route()) {
      <a
        class="ui2-back-button"
        [routerLink]="route()"
        [attr.aria-label]="ariaLabel()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span>
      </a>
    } @else {
      <button
        type="button"
        class="ui2-back-button"
        [attr.aria-label]="ariaLabel()"
        (click)="clicked.emit($event)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span>
      </button>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .ui2-back-button {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.6);
      color: var(--ink-700);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      box-shadow: var(--shadow-card);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      text-decoration: none;
    }
    .ui2-back-button:hover { background: rgba(255, 255, 255, 0.85); }
    .ui2-back-button:active { transform: translateY(1px); }
    .ui2-back-button .material-symbols-outlined { font-size: 22px; }
  `],
})
export class Ui2BackButtonComponent {
  readonly route = input<string | unknown[] | null>(null);
  readonly icon = input<string>('arrow_back');
  readonly ariaLabel = input<string>('Volver');
  readonly clicked = output<MouseEvent>();
}
