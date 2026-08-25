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
  /**
   * Solo significativo cuando `iAmFisio` es `false`: indica si el fisio de este
   * hilo sigue siendo mi responsable en esa clínica. `null` = no aplica (soy yo
   * el fisio). Es `false` tanto si el responsable cambió como si me quedé sin
   * responsable: `conversations.fisioId` se congela al crear el hilo y ningún
   * flujo lo reencamina al reasignar.
   */
  otherIsMyResponsable: boolean | null;
  patientStats?: PatientStats;
}
