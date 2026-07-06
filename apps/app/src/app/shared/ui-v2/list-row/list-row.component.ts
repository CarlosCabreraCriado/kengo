import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2IconBadgeComponent } from '../icon-badge/icon-badge.component';

/**
 * List row V2 — IconBadge + título + subtítulo + slot trailing.
 * `isFirst=true` (default) → sin border-top. Para filas siguientes, pasar `isFirst=false`.
 */
@Component({
  selector: 'ui2-list-row',
  standalone: true,
  imports: [NgTemplateOutlet, Ui2IconBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rowClickable()) {
      <button
        type="button"
        class="ui2-list-row ui2-list-row--clickable"
        [class.ui2-list-row--bordered]="!isFirst()"
        (click)="rowClick.emit($event)"
      >
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </button>
    } @else {
      <div
        class="ui2-list-row"
        [class.ui2-list-row--bordered]="!isFirst()"
      >
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </div>
    }

    <ng-template #content>
      @if (icon()) {
        <ui2-icon-badge [icon]="icon()!" [color]="iconColor()"></ui2-icon-badge>
      }
      <div class="ui2-list-row__text">
        <div class="ui2-list-row__title">{{ title() }}</div>
        @if (subtitle()) {
          <div class="ui2-list-row__subtitle">{{ subtitle() }}</div>
        }
      </div>
      <div class="ui2-list-row__trailing">
        <ng-content></ng-content>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .ui2-list-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      border-radius: 0;
      font: inherit;
      color: inherit;
    }
    .ui2-list-row--bordered {
      border-top: 1px solid rgba(0, 0, 0, 0.04);
    }
    .ui2-list-row--clickable {
      cursor: pointer;
      transition: background 0.12s;
    }
    .ui2-list-row--clickable:hover {
      background: rgba(0, 0, 0, 0.02);
    }
    .ui2-list-row--clickable:active {
      background: rgba(0, 0, 0, 0.05);
    }
    .ui2-list-row__text {
      flex: 1;
      min-width: 0;
    }
    .ui2-list-row__title {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
    }
    .ui2-list-row__subtitle {
      font-size: 11px;
      color: var(--ink-500);
      margin-top: 2px;
      line-height: 1.3;
    }
    .ui2-list-row__trailing {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
  `],
})
export class Ui2ListRowComponent {
  readonly icon = input<string | null>(null);
  readonly iconColor = input<string>('var(--kengo-primary)');
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly isFirst = input<boolean>(true);
  readonly rowClickable = input<boolean>(false);
  readonly rowClick = output<MouseEvent>();
}
