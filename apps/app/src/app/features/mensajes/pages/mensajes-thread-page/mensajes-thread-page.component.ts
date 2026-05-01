import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../../core';
import { useResponsive } from '../../../../shared/composables/use-responsive';
import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { MensajesService } from '../../data-access/mensajes.service';

@Component({
  selector: 'app-mensajes-thread-page',
  standalone: true,
  imports: [ChatComposerComponent, ChatHeaderComponent, ChatThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-thread-page.component.html',
  styleUrl: './mensajes-thread-page.component.css',
})
export class MensajesThreadPageComponent {
  protected mensajes = inject(MensajesService);
  protected session = inject(SessionService);
  private router = inject(Router);

  private readonly responsive = useResponsive();
  protected readonly esDesktop = this.responsive.esDesktop;

  protected readonly conversation = this.mensajes.activeConversation;
  protected readonly items = this.mensajes.messages;

  protected readonly mostrarStats = computed(() => this.session.enModoFisio());

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

  onOpenProfile(): void {
    // placeholder — perfil del paciente no está implementado en esta fase mockup.
  }
}
