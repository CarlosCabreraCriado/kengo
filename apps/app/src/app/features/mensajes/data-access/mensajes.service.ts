import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core';
import { ConvexService } from '../../../core/convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../convex/_generated/dataModel';
import type { Ui2AvatarGradient } from '../../../shared/ui-v2';
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

const AVATAR_GRADIENTS: Ui2AvatarGradient[] = [
  'indigo',
  'coral',
  'amber',
  'green',
];

function gradientFor(seed: string): Ui2AvatarGradient {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function initialsFor(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  const initials = `${a}${b}`.toUpperCase();
  return initials || '?';
}

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

interface RawConversation {
  _id: string;
  _creationTime: number;
  clinicId: string;
  otherUserId: string;
  otherFirstName: string;
  otherLastName: string;
  otherAvatar: string | null;
  lastMessageText: string | null;
  lastMessageAt: number | null;
  lastMessageSenderId: string | null;
  myUnreadCount: number;
  iAmFisio: boolean;
  patientStats: {
    adherence: number;
    lastPainScale: number;
    activePlan: string;
    age: number;
  } | null;
}

interface RawMessage {
  _id: string;
  _creationTime: number;
  conversationId: string;
  senderId: string;
  text: string;
  readAt: number | null;
}

@Injectable({ providedIn: 'root' })
export class MensajesService {
  private session = inject(SessionService);
  private convex = inject(ConvexService);

  private readonly _activeConversationId = signal<string | null>(null);
  private readonly _searchTerm = signal<string>('');
  private readonly _autoStartAttempted = signal<boolean>(false);

  private readonly conversationsQuery = this.convex.watchQuery(
    api.conversations.queries.listMyConversations,
    () => ({}),
  );

  private readonly messagesQuery = this.convex.watchQuery(
    api.conversations.queries.listMessages,
    () => {
      const id = this._activeConversationId();
      return id ? { conversationId: id as Id<'conversations'> } : 'skip';
    },
  );

  private readonly meId = computed(() => this.session.usuario()?.convexId ?? '');

  readonly isLoading = computed(() => this.conversationsQuery.isLoading());
  readonly error = computed(() => this.conversationsQuery.error());

  readonly conversations = computed<Conversation[]>(() => {
    const raw = (this.conversationsQuery.value() ?? []) as RawConversation[];
    const me = this.meId();
    return raw.map((r) => this.mapConversation(r, me));
  });

  readonly activeConversationId = this._activeConversationId.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();
  readonly autoStartAttempted = this._autoStartAttempted.asReadonly();

  readonly activeConversation = computed<Conversation | null>(() => {
    const id = this._activeConversationId();
    if (!id) return null;
    return this.conversations().find((c) => c.id === id) ?? null;
  });

  readonly filteredConversations = computed<Conversation[]>(() => {
    const term = this._searchTerm().trim().toLowerCase();
    const list = this.conversations();
    if (!term) return list;
    return list.filter((c) => c.participantName.toLowerCase().includes(term));
  });

  readonly totalUnread = computed(() =>
    this.conversations().reduce((acc, c) => acc + c.unreadCount, 0),
  );

  readonly messages = computed<ThreadItem[]>(() => {
    const id = this._activeConversationId();
    if (!id) return [];
    const raw = (this.messagesQuery.value() ?? []) as RawMessage[];
    if (raw.length === 0) return [];

    const today = new Date();
    const items: ThreadItem[] = [];
    let lastDayKey = '';
    for (const r of raw) {
      const date = new Date(r._creationTime);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (key !== lastDayKey) {
        items.push({ kind: 'day', label: dayLabel(date, today) });
        lastDayKey = key;
      }
      items.push({ kind: 'message', message: this.mapMessage(r) });
    }
    return items;
  });

  selectConversation(id: string | null): void {
    this._activeConversationId.set(id);
    if (id) {
      this.markAsRead(id).catch((err) =>
        console.error('Error al marcar como leído:', err),
      );
    }
  }

  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
  }

  clearSearch(): void {
    this._searchTerm.set('');
  }

  async sendMessage(text: string): Promise<void> {
    const id = this._activeConversationId();
    const trimmed = text.trim();
    if (!id || !trimmed) return;

    try {
      await this.convex.mutation(api.conversations.mutations.sendMessage, {
        conversationId: id as Id<'conversations'>,
        text: trimmed,
      });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      throw err;
    }
  }

  async markAsRead(conversationId: string): Promise<void> {
    await this.convex.mutation(api.conversations.mutations.markAsRead, {
      conversationId: conversationId as Id<'conversations'>,
    });
  }

  async startConversationWithFisio(): Promise<string | null> {
    if (this._autoStartAttempted()) return null;
    this._autoStartAttempted.set(true);
    try {
      const id = await this.convex.mutation(
        api.conversations.mutations.startConversationWithFisio,
        {},
      );
      return id ? (id as unknown as string) : null;
    } catch (err) {
      console.error('Error al iniciar conversación con fisio:', err);
      return null;
    }
  }

  async startConversationWithPatient(
    pacienteId: string,
    clinicId?: string,
  ): Promise<string | null> {
    try {
      const args: { pacienteId: Id<'users'>; clinicId?: Id<'clinics'> } = {
        pacienteId: pacienteId as Id<'users'>,
      };
      if (clinicId) args.clinicId = clinicId as Id<'clinics'>;
      const id = await this.convex.mutation(
        api.conversations.mutations.startConversationWithPatient,
        args,
      );
      return id ? (id as unknown as string) : null;
    } catch (err) {
      console.error('Error al iniciar conversación con paciente:', err);
      return null;
    }
  }

  isFromMe(message: Message): boolean {
    return message.senderId === this.meId();
  }

  formatHour(timestamp: string): string {
    return TIME_FORMATTER.format(new Date(timestamp));
  }

  formatRelativeDay(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (isSameDay(date, now)) return TIME_FORMATTER.format(date);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) return 'Ayer';
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date);
    }
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  }

  private mapConversation(raw: RawConversation, meId: string): Conversation {
    const fullName = `${raw.otherFirstName} ${raw.otherLastName}`.trim();
    const timestamp = raw.lastMessageAt
      ? new Date(raw.lastMessageAt).toISOString()
      : new Date(raw._creationTime).toISOString();

    return {
      id: raw._id,
      participantId: raw.otherUserId,
      participantName: fullName || 'Sin nombre',
      participantInitial: initialsFor(raw.otherFirstName, raw.otherLastName),
      participantGradient: gradientFor(raw.otherUserId),
      participantOnline: false,
      participantLastSeen: undefined,
      lastMessage: {
        text: raw.lastMessageText ?? '',
        timestamp,
        fromMe: raw.lastMessageSenderId === meId,
        read: raw.myUnreadCount === 0,
      },
      unreadCount: raw.myUnreadCount,
      patientStats: raw.patientStats ?? undefined,
    };
  }

  private mapMessage(raw: RawMessage): Message {
    return {
      id: raw._id,
      conversationId: raw.conversationId,
      senderId: raw.senderId,
      text: raw.text,
      timestamp: new Date(raw._creationTime).toISOString(),
      readAt: raw.readAt ? new Date(raw.readAt).toISOString() : undefined,
    };
  }

}
