export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  readAt?: string;
}

export type ThreadItem =
  | { kind: 'message'; message: Message }
  | { kind: 'day'; label: string };
