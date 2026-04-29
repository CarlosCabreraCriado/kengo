import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2CardComponent } from '../card/card.component';
import { Ui2SectionLabelComponent } from '../section-label/section-label.component';

export interface Ui2AchievementListItem {
  emoji: string;
  title: string;
  sub: string;
  color: string;
  earned: boolean;
}

/**
 * Web achievements list V2 — card con header (eyebrow + acción "Ver todos") + filas de logros.
 * Cada fila: emoji square tinted + título + sub + lock 🔒 si no earned.
 * Variante de vista desktop (no confundir con Ui2AchievementCardComponent que es la card de carrusel).
 */
@Component({
  selector: 'ui2-web-achievements-list',
  standalone: true,
  imports: [Ui2CardComponent, Ui2SectionLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card [padding]="18">
      <ui2-section-label
        [action]="action()"
        (actionClick)="actionClick.emit()"
      >Logros recientes</ui2-section-label>

      <ul class="ui2-walist">
        @for (item of items(); track item.title) {
          <li
            class="ui2-walist__row"
            [class.ui2-walist__row--locked]="!item.earned"
          >
            <span
              class="ui2-walist__badge"
              [style.background]="badgeBg(item.color)"
            >
              <span class="ui2-walist__emoji">{{ item.emoji }}</span>
            </span>
            <span class="ui2-walist__text">
              <span class="ui2-walist__title">{{ item.title }}</span>
              <span class="ui2-walist__sub">{{ item.sub }}</span>
            </span>
            @if (!item.earned) {
              <span class="ui2-walist__lock" aria-hidden="true">🔒</span>
            }
          </li>
        }
      </ul>
    </ui2-card>
  `,
  styles: [`
    :host { display: block; }
    .ui2-walist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ui2-walist__row {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px;
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.02);
    }
    .ui2-walist__row--locked {
      background: transparent;
      opacity: 0.5;
    }
    .ui2-walist__badge {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      flex-shrink: 0;
    }
    .ui2-walist__emoji {
      font-size: 22px;
      line-height: 1;
    }
    .ui2-walist__text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .ui2-walist__title {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
    }
    .ui2-walist__sub {
      font-size: 11px;
      color: var(--ink-500);
      margin-top: 2px;
      line-height: 1.2;
    }
    .ui2-walist__lock {
      font-size: 13px;
      flex-shrink: 0;
    }
  `],
})
export class Ui2WebAchievementsListComponent {
  readonly items = input.required<Ui2AchievementListItem[]>();
  readonly action = input<string | null>('Ver todos');
  readonly actionClick = output<void>();

  badgeBg(color: string): string {
    if (color.startsWith('var(')) {
      return `color-mix(in srgb, ${color} 13%, transparent)`;
    }
    return `${color}1f`;
  }
}
