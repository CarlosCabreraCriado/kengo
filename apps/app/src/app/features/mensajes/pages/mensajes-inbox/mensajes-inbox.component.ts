import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  Ui2BigTitleComponent,
  Ui2EmptyStateComponent,
  Ui2SearchBoxComponent,
  Ui2SectionLabelComponent,
} from '../../../../shared/ui-v2';
import { ChatRowComponent } from '../../components/chat-row/chat-row.component';
import { MensajesService } from '../../data-access/mensajes.service';

@Component({
  selector: 'app-mensajes-inbox',
  standalone: true,
  imports: [
    Ui2BigTitleComponent,
    Ui2EmptyStateComponent,
    Ui2SearchBoxComponent,
    Ui2SectionLabelComponent,
    ChatRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-inbox.component.html',
  styleUrl: './mensajes-inbox.component.css',
})
export class MensajesInboxComponent {
  protected mensajes = inject(MensajesService);

  readonly mobile = input<boolean>(false);
  readonly conversationSelect = output<string>();

  readonly conversaciones = this.mensajes.filteredConversations;
  readonly totalUnread = this.mensajes.totalUnread;
  readonly searchTerm = this.mensajes.searchTerm;

  readonly subtitle = computed(() => {
    const total = this.totalUnread();
    return total === 0 ? 'Al día' : `${total} ${total === 1 ? 'nuevo' : 'nuevos'}`;
  });

  readonly heroOverline = 'MENSAJES';

  readonly heroTitle = computed(() => {
    const total = this.totalUnread();
    return total === 0 ? 'Al día' : `${total} ${total === 1 ? 'nuevo' : 'nuevos'}`;
  });

  onSearchChange(term: string): void {
    this.mensajes.setSearchTerm(term);
  }

  onSelect(id: string): void {
    this.conversationSelect.emit(id);
  }
}
