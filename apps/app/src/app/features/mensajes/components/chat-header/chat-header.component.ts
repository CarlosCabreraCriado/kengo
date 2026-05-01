import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  Ui2AvatarComponent,
  Ui2BackButtonComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
} from '../../../../shared/ui-v2';
import type { Conversation } from '../../data-access/models/conversation.model';

@Component({
  selector: 'app-chat-header',
  standalone: true,
  imports: [
    Ui2AvatarComponent,
    Ui2BackButtonComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="hdr" [class.hdr--mobile]="mobile()">
      <div class="hdr__top">
        @if (mobile()) {
          <ui2-back-button (clicked)="back.emit()"></ui2-back-button>
        }

        <ui2-avatar
          [name]="conversation().participantName"
          [gradient]="conversation().participantGradient"
          [size]="mobile() ? 'sm' : 'md'"
          [online]="conversation().participantOnline"
        ></ui2-avatar>

        <div class="hdr__identity">
          <h1 class="hdr__name" [class.hdr__name--mobile]="mobile()">{{ conversation().participantName }}</h1>
          @if (subtitle()) {
            <p class="hdr__sub">{{ subtitle() }}</p>
          }
        </div>

        @if (!mobile() && mostrarStats() && conversation().patientStats; as stats) {
          <div class="hdr__pills">
            <ui2-pill variant="custom" [color]="successColor" size="md">
              Adherencia {{ stats.adherence }}%
            </ui2-pill>
            <ui2-pill variant="custom" [color]="dangerColor" size="md">
              Dolor {{ stats.lastPainScale }}/10
            </ui2-pill>
          </div>
        }

        <button
          type="button"
          class="hdr__profile"
          [attr.aria-label]="'Ver perfil de ' + conversation().participantName"
          (click)="openProfile.emit(conversation().participantId)"
        >
          <ui2-icon-badge icon="person" color="var(--ink-700)" [size]="mobile() ? 36 : 40" [radius]="12"></ui2-icon-badge>
        </button>
      </div>

      @if (mobile() && mostrarStats() && conversation().patientStats; as stats) {
        <div class="hdr__subbar">
          <ui2-pill variant="custom" [color]="successColor">
            Adherencia {{ stats.adherence }}%
          </ui2-pill>
          <ui2-pill variant="custom" [color]="dangerColor">
            Dolor {{ stats.lastPainScale }}/10
          </ui2-pill>
          <ui2-pill variant="neutral">{{ stats.activePlan }}</ui2-pill>
        </div>
      }
    </header>
  `,
  styles: [`
    :host { display: block; }
    .hdr {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }
    .hdr--mobile {
      padding: 0;
    }
    .hdr__top {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 24px;
    }
    .hdr--mobile .hdr__top {
      padding: 10px 14px;
      gap: 10px;
      height: 64px;
      box-sizing: border-box;
    }
    .hdr__identity {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .hdr__name {
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 22px;
      letter-spacing: -0.3px;
      text-transform: uppercase;
      color: var(--ink-900);
      margin: 0;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hdr__name--mobile {
      font-size: 15px;
      letter-spacing: 0;
      text-transform: none;
      font-family: Galvji, "Helvetica Neue", sans-serif;
      font-weight: 700;
    }
    .hdr__sub {
      font-size: 12px;
      color: var(--ink-500);
      margin: 0;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hdr__pills {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .hdr__profile {
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      display: inline-flex;
    }
    .hdr__subbar {
      display: flex;
      gap: 6px;
      padding: 0 14px 10px;
      flex-wrap: wrap;
      height: 52px;
      box-sizing: border-box;
      align-items: center;
    }
  `],
})
export class ChatHeaderComponent {
  readonly conversation = input.required<Conversation>();
  readonly mobile = input<boolean>(false);
  readonly mostrarStats = input<boolean>(true);
  readonly back = output<void>();
  readonly openProfile = output<string>();

  readonly successColor = 'var(--success)';
  readonly dangerColor = 'var(--danger)';

  readonly subtitle = computed(() => {
    const conv = this.conversation();
    const stats = conv.patientStats;
    if (!this.mostrarStats() || !stats) return '';
    const parts: string[] = [];
    if (stats.age > 0) parts.push(`${stats.age} años`);
    if (stats.activePlan) parts.push(stats.activePlan);
    return parts.join(' · ');
  });
}
