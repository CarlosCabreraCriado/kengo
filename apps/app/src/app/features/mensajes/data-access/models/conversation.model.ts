import type { Ui2AvatarGradient } from '../../../../shared/ui-v2';

export interface PatientStats {
  adherence: number;
  lastPainScale: number;
  activePlan: string;
  age: number;
}

export interface Conversation {
  id: string;
  /**
   * `Id<'users'>` del otro participante. Cuando `iAmFisio` es `true` es el
   * pacienteId, y sirve tal cual para navegar a `/mis-pacientes/:id`.
   */
  participantId: string;
  participantName: string;
  participantInitial: string;
  participantGradient: Ui2AvatarGradient;
  participantOnline: boolean;
  participantLastSeen?: string;
  clinicId: string;
  clinicName: string | null;
  isActiveClinic: boolean;
  lastMessage: {
    text: string;
    timestamp: string;
    fromMe: boolean;
    read: boolean;
  };
  unreadCount: number;
  /**
   * Rol real del usuario actual *en esta conversación*, tal y como lo resuelve
   * Convex. No confundir con `SessionService.enModoFisio()`, que es el modo
   * activo del toggle: un fisio con `tambienEsPaciente` puede tener chats en
   * los que él es el paciente.
   */
  iAmFisio: boolean;
  patientStats?: PatientStats;
}
