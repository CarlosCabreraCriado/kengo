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
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

// Servicios
import { SessionService } from '../../../../../core/auth/services/session.service';

// Types
import { Usuario } from '../../../../../../types/global';

// Environment
import { environment as env } from '../../../../../../environments/environment';
import { KENGO_BREAKPOINTS } from '../../../../../shared';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private breakpointObserver = inject(BreakpointObserver);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // === SECTION TOGGLE STATES ===
  public personalExpanded = signal(true);
  public securityExpanded = signal(false);
  public legalExpanded = signal(false);

  // === OVERLAY PANELS ===
  public showPrivacyPolicy = signal(false);
  public showTermsConditions = signal(false);

  @ViewChild('personalSection') personalSection!: ElementRef<HTMLElement>;
  @ViewChild('securitySection') securitySection!: ElementRef<HTMLElement>;

  // === DATOS PERSONALES ===
  public usuario = computed(() => this.sessionService.usuario());
  public esFisio = computed(() => this.sessionService.usuario()?.esFisio ?? false);

  public url_perfil = computed(() => {
    const id_avatar = this.usuario()?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover`
      : null;
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
    email: [
      { value: '', disabled: true },
      [Validators.required, Validators.email],
    ],
    telefono: [{ value: '', disabled: false }, [Validators.required]],
    postal: [
      '',
      [Validators.required, Validators.maxLength(5), Validators.minLength(5)],
    ],
    direccion: ['', [Validators.required]],
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
  public hideCurrentPassword = signal(true);
  public hideNewPassword = signal(true);
  public hideConfirmPassword = signal(true);
  public cambiandoPassword = signal(false);

  public formularioPassword = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit() {
    this.formularioUsuario.valueChanges.subscribe(() => {
      this.formularioCambiado.set(true);
    });
  }

  ngOnDestroy() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // === MÉTODOS DE DATOS PERSONALES ===

  cargarFormulario(usuario: Usuario) {
    this.formularioUsuario.patchValue(usuario, { emitEvent: false });
  }

  async guardarCambios() {
    if (this.formularioUsuario.invalid) {
      /*
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Formulario no válido',
          mensaje: 'Por favor, revisa los campos marcados en rojo.',
        },
      });
      */
      return;
    }

    if (!this.formularioCambiado()) {
      return;
    }

    /*
    const dialogoProcesando = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Guardando cambios...',
        mensaje: '',
      },
    });
    */

    const payload = this.formularioUsuario.value;

    const resUser = await fetch(`${env.DIRECTUS_URL}/users/me`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resUser.ok) {
      /*
      dialogoProcesando.close();
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Se ha producido un error',
          mensaje: 'No se pudieron guardar los cambios.',
        },
      });
      */
    } else {
      await this.sessionService.refreshUsuario();
      this.formularioCambiado.set(false);
      //dialogoProcesando.close();
    }
  }

  cambiarFotoPerfil() {
    // Usar el input nativo de archivos
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

      const formData = new FormData();
      formData.append('file', file);

      const resFile = await fetch(`${env.DIRECTUS_URL}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!resFile.ok) throw new Error('Error subiendo el archivo');
      const filePayload = await resFile.json();
      const fileId = filePayload?.data?.id as string | undefined;

      if (!fileId) throw new Error('No se recibió ID del archivo');

      const usuario = this.sessionService.usuario();
      if (!usuario) throw new Error('Usuario no cargado');

      const updatePayload = { avatar: fileId };

      const resUser = await fetch(`${env.DIRECTUS_URL}/users/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!resUser.ok) throw new Error('No se pudo actualizar el perfil');

      await this.sessionService.refreshUsuario();
    } catch (e) {
      console.error(e);
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
      /*
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Formulario no válido',
          mensaje: 'Por favor, completa todos los campos correctamente.',
        },
      });
      */
      return;
    }

    if (newPassword !== confirmPassword) {
      /*
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Las contraseñas no coinciden',
          mensaje: 'La nueva contraseña y su confirmación deben ser iguales.',
        },
      });
      */
      return;
    }

    this.cambiandoPassword.set(true);

    /*
    const dialogoProcesando = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Cambiando contraseña...',
        mensaje: '',
      },
    });
    */

    try {
      const res = await fetch(`${env.DIRECTUS_URL}/users/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      //dialogoProcesando.close();

      if (!res.ok) {
        throw new Error('Error al cambiar la contraseña');
      }

      this.formularioPassword.reset();
      /*
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'exito',
          titulo: 'Contraseña actualizada',
          mensaje: 'Tu contraseña ha sido cambiada correctamente.',
        },
      });
      */
    } catch (e) {
      //dialogoProcesando.close();
      /*
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.',
        },
      });
      */
    } finally {
      this.cambiandoPassword.set(false);
    }
  }

  // === MÉTODOS DE LEGAL ===

  abrirPrivacyPolicy() {
    this.showPrivacyPolicy.set(true);
  }

  cerrarPrivacyPolicy() {
    this.showPrivacyPolicy.set(false);
  }

  abrirTermsConditions() {
    this.showTermsConditions.set(true);
  }

  cerrarTermsConditions() {
    this.showTermsConditions.set(false);
  }

  // === MÉTODOS DE SECCIONES COLAPSABLES ===

  togglePersonal() {
    this.personalExpanded.update((v) => !v);
  }

  toggleSecurity() {
    this.securityExpanded.update((v) => !v);
  }

  toggleLegal() {
    this.legalExpanded.update((v) => !v);
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
}
