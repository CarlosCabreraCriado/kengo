import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Achievement card V2 — card 130px con badge tinted (emoji o icono) + título + sub.
 * Soporta estado `earned` (color completo, sombra) vs locked (opacidad reducida + 🔒).
 */
@Component({
  selector: 'ui2-achievement-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ui2-ach"
      [class.ui2-ach--locked]="!earned()"
    >
      <span class="ui2-ach__badge" [style.background]="badgeBg()">
        <span class="ui2-ach__emoji">{{ emoji() }}</span>
      </span>
      <span class="ui2-ach__title">{{ title() }}</span>
      <span class="ui2-ach__sub">{{ subtitle() }}</span>
      @if (!earned()) {
        <span class="ui2-ach__lock" aria-hidden="true">🔒</span>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; flex-shrink: 0; }
    .ui2-ach {
      position: relative;
      width: 130px;
      padding: 14px;
      border-radius: 18px;
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }
    .ui2-ach--locked {
      background: rgba(255, 255, 255, 0.5);
      box-shadow: none;
      opacity: 0.55;
    }
    .ui2-ach__badge {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }
    .ui2-ach__emoji {
      font-size: 24px;
      line-height: 1;
    }
    .ui2-ach__title {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
      margin-top: 10px;
    }
    .ui2-ach__sub {
      display: block;
      font-size: 10px;
      color: var(--ink-500);
      margin-top: 3px;
    }
    .ui2-ach__lock {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 11px;
    }
  `],
})
export class Ui2AchievementCardComponent {
  readonly emoji = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly color = input<string>('var(--kengo-primary)');
  readonly earned = input<boolean>(true);

  readonly badgeBg = computed(() => `color-mix(in srgb, ${this.color()} 13%, transparent)`);
}
