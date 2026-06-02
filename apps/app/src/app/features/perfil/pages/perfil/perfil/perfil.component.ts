import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
  effect,
  DestroyRef,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { assetUrl } from '../../../../../core/utils/asset-url';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

// Servicios
import { SessionService } from '../../../../../core/auth/services/session.service';
import { EmailVerificationService } from '../../../../../core/auth/services/email-verification.service';
import { ConvexService } from '../../../../../core/convex/convex.service';
import { StorageService } from '../../../../../core/services/storage.service';
import { DialogService } from '../../../../../shared/services/dialog';

// Types
import { Usuario } from '../../../../../../types/global';

import { api } from '../../../../../../../../../convex/_generated/api';
import { environment as env } from '../../../../../../environments/environment';
import {
  useResponsive,
  emailRequired,
  passwordRequired,
  postalCodeOptional,
} from '../../../../../shared';

// V2 components
import {
  Ui2AvatarComponent,
  Ui2BigTitleComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2IconBadgeComponent,
  Ui2InputComponent,
  Ui2PillComponent,
  Ui2SectionComponent,
  Ui2SpinnerComponent,
  Ui2ToggleRowComponent,
} from '../../../../../shared/ui-v2';
import { PageLoaderService } from '../../../../../core/services/page-loader.service';
import { LoggerService } from '../../../../../core/services/logger.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2AvatarComponent,
    Ui2BigTitleComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
    Ui2IconBadgeComponent,
    Ui2InputComponent,
    Ui2PillComponent,
    Ui2SectionComponent,
    Ui2SpinnerComponent,
    Ui2ToggleRowComponent,
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private emailVerificationService = inject(EmailVerificationService);
  private convex = inject(ConvexService);
  private storage = inject(StorageService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private pageLoader = inject(PageLoaderService);
  private dialogService = inject(DialogService);
  private logger = inject(LoggerService);
  private readonly PAGE_LOADER_KEY = 'perfil';

  /** Datos críticos: usuario disponible. */
  readonly pageReady = computed(() => this.sessionService.usuario() !== null);

  isMobile = useResponsive().esMobile;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // === SECTION TOGGLE STATES ===
  public personalExpanded = signal(true);
  public securityExpanded = signal(false);
  public notificacionesExpanded = signal(false);
  public legalExpanded = signal(false);

  // === PREFERENCIAS DE NOTIFICACIÓN ===
  private readonly notifPrefsQuery = this.convex.watchQuery(
    api.notificationPreferences.queries.getMyPreferences,
    () => ({}),
  );
  public readonly notifPrefs = this.notifPrefsQuery.value;
  public readonly notifPrefsLoading = this.notifPrefsQuery.isLoading;

  // === EMAIL VERIFICATION ===
  public emailVerified = computed(() => this.sessionService.usuario()?.email_verified ?? false);
  public showVerificationPanel = signal(false);
  public verificationCode = signal('');
  public sendingCode = signal(false);
  public verifyingCode = signal(false);
  public verificationMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  public codeSent = signal(false);

  @ViewChild('personalSection') personalSection!: ElementRef<HTMLElement>;
  @ViewChild('securitySection') securitySection!: ElementRef<HTMLElement>;

  // === DATOS PERSONALES ===
  public usuario = computed(() => this.sessionService.usuario());
  public tieneCapacidadFisio = this.sessionService.tieneCapacidadFisio;

  public url_perfil = computed(() => {
    const id_avatar = this.usuario()?.avatar;
    return id_avatar
      ? `${assetUrl(id_avatar, { fit: 'cover' })}`
      : null;
  });

  public nombreCompleto = computed(() => {
    const u = this.usuario();
    return `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
  });

  public formularioCambiado = signal(false);
  public formularioInicializado = signal(false);
  readonly subiendoAvatar = signal(false);
  readonly previewUrl = signal<string | null>(null);

  private cleanupPreview = effect(() => {
    const url = this.previewUrl();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  public formularioUsuario = this.fb.group({
    first_name: ['', [Validators.required]],
    last_name: ['', [Validators.required]],
    email: [{ value: '', disabled: true }, emailRequired],
    telefono: [{ value: '', disabled: false }, []],
    postal: ['', postalCodeOptional],
    direccion: ['', []],
    numero_colegiado: [''],
  });

  private effectoCargaInicial = effect(() => {
    if (this.usuario() != null && !this.formularioInicializado()) {
      this.cargarFormulario(this.usuario() as Usuario);
      this.formularioInicializado.set(true);
      this.effectoCargaInicial.destroy();
    }
  });

  // === SEGURIDAD (Cambio de contraseña) ===
  public cambiandoPassword = signal(false);

  public formularioPassword = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', passwordRequired()],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit() {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
    this.formularioUsuario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formularioCambiado.set(true);
      });
  }

  ngOnDestroy() {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // === MÉTODOS DE DATOS PERSONALES ===

  cargarFormulario(usuario: Usuario) {
    this.formularioUsuario.patchValue(usuario, { emitEvent: false });
  }

  errorPara(campo: string): string | null {
    const control = this.formularioUsuario.get(campo);
    if (!control || control.disabled) return null;
    if (!control.invalid) return null;
    if (!control.dirty && !control.touched) return null;

    const errors = control.errors;
    if (!errors) return null;

    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['email']) return 'Email inválido';
    if (campo === 'postal') return 'Debe tener 5 dígitos';
    return 'Valor inválido';
  }

  async guardarCambios() {
    if (this.formularioUsuario.invalid) {
      return;
    }

    if (!this.formularioCambiado()) {
      return;
    }

    const payload = this.formularioUsuario.value;

    try {
      await this.convex.mutation(api.users.mutations.updateProfile, {
        firstName: payload.first_name ?? undefined,
        lastName: payload.last_name ?? undefined,
        email: payload.email ?? undefined,
        telefono: payload.telefono ?? undefined,
        direccion: payload.direccion ?? undefined,
        postal: payload.postal ?? undefined,
        numeroColegiado: payload.numero_colegiado ?? undefined,
      });
      await this.sessionService.refreshUsuario();
      this.formularioCambiado.set(false);
    } catch (err) {
      this.logger.error('Error guardando perfil:', err);
    }
  }

  cambiarFotoPerfil() {
    if (!this.subiendoAvatar()) {
      this.fileInput?.nativeElement.click();
    }
  }

  abrirSelectorArchivo() {
    if (!this.subiendoAvatar()) this.fileInput?.nativeElement.click();
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type);
    const maxSizeMB = 5;
    if (!isImage) {
      alert('Selecciona una imagen válida.');
      input.value = '';
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`La imagen supera ${maxSizeMB} MB.`);
      input.value = '';
      return;
    }

    const objUrl = URL.createObjectURL(file);
    this.previewUrl.set(objUrl);

    this.subirAvatar(file).finally(() => {
      input.value = '';
    });
  }

  private async subirAvatar(file: File) {
    try {
      this.subiendoAvatar.set(true);

      const usuario = this.sessionService.usuario();
      if (!usuario) throw new Error('Usuario no cargado');

      const result = await this.storage.upload(file, 'avatars');

      await this.convex.mutation(api.users.mutations.updateAvatar, {
        key: result.key,
      });

      await this.sessionService.refreshUsuario();
    } catch (e) {
      this.logger.error(e);
      alert('No se pudo actualizar la foto de perfil.');
    } finally {
      this.subiendoAvatar.set(false);
    }
  }

  // === MÉTODOS DE SEGURIDAD ===

  async cambiarPassword() {
    const { currentPassword, newPassword, confirmPassword } =
      this.formularioPassword.value;

    if (this.formularioPassword.invalid) {
      return;
    }

    if (newPassword !== confirmPassword) {
      return;
    }

    this.cambiandoPassword.set(true);

    try {
      const usuario = this.sessionService.usuario();
      if (!usuario?.email) throw new Error('Usuario no autenticado');

      const res = await fetch(`${env.CONVEX_SITE_URL}/api/auth/convex-set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usuario.email, password: newPassword }),
      });

      const body = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || 'Error al cambiar la contraseña');
      }

      this.formularioPassword.reset();
    } catch (e) {
      // error handled silently for now
    } finally {
      this.cambiandoPassword.set(false);
    }
  }

  // === MÉTODOS DE LEGAL ===

  async abrirPrivacyPolicy() {
    const { PrivacyPolicyComponent } = await import(
      './privacy-policy/privacy-policy.component'
    );
    this.dialogService.openInformative(PrivacyPolicyComponent);
  }

  // === MÉTODOS DE SECCIONES COLAPSABLES ===

  togglePersonal() {
    this.personalExpanded.update((v) => !v);
  }

  toggleSecurity() {
    this.securityExpanded.update((v) => !v);
  }

  toggleNotificaciones() {
    this.notificacionesExpanded.update((v) => !v);
  }

  toggleLegal() {
    this.legalExpanded.update((v) => !v);
  }

  async setNotifPref(
    key: 'chat' | 'dailyReminder' | 'newPlan',
    value: boolean,
  ) {
    try {
      await this.convex.mutation(
        api.notificationPreferences.mutations.updateMyPreferences,
        { [key]: value },
      );
    } catch (err) {
      this.logger.error('No se pudo actualizar la preferencia de notificación', err);
    }
  }

  scrollToSection(section: 'personal' | 'security') {
    if (section === 'personal') {
      this.personalExpanded.set(true);
      setTimeout(() => {
        this.personalSection?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    } else if (section === 'security') {
      this.securityExpanded.set(true);
      setTimeout(() => {
        this.securitySection?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }

  // === MÉTODOS DE VERIFICACIÓN DE EMAIL ===

  toggleVerificationPanel() {
    this.showVerificationPanel.update((v) => !v);
    if (!this.showVerificationPanel()) {
      this.resetVerificationState();
    }
  }

  private resetVerificationState() {
    this.verificationCode.set('');
    this.verificationMessage.set(null);
    this.codeSent.set(false);
  }

  async enviarCodigoVerificacion() {
    this.sendingCode.set(true);
    this.verificationMessage.set(null);

    try {
      const result = await this.emailVerificationService.enviarCodigo();

      if (result.success) {
        this.codeSent.set(true);
        this.verificationMessage.set({
          type: 'success',
          text: 'Código enviado. Revisa tu email.',
        });
      } else {
        this.verificationMessage.set({
          type: 'error',
          text: result.message || 'Error enviando el código',
        });
      }
    } catch {
      this.verificationMessage.set({
        type: 'error',
        text: 'Error enviando el código',
      });
    } finally {
      this.sendingCode.set(false);
    }
  }

  onCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 6);
    this.verificationCode.set(value);
    input.value = value;
  }

  async verificarEmail() {
    const code = this.verificationCode();
    if (code.length !== 6) {
      this.verificationMessage.set({
        type: 'error',
        text: 'Introduce el código de 6 dígitos',
      });
      return;
    }

    this.verifyingCode.set(true);
    this.verificationMessage.set(null);

    try {
      const result = await this.emailVerificationService.verificarEmail(code);

      if (result.success) {
        this.verificationMessage.set({
          type: 'success',
          text: 'Email verificado correctamente',
        });
        await this.sessionService.refreshUsuario();
        setTimeout(() => {
          this.showVerificationPanel.set(false);
          this.resetVerificationState();
        }, 1500);
      } else {
        this.verificationMessage.set({
          type: 'error',
          text: result.message || 'Código incorrecto',
        });
      }
    } catch {
      this.verificationMessage.set({
        type: 'error',
        text: 'Error verificando el código',
      });
    } finally {
      this.verifyingCode.set(false);
    }
  }
}
