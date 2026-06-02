import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ClinicaActivaService, SessionService, SubscriptionService } from '../../../../core';
import { useResponsive } from '../../../../shared/composables/use-responsive';
import { ChatClinicBlockComponent } from '../../components/chat-clinic-block/chat-clinic-block.component';
import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { MensajesService } from '../../data-access/mensajes.service';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';

@Component({
  selector: 'app-mensajes-thread-page',
  standalone: true,
  imports: [
    ChatClinicBlockComponent,
    ChatComposerComponent,
    ChatHeaderComponent,
    ChatThreadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-thread-page.component.html',
  styleUrl: './mensajes-thread-page.component.css',
})
export class MensajesThreadPageComponent implements OnInit {
  protected mensajes = inject(MensajesService);
  protected session = inject(SessionService);
  private subs = inject(SubscriptionService);
  private router = inject(Router);
  private push = inject(PushNotificationService);
  private clinicaActiva = inject(ClinicaActivaService);
  private clinicasService = inject(ClinicasService);
  private toast = inject(ToastService);

  /**
   * Bloquea el composer cuando el usuario en modo fisio no tiene suscripción
   * activa. Los pacientes pueden enviar mensajes siempre.
   */
  protected readonly bloqueoComposer = computed(
    () => this.session.enModoFisio() && this.subs.bloqueada(),
  );

  protected readonly composerPlaceholder = computed(() => {
    if (this.bloqueoComposer()) return 'Tu suscripción no está activa';
    return this.placeholder();
  });

  ngOnInit(): void {
    void this.push.clearBadge();
  }

  private readonly responsive = useResponsive();
  protected readonly esDesktop = this.responsive.esDesktop;

  protected readonly conversation = this.mensajes.activeConversation;
  protected readonly items = this.mensajes.messages;

  /**
   * `true` cuando la conversación activa pertenece a una clínica distinta
   * a la activa: oculta thread + composer y muestra la pantalla de bloqueo
   * con CTA para cambiar de clínica. La regla aplica tanto a fisios como
   * a pacientes multiclinica.
   */
  protected readonly bloqueadoPorClinica = this.mensajes.isActiveConversationBlocked;

  protected readonly mostrarStats = computed(
    () => this.session.enModoFisio() && !this.bloqueadoPorClinica(),
  );

  protected readonly participantRole = computed<'fisio' | 'paciente'>(() =>
    this.session.enModoFisio() ? 'paciente' : 'fisio',
  );

  protected readonly placeholder = computed(() => {
    const conv = this.conversation();
    if (!conv) return 'Escribe un mensaje…';
    const firstName = conv.participantName.split(' ')[0] ?? conv.participantName;
    return `Mensaje a ${firstName}…`;
  });

  onBack(): void {
    this.mensajes.selectConversation(null);
    this.router.navigate(['/mensajes']);
  }

  onSend(text: string): void {
    this.mensajes.sendMessage(text);
  }

  onSwitchToClinic(): void {
    const conv = this.conversation();
    if (!conv) return;
    const idsDisponibles = this.clinicasService.idsClinicasCargadas();
    if (idsDisponibles.length > 0 && !idsDisponibles.includes(conv.clinicId)) {
      this.toast.warning('Ya no perteneces a esta clínica');
      return;
    }
    this.clinicaActiva.set(conv.clinicId);
  }
}
