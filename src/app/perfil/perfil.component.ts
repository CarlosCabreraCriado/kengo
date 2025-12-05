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

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// Servicios
import { AppService } from '../services/app.service';

// Componentes
import { ImageUploadComponent } from '../image-upload/image-upload.component';
import { DialogoComponent } from '../dialogos/dialogos.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './terms-conditions/terms-conditions.component';

// Types
import { Usuario } from '../../types/global';

// Environment
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent implements OnInit, OnDestroy {
  private appService = inject(AppService);
  private fb = inject(FormBuilder);
  public dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // === DATOS PERSONALES ===
  public usuario = computed(() => this.appService.usuario());

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
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Formulario no válido',
          mensaje: 'Por favor, revisa los campos marcados en rojo.',
        },
      });
      return;
    }

    if (!this.formularioCambiado()) {
      return;
    }

    const dialogoProcesando = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Guardando cambios...',
        mensaje: '',
      },
    });

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
      dialogoProcesando.close();
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Se ha producido un error',
          mensaje: 'No se pudieron guardar los cambios.',
        },
      });
    } else {
      await this.appService.refreshUsuario();
      this.formularioCambiado.set(false);
      dialogoProcesando.close();
    }
  }

  cambiarFotoPerfil() {
    this.dialog
      .open(ImageUploadComponent, {
        data: {
          url_perfil: this.url_perfil(),
          resizeToWidth: 512,
          format: 'jpeg',
          quality: 80,
          precargar: true,
        },
      })
      .afterClosed()
      .subscribe(async (result?: { file: File; dataUrl: string }) => {
        if (!result) return;
        await this.subirAvatar(result.file);
      });
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

      const usuario = this.appService.usuario();
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

      await this.appService.refreshUsuario();
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
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Formulario no válido',
          mensaje: 'Por favor, completa todos los campos correctamente.',
        },
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Las contraseñas no coinciden',
          mensaje: 'La nueva contraseña y su confirmación deben ser iguales.',
        },
      });
      return;
    }

    this.cambiandoPassword.set(true);

    const dialogoProcesando = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Cambiando contraseña...',
        mensaje: '',
      },
    });

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

      dialogoProcesando.close();

      if (!res.ok) {
        throw new Error('Error al cambiar la contraseña');
      }

      this.formularioPassword.reset();
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'exito',
          titulo: 'Contraseña actualizada',
          mensaje: 'Tu contraseña ha sido cambiada correctamente.',
        },
      });
    } catch (e) {
      dialogoProcesando.close();
      this.dialog.open(DialogoComponent, {
        data: {
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.',
        },
      });
    } finally {
      this.cambiandoPassword.set(false);
    }
  }

  // === MÉTODOS DE LEGAL ===

  abrirPrivacyPolicy() {
    this.dialog.open(PrivacyPolicyComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
    });
  }

  abrirTermsConditions() {
    this.dialog.open(TermsConditionsComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
    });
  }
}
