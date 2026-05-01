import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core';
import {
  FISIO_CONVERSATIONS,
  FISIO_MESSAGES_BY_CONV,
  ME_ID,
  PATIENT_CONVERSATIONS,
  PATIENT_MESSAGES_BY_CONV,
} from './mocks/mensajes.mocks';
import type { Conversation } from './models/conversation.model';
import type { Message, ThreadItem } from './models/message.model';

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(date: Date, today: Date): string {
  if (isSameDay(date, today)) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Ayer';
  const raw = DAY_LABEL_FORMATTER.format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

@Injectable({ providedIn: 'root' })
export class MensajesService {
  private session = inject(SessionService);

  private readonly _conversations = signal<Conversation[]>(this.initialConversations());
  private readonly _messagesByConversation = signal<Record<string, Message[]>>(
    this.initialMessages(),
  );
  private readonly _activeConversationId = signal<string | null>(null);
  private readonly _searchTerm = signal<string>('');

  readonly conversations = computed(() =>
    [...this._conversations()].sort(
      (a, b) =>
        new Date(b.lastMessage.timestamp).getTime() -
        new Date(a.lastMessage.timestamp).getTime(),
    ),
  );

  readonly activeConversationId = this._activeConversationId.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();

  readonly activeConversation = computed<Conversation | null>(() => {
    const id = this._activeConversationId();
    if (!id) return null;
    return this._conversations().find((c) => c.id === id) ?? null;
  });

  readonly filteredConversations = computed<Conversation[]>(() => {
    const term = this._searchTerm().trim().toLowerCase();
    const list = this.conversations();
    if (!term) return list;
    return list.filter((c) => c.participantName.toLowerCase().includes(term));
  });

  readonly totalUnread = computed(() =>
    this._conversations().reduce((acc, c) => acc + c.unreadCount, 0),
  );

  readonly messages = computed<ThreadItem[]>(() => {
    const id = this._activeConversationId();
    if (!id) return [];
    const raw = this._messagesByConversation()[id] ?? [];
    if (raw.length === 0) return [];

    const sorted = [...raw].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const today = new Date();
    const items: ThreadItem[] = [];
    let lastDayKey = '';
    for (const m of sorted) {
      const date = new Date(m.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (key !== lastDayKey) {
        items.push({ kind: 'day', label: dayLabel(date, today) });
        lastDayKey = key;
      }
      items.push({ kind: 'message', message: m });
    }
    return items;
  });

  selectConversation(id: string | null): void {
    this._activeConversationId.set(id);
    if (id) this.markAsRead(id);
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  clearSearch(): void {
    this._searchTerm.set('');
  }

  sendMessage(text: string): void {
    const id = this._activeConversationId();
    const trimmed = text.trim();
    if (!id || !trimmed) return;

    const now = new Date().toISOString();
    const newMessage: Message = {
      id: `${id}-${Date.now()}`,
      conversationId: id,
      senderId: ME_ID,
      text: trimmed,
      timestamp: now,
      readAt: undefined,
    };

    this._messagesByConversation.update((map) => ({
      ...map,
      [id]: [...(map[id] ?? []), newMessage],
    }));

    this._conversations.update((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              lastMessage: {
                text: trimmed,
                timestamp: now,
                fromMe: true,
                read: false,
              },
              unreadCount: 0,
            }
          : c,
      ),
    );
  }

  markAsRead(conversationId: string): void {
    this._conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }

  isFromMe(message: Message): boolean {
    return message.senderId === ME_ID;
  }

  formatHour(timestamp: string): string {
    return TIME_FORMATTER.format(new Date(timestamp));
  }

  formatRelativeDay(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    if (isSameDay(date, now)) return TIME_FORMATTER.format(date);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) return 'Ayer';
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
  }

  private initialConversations(): Conversation[] {
    return this.session.enModoFisio() ? [...FISIO_CONVERSATIONS] : [...PATIENT_CONVERSATIONS];
  }

  private initialMessages(): Record<string, Message[]> {
    const source = this.session.enModoFisio() ? FISIO_MESSAGES_BY_CONV : PATIENT_MESSAGES_BY_CONV;
    return Object.fromEntries(
      Object.entries(source).map(([id, msgs]) => [id, [...msgs]]),
    );
  }
}
