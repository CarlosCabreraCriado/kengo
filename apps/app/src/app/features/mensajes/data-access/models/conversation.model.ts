import type { Ui2AvatarGradient } from '../../../../shared/ui-v2';

export interface PatientStats {
  adherence: number;
  lastPainScale: number;
  activePlan: string;
  age: number;
}

export interface Conversation {
  id: string;
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
  patientStats?: PatientStats;
}
