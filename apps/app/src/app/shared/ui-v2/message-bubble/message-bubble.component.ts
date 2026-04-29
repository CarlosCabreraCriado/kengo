import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Ui2MessageBubbleFrom = 'me' | 'fisio';

/**
 * Message bubble V2 — `from="me"` coral gradient (alineada a la derecha),
 * `from="fisio"` cream (alineada a la izquierda). Border-radius asimétrico estilo iMessage.
 */
@Component({
  selector: 'ui2-message-bubble',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui2-bubble" [class.ui2-bubble--me]="isMe()">
      <div class="ui2-bubble__inner">
        <div class="ui2-bubble__text" [class.ui2-bubble__text--me]="isMe()">{{ text() }}</div>
        @if (time()) {
          <div class="ui2-bubble__meta" [class.ui2-bubble__meta--me]="isMe()">
            @if (unread()) {
              <span class="ui2-bubble__dot"></span>
            }
            {{ time() }}@if (unread()) { · Nuevo }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ui2-bubble {
      display: flex;
      justify-content: flex-start;
    }
    .ui2-bubble--me { justify-content: flex-end; }
    .ui2-bubble__inner { max-width: 78%; }
    .ui2-bubble__text {
      padding: 10px 13px;
      border-radius: 18px 18px 18px 4px;
      background: var(--cream-100);
      color: var(--ink-900);
      font-size: 13px;
      line-height: 1.4;
    }
    .ui2-bubble__text--me {
      background: linear-gradient(135deg, var(--kengo-primary), var(--kengo-primary-dark));
      color: white;
      border-radius: 18px 18px 4px 18px;
    }
    .ui2-bubble__meta {
      font-size: 10px;
      color: var(--ink-400);
      font-weight: 600;
      margin-top: 3px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ui2-bubble__meta--me { justify-content: flex-end; }
    .ui2-bubble__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--kengo-primary);
    }
  `],
})
export class Ui2MessageBubbleComponent {
  readonly from = input<Ui2MessageBubbleFrom>('fisio');
  readonly text = input.required<string>();
  readonly time = input<string | null>(null);
  readonly unread = input<boolean>(false);

  readonly isMe = computed(() => this.from() === 'me');
}
