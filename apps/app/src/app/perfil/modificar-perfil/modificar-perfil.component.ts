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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment as env } from '../../../environments/environment';

//Servicios:
import { AppService } from '../../services/app.service';

//Material:
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';

//Upload:
import { ImageUploadComponent } from '../../image-upload/image-upload.component';

//Dialogos:
import { MatDialog } from '@angular/material/dialog';
import { DialogoComponent } from '../../dialogos/dialogos.component';

//Types:
import { Usuario } from '../../../types/global';

@Component({
  selector: 'app-modificar-perfil',
  standalone: true,
  imports: [
    MatIconModule,
    MatCheckboxModule,
    MatMenuModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './modificar-perfil.component.html',
  styleUrl: './modificar-perfil.component.scss',
})
export class ModificarPerfilComponent implements OnInit, OnDestroy {
  private appService = inject(AppService);
  private fb = inject(FormBuilder);
  public dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Select Value
  genderSelected = 'option1';

  public usuario = computed(() => {
    return this.appService.usuario();
  });

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

  //Formulario:
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

  ngOnInit() {
    this.formularioUsuario.valueChanges.subscribe(() => {
      this.formularioCambiado.set(true);
    });
  }

  ngOnDestroy() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  cargarFormulario(usuario: Usuario) {
    this.formularioUsuario.patchValue(usuario, { emitEvent: false });
  }

  async guardarCambios() {
    if (this.formularioUsuario.invalid) {
      alert('Formulario no valido.');
      return;
    }

    if (!this.formularioCambiado()) {
      alert('No se han realizado cambios.');
      return;
    }

    const dialogoProcesando = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Guardando cambios...',
        mensaje: '',
      },
    });

    // Casos según tu esquema:
    const payload = this.formularioUsuario.value;
    console.warn('Payload a enviar:', payload);

    // Elige el que corresponda a tu colección de usuarios:
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
          mensaje: '',
        },
      });
      throw new Error('No se pudo actualizar el perfil');
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
          url_perfil: this.url_perfil(), // se usa como preview inicial
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

    // Validación simple
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

    // Previsualización inmediata
    const objUrl = URL.createObjectURL(file);
    this.previewUrl.set(objUrl);

    // (Opcional) aquí podrías abrir un modal con ngx-image-cropper y, tras recortar,
    // reemplazar `file` por el blob recortado antes de subir.

    // Subir a Directus
    this.subirAvatar(file).finally(() => {
      // Limpia selección para permitir re-seleccionar el mismo archivo si hace falta
      input.value = '';
    });
  }

  private async subirAvatar(file: File) {
    try {
      this.subiendoAvatar.set(true);

      // 1) Subida del archivo a Directus
      const formData = new FormData();
      formData.append('file', file);

      const resFile = await fetch(`${env.DIRECTUS_URL}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // si usas cookies/sesión
        headers: {
          // 'Authorization': `Bearer ${token}`, // si usas token
        },
      });

      if (!resFile.ok) throw new Error('Error subiendo el archivo');
      const filePayload = await resFile.json();
      const fileId = filePayload?.data?.id as string | undefined;
      //const fileUrl = filePayload?.data?.data?.full_url || this.url_perfil(); // ajusta a tu helper

      if (!fileId) throw new Error('No se recibió ID del archivo');

      // 2) Actualizar el usuario con el nuevo avatar
      const usuario = this.appService.usuario();
      if (!usuario) throw new Error('Usuario no cargado');

      // Casos según tu esquema:
      const updatePayloadA = { avatar: fileId };

      // Elige el que corresponda a tu colección de usuarios:
      const resUser = await fetch(`${env.DIRECTUS_URL}/users/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json' /*, Authorization si hace falta */,
        },
        body: JSON.stringify(updatePayloadA),
      });

      if (!resUser.ok) throw new Error('No se pudo actualizar el perfil');

      // 3) Refrescar usuario en el AppService (para propagar la nueva imagen)
      await this.appService.refreshUsuario();
    } catch (e) {
      console.error(e);
      alert('No se pudo actualizar la foto de perfil.');
    } finally {
      this.subiendoAvatar.set(false);
    }
  }
}
