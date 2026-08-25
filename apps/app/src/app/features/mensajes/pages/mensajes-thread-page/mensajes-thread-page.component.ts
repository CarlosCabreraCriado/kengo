import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ClinicaActivaService, SessionService, SubscriptionService } from '../../../../core';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { useResponsive } from '../../../../shared/composables/use-responsive';
import { ChatClinicBlockComponent } from '../../components/chat-clinic-block/chat-clinic-block.component';
import { ChatComposerComponent } from '../../components/chat-composer/chat-composer.component';
import { ChatHeaderComponent } from '../../components/chat-header/chat-header.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { Ui2ButtonComponent } from '../../../../shared/ui-v2';
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
    Ui2ButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes-thread-page.component.html',
  styleUrl: './mensajes-thread-page.component.css',
})
export class MensajesThreadPageComponent implements OnInit, OnDestroy {
  protected mensajes = inject(MensajesService);
  protected session = inject(SessionService);
  private subs = inject(SubscriptionService);
  private router = inject(Router);
  private push = inject(PushNotificationService);
  private clinicaActiva = inject(ClinicaActivaService);
  private clinicasService = inject(ClinicasService);
  private toast = inject(ToastService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'mensajes-thread';

  /** Lista la página cuando la query de conversaciones del servicio ha
   *  resuelto (con éxito o vacío). El servicio expone `isLoading` derivado
   *  del watchQuery de `listMyConversations`. */
  readonly pageReady = computed(() => !this.mensajes.isLoading());

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
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
    void this.push.clearBadge();
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
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

  /**
   * El fisio de este hilo no es mi responsable en esta clínica.
   * `conversations.fisioId` se congela al crear el hilo, así que tras una
   * reasignación el hilo antiguo sigue arriba de la bandeja: sin este aviso el
   * paciente sigue escribiendo a la cuenta anterior sin saberlo.
   */
  protected readonly noEsMiResponsable = computed(
    () => this.conversation()?.otherIsMyResponsable === false,
  );

  protected readonly abriendoHiloActual = signal(false);

  protected readonly mostrarStats = computed(
    () => !!this.conversation()?.iAmFisio && !this.bloqueadoPorClinica(),
  );

  /**
   * Rol del *otro* participante, derivado del rol real en la conversación
   * (`iAmFisio`) y no del modo activo de sesión: un fisio con
   * `tambienEsPaciente` puede estar en un chat donde él es el paciente.
   */
  protected readonly participantRole = computed<'fisio' | 'paciente'>(() =>
    this.conversation()?.iAmFisio ? 'paciente' : 'fisio',
  );

  /**
   * El acceso a la ficha exige ambas cosas: ser el fisio de esta conversación
   * y estar en modo fisio — `FisioGuard` redirige a `/inicio` a quien esté en
   * modo paciente.
   */
  protected readonly puedeVerFicha = computed(
    () => !!this.conversation()?.iAmFisio && this.session.puedeGestionarPacientes(),
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

  /**
   * `participantId` ya es el `Id<'users'>` del paciente, que es justo lo que
   * espera `/mis-pacientes/:id`: no hace falta ninguna query previa. Si la
   * conversación es de otra clínica, `clinicaActivaResourceGuard('paciente')`
   * conmuta la clínica activa durante la navegación.
   */
  onVerPaciente(): void {
    const conv = this.conversation();
    if (!conv) return;
    this.router.navigate(['/mis-pacientes', conv.participantId]);
  }

  onSend(text: string): void {
    this.mensajes.sendMessage(text);
  }

  /**
   * Lleva al hilo del responsable actual. La mutation resuelve el fisio en
   * servidor contra `assignments` y es idempotente: devuelve el hilo existente
   * si ya lo hay, o lo crea si es la primera vez.
   */
  async onIrAFisioActual(): Promise<void> {
    if (this.abriendoHiloActual()) return;
    this.abriendoHiloActual.set(true);
    try {
      const id = await this.mensajes.startConversationWithFisio();
      if (id) {
        this.router.navigate(['/mensajes', id]);
        return;
      }
      this.toast.info(
        'Todavía no tienes un fisio responsable asignado en esta clínica.',
      );
    } finally {
      this.abriendoHiloActual.set(false);
    }
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
