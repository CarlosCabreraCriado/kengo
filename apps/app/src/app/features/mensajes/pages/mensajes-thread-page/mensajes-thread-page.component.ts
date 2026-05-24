import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../../core';
import { useResponsive } from '../../../../shared/composables/use-responsive';
import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { MensajesService } from '../../data-access/mensajes.service';
import { PushNotificationService } from '../../../../core/services/push-notification.service';

@Component({
  selector: 'app-mensajes-thread-page',
  standalone: true,
  imports: [ChatComposerComponent, ChatHeaderComponent, ChatThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-thread-page.component.html',
  styleUrl: './mensajes-thread-page.component.css',
})
export class MensajesThreadPageComponent implements OnInit {
  protected mensajes = inject(MensajesService);
  protected session = inject(SessionService);
  private router = inject(Router);
  private push = inject(PushNotificationService);

  ngOnInit(): void {
    void this.push.clearBadge();
  }

  private readonly responsive = useResponsive();
  protected readonly esDesktop = this.responsive.esDesktop;

  protected readonly conversation = this.mensajes.activeConversation;
  protected readonly items = this.mensajes.messages;

  protected readonly mostrarStats = computed(() => this.session.enModoFisio());

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
}
