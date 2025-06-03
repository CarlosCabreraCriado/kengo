import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AppService } from '../../services/app.service';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { MatIconModule } from '@angular/material/icon';

//Upload:
import { ImageUploadComponent } from '../../image-upload/image-upload.component';

//Dialogos:
import { MatDialog } from '@angular/material/dialog';
import { DialogoComponent } from '../../dialogos/dialogos.component';

import { MatMenuModule } from '@angular/material/menu';

import { Usuario } from '../../models/Global';

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
  ],
  templateUrl: './modificar-perfil.component.html',
  styleUrl: './modificar-perfil.component.scss',
})
export class ModificarPerfilComponent {
  // Select Value
  genderSelected = 'option1';

  //Formulario:
  public formularioUsuario: FormGroup;

  // File Uploader
  private usuario: Usuario | null = null;

  public url_perfil = '';
  public formularioCambiado = false;

  constructor(
    private appService: AppService,
    private fb: FormBuilder,
    public dialog: MatDialog,
  ) {
    this.formularioUsuario = this.fb.group({
      nombre: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],

      dni: [
        { value: '', disabled: false },
        [
          Validators.required,
          Validators.pattern('^[XYZ]?([0-9]{7,8})([A-Z])$'),
        ],
      ],
      email: [
        { value: '', disabled: true },
        [Validators.required, Validators.email],
      ],
      email_aux: ['', [Validators.email]],

      telefono: [{ value: '', disabled: false }, [Validators.required]],
      postal: [
        '',
        [Validators.required, Validators.maxLength(5), Validators.minLength(5)],
      ],

      direccion: ['', [Validators.required]],
      sexo: ['', [Validators.required]],

      flag_notificacion_principal: [false, []],
      flag_notificacion_secundario: [false, []],
    });

    this.appService.usuario$.subscribe((user) => {
      console.log('Mis detalles: ', user);
      if (user) {
        this.usuario = user;
        if (this.usuario.avatar_url) {
          this.url_perfil = this.usuario.avatar_url;
        }
        //this.cargarFormulario();
      }
    });

    this.formularioUsuario.valueChanges.subscribe((form) => {
      this.formularioCambiado = true;
    });

    this.formularioUsuario.get('dni')?.valueChanges.subscribe((valor) => {
      this.formularioUsuario
        .get('dni')
        ?.setValue(valor.toUpperCase(), { emitEvent: false });
    });
  }

  cargarFormulario(): void {
    /*
    this.formularioUsuario.get('nombre')?.setValue(this.usuario.nombre);
    this.formularioUsuario.get('apellidos')?.setValue(this.usuario.apellidos);
    this.formularioUsuario.get('dni')?.setValue(this.usuario.dni);
    this.formularioUsuario.get('email')?.setValue(this.usuario.email);
    this.formularioUsuario.get('email_aux')?.setValue(this.usuario.email_aux);
    this.formularioUsuario.get('telefono')?.setValue(this.usuario.telefono);
    this.formularioUsuario.get('postal')?.setValue(this.usuario.postal);
    this.formularioUsuario.get('direccion')?.setValue(this.usuario.direccion);
    this.formularioUsuario.get('sexo')?.setValue(this.usuario.sexo);

    this.formularioUsuario
      .get('flag_notificacion_principal')
      ?.setValue(!!Number(this.usuario.flag_notificacion_principal));
    this.formularioUsuario
      .get('flag_notificacion_secundario')
      ?.setValue(!!Number(this.usuario.flag_notificacion_secundario));
    this.formularioCambiado = false;
    */
  }

  guardarCambios() {
    if (this.formularioUsuario.invalid) {
      if (this.formularioUsuario.get('dni')?.errors == null) {
        alert(
          'Formulario no valido. Revisa el formato de los datos aportados y vuelve a intentarlo.',
        );
      } else {
        alert(
          'Formulario no valido. Compruebe que el DNI introducido es correcto y vuelve a intentarlo.',
        );
      }
      return;
    }

    if (this.formularioCambiado == false) {
      alert('No se han realizado cambios.');
      return;
    }

    const dialogRef = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'procesando',
        titulo: 'Guardando cambios...',
        mensaje: '',
      },
    });

    console.log('ENVIANDO CAMBIOS: ', this.formularioUsuario.getRawValue());
    /*
    this.postService
      .peticionActualizarMiPerfil(
        this.trimFormValues(this.formularioUsuario.getRawValue()),
      )
      .subscribe((response) => {
        if (response) {
          console.warn('Perfil guardado con exito');
          dialogRef.close();
        } else {
          console.warn('Error en el guardado');
          dialogRef.close();
        }
      });
    */
  }

  trimFormValues(values: any) {
    const valoresProcesados: any = {};
    Object.keys(values).forEach((key) => {
      valoresProcesados[key] =
        typeof values[key] === 'string' ? values[key].trim() : values[key];
    });
    return valoresProcesados;
  }

  cambiarFoto(url_perfil: string) {
    this.dialog
      .open(ImageUploadComponent, {
        data: {
          url_perfil: url_perfil,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        /*
        if (this.usuario.id && result.blob) {
          let imagen = new File(result.blob, this.usuario.id_usuario + '.jpg');
          this.postService
            .uploadImagenPerfil(this.usuario.id_usuario, imagen)
            .subscribe((response) => {
              this.url_perfil = response.imageUrl;
              this.cdr.detectChanges();
            });
        }
        */
      });
  }
}
