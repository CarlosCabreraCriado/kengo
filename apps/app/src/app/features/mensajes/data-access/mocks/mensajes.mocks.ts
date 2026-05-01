import type { Conversation } from '../models/conversation.model';
import type { Message } from '../models/message.model';

export const ME_ID = 'me';

export const FISIO_CONVERSATIONS: Conversation[] = [
  {
    id: 'laura',
    participantId: 'laura',
    participantName: 'Laura Martínez',
    participantInitial: 'LM',
    participantGradient: 'indigo',
    participantOnline: true,
    lastMessage: {
      text: 'Tú: Hoy céntrate en la calidad del movimiento.',
      timestamp: '2026-04-28T10:02:00',
      fromMe: true,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 92, lastPainScale: 3, activePlan: 'Plan hombro · Sem. 3', age: 34 },
  },
  {
    id: 'marcos',
    participantId: 'marcos',
    participantName: 'Marcos Vidal',
    participantInitial: 'MV',
    participantGradient: 'green',
    participantOnline: true,
    lastMessage: {
      text: 'Ayer noté un pinchazo al subir escaleras. ¿Es normal?',
      timestamp: '2026-04-28T09:48:00',
      fromMe: false,
      read: false,
    },
    unreadCount: 2,
    patientStats: { adherence: 78, lastPainScale: 5, activePlan: 'Plan rodilla · Sem. 2', age: 28 },
  },
  {
    id: 'ana',
    participantId: 'ana',
    participantName: 'Ana Ruiz',
    participantInitial: 'AR',
    participantGradient: 'amber',
    participantOnline: false,
    lastMessage: {
      text: 'Mañana voy a la sesión presencial, ¿llevo algo?',
      timestamp: '2026-04-28T09:14:00',
      fromMe: false,
      read: false,
    },
    unreadCount: 1,
    patientStats: { adherence: 85, lastPainScale: 2, activePlan: 'Plan lumbar · Sem. 4', age: 41 },
  },
  {
    id: 'elena',
    participantId: 'elena',
    participantName: 'Elena Ortiz',
    participantInitial: 'EO',
    participantGradient: 'coral',
    participantOnline: true,
    lastMessage: {
      text: 'Acabo la sesión y os cuento, gracias 💪',
      timestamp: '2026-04-28T08:55:00',
      fromMe: false,
      read: false,
    },
    unreadCount: 1,
    patientStats: { adherence: 88, lastPainScale: 4, activePlan: 'Plan cervical · Sem. 1', age: 52 },
  },
  {
    id: 'javier',
    participantId: 'javier',
    participantName: 'Javier Pino',
    participantInitial: 'JP',
    participantGradient: 'green',
    participantOnline: false,
    lastMessage: {
      text: 'Tú: Recuerda calentar 5 min antes.',
      timestamp: '2026-04-27T19:20:00',
      fromMe: true,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 70, lastPainScale: 6, activePlan: 'Plan hombro · Sem. 2', age: 38 },
  },
  {
    id: 'pablo',
    participantId: 'pablo',
    participantName: 'Pablo Gómez',
    participantInitial: 'PG',
    participantGradient: 'indigo',
    participantOnline: false,
    lastMessage: {
      text: 'Tú: Te paso el ejercicio de hoy.',
      timestamp: '2026-04-27T17:05:00',
      fromMe: true,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 95, lastPainScale: 1, activePlan: 'Plan rodilla · Sem. 6', age: 45 },
  },
  {
    id: 'marta',
    participantId: 'marta',
    participantName: 'Marta Lago',
    participantInitial: 'ML',
    participantGradient: 'amber',
    participantOnline: false,
    lastMessage: {
      text: 'Hoy lo he dado todo, dolor 4/10 al final.',
      timestamp: '2026-04-27T16:42:00',
      fromMe: false,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 82, lastPainScale: 4, activePlan: 'Plan tobillo · Sem. 2', age: 30 },
  },
  {
    id: 'sofia',
    participantId: 'sofia',
    participantName: 'Sofía Castro',
    participantInitial: 'SC',
    participantGradient: 'coral',
    participantOnline: false,
    lastMessage: {
      text: '¿Cuándo es la próxima revisión?',
      timestamp: '2026-04-27T11:18:00',
      fromMe: false,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 76, lastPainScale: 3, activePlan: 'Plan lumbar · Sem. 5', age: 47 },
  },
  {
    id: 'diego',
    participantId: 'diego',
    participantName: 'Diego Salas',
    participantInitial: 'DS',
    participantGradient: 'green',
    participantOnline: false,
    lastMessage: {
      text: 'Tú: Nos vemos mañana a las 10.',
      timestamp: '2026-04-26T20:00:00',
      fromMe: true,
      read: true,
    },
    unreadCount: 0,
    patientStats: { adherence: 90, lastPainScale: 2, activePlan: 'Plan hombro · Sem. 4', age: 36 },
  },
];

export const PATIENT_CONVERSATIONS: Conversation[] = [
  {
    id: 'mi-fisio',
    participantId: 'fisio-carlos',
    participantName: 'Carlos Cabrera',
    participantInitial: 'CC',
    participantGradient: 'coral',
    participantOnline: true,
    lastMessage: {
      text: '¿Qué tal la sesión de ayer? Acuérdate de la respiración.',
      timestamp: '2026-04-28T09:08:00',
      fromMe: false,
      read: false,
    },
    unreadCount: 1,
  },
];

export const FISIO_MESSAGES_BY_CONV: Record<string, Message[]> = {
  laura: [
    { id: 'l1', conversationId: 'laura', senderId: 'laura',  text: 'Buenos días ☀️ ¿Qué tal la sesión de ayer?',                                  timestamp: '2026-04-27T09:08:00' },
    { id: 'l2', conversationId: 'laura', senderId: ME_ID,    text: 'Muy bien ayer, Laura 👏. Hoy céntrate en la calidad del movimiento, no la velocidad.', timestamp: '2026-04-27T09:12:00', readAt: '2026-04-27T09:13:00' },
    { id: 'l3', conversationId: 'laura', senderId: 'laura',  text: 'Vale, lo tengo. ¿Cuántas series me apuntáis hoy?',                              timestamp: '2026-04-27T09:18:00' },
    { id: 'l4', conversationId: 'laura', senderId: ME_ID,    text: '3 × 12 con descanso de 45 s entre series. Si te quedas con margen, sube a 15.', timestamp: '2026-04-27T09:20:00', readAt: '2026-04-27T09:21:00' },
    { id: 'l5', conversationId: 'laura', senderId: 'laura',  text: '👌 anotado.',                                                                     timestamp: '2026-04-27T09:21:00' },
    { id: 'l6', conversationId: 'laura', senderId: ME_ID,    text: '¡Ah! y recuerda fotografiar la técnica como la semana pasada.',                  timestamp: '2026-04-27T09:24:00', readAt: '2026-04-27T09:30:00' },
    { id: 'l7', conversationId: 'laura', senderId: 'laura',  text: 'Hecho, todo perfecto. Ya he terminado la sesión.',                              timestamp: '2026-04-28T09:55:00' },
    { id: 'l8', conversationId: 'laura', senderId: 'laura',  text: 'Hoy he sentido el hombro mucho más estable, ¡me ha encantado!',                 timestamp: '2026-04-28T09:57:00' },
    { id: 'l9', conversationId: 'laura', senderId: ME_ID,    text: 'Genial Laura. Mañana cambiamos un poco la rutina.',                             timestamp: '2026-04-28T10:00:00', readAt: '2026-04-28T10:01:00' },
    { id: 'l10', conversationId: 'laura', senderId: ME_ID,   text: 'Hoy céntrate en la calidad del movimiento.',                                    timestamp: '2026-04-28T10:02:00', readAt: '2026-04-28T10:02:30' },
  ],
  marcos: [
    { id: 'm1', conversationId: 'marcos', senderId: 'marcos', text: 'Hola, ayer noté un pinchazo al subir escaleras.',  timestamp: '2026-04-28T09:46:00' },
    { id: 'm2', conversationId: 'marcos', senderId: 'marcos', text: '¿Es normal? Tengo la sesión esta tarde.',           timestamp: '2026-04-28T09:48:00' },
  ],
  ana: [
    { id: 'a1', conversationId: 'ana', senderId: 'ana', text: 'Mañana voy a la sesión presencial, ¿llevo algo?', timestamp: '2026-04-28T09:14:00' },
  ],
  elena: [
    { id: 'e1', conversationId: 'elena', senderId: 'elena', text: 'Acabo la sesión y os cuento, gracias 💪', timestamp: '2026-04-28T08:55:00' },
  ],
  javier: [
    { id: 'j1', conversationId: 'javier', senderId: ME_ID,   text: 'Recuerda calentar 5 min antes.', timestamp: '2026-04-27T19:20:00', readAt: '2026-04-27T19:25:00' },
  ],
  pablo: [
    { id: 'p1', conversationId: 'pablo', senderId: ME_ID, text: 'Te paso el ejercicio de hoy.', timestamp: '2026-04-27T17:05:00', readAt: '2026-04-27T17:30:00' },
  ],
  marta: [
    { id: 'mt1', conversationId: 'marta', senderId: 'marta', text: 'Hoy lo he dado todo, dolor 4/10 al final.', timestamp: '2026-04-27T16:42:00' },
  ],
  sofia: [
    { id: 's1', conversationId: 'sofia', senderId: 'sofia', text: '¿Cuándo es la próxima revisión?', timestamp: '2026-04-27T11:18:00' },
  ],
  diego: [
    { id: 'd1', conversationId: 'diego', senderId: ME_ID, text: 'Nos vemos mañana a las 10.', timestamp: '2026-04-26T20:00:00', readAt: '2026-04-26T20:05:00' },
  ],
};

export const PATIENT_MESSAGES_BY_CONV: Record<string, Message[]> = {
  'mi-fisio': [
    { id: 'pf1', conversationId: 'mi-fisio', senderId: 'fisio-carlos', text: 'Buenos días ☀️ ¿Qué tal la sesión de ayer?',                              timestamp: '2026-04-27T09:08:00' },
    { id: 'pf2', conversationId: 'mi-fisio', senderId: ME_ID,           text: 'Muy bien, terminé las 3 series sin dolor.',                              timestamp: '2026-04-27T09:30:00', readAt: '2026-04-27T09:35:00' },
    { id: 'pf3', conversationId: 'mi-fisio', senderId: 'fisio-carlos', text: '¡Genial! Hoy vamos a centrarnos en la calidad del movimiento.',          timestamp: '2026-04-27T09:36:00' },
    { id: 'pf4', conversationId: 'mi-fisio', senderId: ME_ID,           text: 'Perfecto, lo intento esta tarde y te cuento.',                          timestamp: '2026-04-27T09:40:00', readAt: '2026-04-27T09:41:00' },
    { id: 'pf5', conversationId: 'mi-fisio', senderId: 'fisio-carlos', text: '¿Qué tal la sesión de ayer? Acuérdate de la respiración.',              timestamp: '2026-04-28T09:08:00' },
  ],
};
