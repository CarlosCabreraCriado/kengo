import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { Ui2MessageBubbleComponent } from '../../../../shared/ui-v2';
import { ChatDaySeparatorComponent } from '../chat-day-separator/chat-day-separator.component';
import { MensajesService } from '../../data-access/mensajes.service';
import type { ThreadItem } from '../../data-access/models/message.model';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [Ui2MessageBubbleComponent, ChatDaySeparatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #scroller class="thread" [class.thread--mobile]="mobile()">
      @for (item of items(); track trackItem($index, item)) {
        @if (item.kind === 'day') {
          <app-chat-day-separator [label]="item.label"></app-chat-day-separator>
        } @else {
          <ui2-message-bubble
            [from]="mensajes.isFromMe(item.message) ? 'me' : 'fisio'"
            [text]="item.message.text"
            [time]="mensajes.formatHour(item.message.timestamp)"
            [read]="!!item.message.readAt"
          ></ui2-message-bubble>
        }
      }
      @if (items().length === 0) {
        <div class="thread__empty">
          <p>Empieza la conversación.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .thread {
      height: 100%;
      overflow-y: auto;
      padding: 18px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.3) 100%);
    }
    .thread--mobile {
      padding: 14px 16px;
    }
    .thread__empty {
      flex: 1;
      display: grid;
      place-items: center;
      color: var(--ink-400);
      font-size: 13px;
    }
  `],
})
export class ChatThreadComponent implements AfterViewInit {
  protected mensajes = inject(MensajesService);

  readonly items = input.required<ThreadItem[]>();
  readonly mobile = input<boolean>(false);

  @ViewChild('scroller') private scroller?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      this.items();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  trackItem(index: number, item: ThreadItem): string {
    return item.kind === 'day' ? `day-${index}-${item.label}` : `msg-${item.message.id}`;
  }

  private scrollToBottom(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
