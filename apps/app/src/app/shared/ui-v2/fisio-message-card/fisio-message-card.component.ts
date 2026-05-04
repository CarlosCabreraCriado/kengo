import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Ui2AvatarComponent } from '../avatar/avatar.component';
import { Ui2CardComponent } from '../card/card.component';
import { Ui2PillComponent } from '../pill/pill.component';

/**
 * Fisio message card V2 — Card tinted con avatar + overline "Nota de tu fisio" + texto en italics + Pill primary opcional.
 */
@Component({
  selector: 'ui2-fisio-message-card',
  standalone: true,
  imports: [Ui2AvatarComponent, Ui2CardComponent, Ui2PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui2-card variant="tinted" [padding]="16">
      <div class="ui2-fisio-card">
        <ui2-avatar [name]="name()" [src]="avatarUrl()" size="md"></ui2-avatar>
        <div class="ui2-fisio-card__body">
          <div class="ui2-fisio-card__head">
            <span class="ui2-fisio-card__overline">Nota de tu fisio</span>
            @if (time()) {
              <span class="ui2-fisio-card__time">· {{ time() }}</span>
            }
          </div>
          <p class="ui2-fisio-card__text">"{{ text() }}"</p>
          <div class="ui2-fisio-card__signature">— {{ name() }}</div>
          @if (action()) {
            <div class="ui2-fisio-card__action">
              <ui2-pill
                variant="primary"
                size="md"
                icon="chat"
                [clickable]="true"
                (pillClick)="actionClick.emit($event)"
              >{{ action() }}</ui2-pill>
            </div>
          }
        </div>
      </div>
    </ui2-card>
  `,
  styles: [`
    :host { display: block; }
    .ui2-fisio-card {
      display: flex;
      gap: 12px;
    }
    .ui2-fisio-card__body {
      flex: 1;
      min-width: 0;
    }
    .ui2-fisio-card__head {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .ui2-fisio-card__overline {
      font-size: 11px;
      color: var(--kengo-primary);
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .ui2-fisio-card__time {
      font-size: 10px;
      color: var(--ink-400);
    }
    .ui2-fisio-card__text {
      font-size: 14px;
      color: var(--ink-900);
      line-height: 1.5;
      margin: 6px 0 0;
      font-style: italic;
    }
    .ui2-fisio-card__signature {
      font-size: 11px;
      color: var(--ink-500);
      margin-top: 8px;
    }
    .ui2-fisio-card__action { margin-top: 10px; }
  `],
})
export class Ui2FisioMessageCardComponent {
  readonly name = input<string>('Tu fisio');
  readonly avatarUrl = input<string | null>(null);
  readonly time = input<string | null>(null);
  readonly text = input.required<string>();
  readonly action = input<string | null>(null);
  readonly actionClick = output<MouseEvent>();
}
