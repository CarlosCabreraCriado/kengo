import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Ui2AvatarComponent } from '../../../../shared/ui-v2';
import { MensajesService } from '../../data-access/mensajes.service';
import type { Conversation } from '../../data-access/models/conversation.model';

@Component({
  selector: 'app-chat-row',
  standalone: true,
  imports: [Ui2AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="row"
      [class.row--active]="active()"
      [class.row--mobile]="mobile()"
      [class.row--mobile-card]="mobile() && hasUnread()"
      (click)="rowSelect.emit(conversation().id)"
    >
      <ui2-avatar
        [name]="conversation().participantName"
        [gradient]="conversation().participantGradient"
        [size]="mobile() ? 'md' : 'sm'"
        [online]="conversation().participantOnline"
      ></ui2-avatar>

      <div class="row__body">
        <div class="row__top">
          <span class="row__name" [class.row__name--unread]="hasUnread()">{{ conversation().participantName }}</span>
          <span class="row__time" [class.row__time--unread]="hasUnread()">{{ relativeTime() }}</span>
        </div>
        <div class="row__bottom">
          <span class="row__preview" [class.row__preview--unread]="hasUnread()">{{ previewText() }}</span>
          @if (hasUnread()) {
            <span class="row__badge" [class.row__badge--mobile]="mobile()">{{ conversation().unreadCount }}</span>
          }
        </div>
      </div>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: 1px solid transparent;
      border-radius: 14px;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s, box-shadow 0.12s, border-color 0.12s;
    }
    .row:hover { background: rgba(255, 255, 255, 0.45); }
    .row--active {
      background: white;
      border-color: rgba(0, 0, 0, 0.04);
      box-shadow: var(--shadow-card);
    }
    .row--mobile {
      gap: 14px;
      padding: 12px;
    }
    .row--mobile-card {
      background: white;
      border-color: rgba(0, 0, 0, 0.04);
      box-shadow: var(--shadow-card);
    }

    .row__body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .row__top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .row__name {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row__name--unread { color: var(--ink-900); }
    .row__time {
      font-size: 10px;
      font-weight: 600;
      color: var(--ink-400);
      flex-shrink: 0;
    }
    .row__time--unread { color: var(--kengo-primary); }

    .row__bottom {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .row__preview {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      font-weight: 400;
      color: var(--ink-500);
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .row__preview--unread {
      font-weight: 700;
      color: var(--ink-900);
    }
    .row--mobile .row__preview {
      -webkit-line-clamp: 2;
      white-space: normal;
    }

    .row__badge {
      flex-shrink: 0;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9999px;
      background: var(--kengo-primary);
      color: white;
      font-size: 10px;
      font-weight: 700;
      display: inline-grid;
      place-items: center;
      box-shadow: var(--shadow-pill-coral);
    }
    .row__badge--mobile {
      min-width: 20px;
      height: 20px;
      font-size: 11px;
    }
  `],
})
export class ChatRowComponent {
  private mensajes = inject(MensajesService);

  readonly conversation = input.required<Conversation>();
  readonly active = input<boolean>(false);
  readonly mobile = input<boolean>(false);
  readonly rowSelect = output<string>();

  readonly hasUnread = computed(() => this.conversation().unreadCount > 0);

  readonly relativeTime = computed(() =>
    this.mensajes.formatRelativeDay(this.conversation().lastMessage.timestamp),
  );

  readonly previewText = computed(() => {
    const conv = this.conversation();
    const prefix = conv.lastMessage.fromMe ? 'Tú: ' : '';
    return prefix + conv.lastMessage.text;
  });
}
