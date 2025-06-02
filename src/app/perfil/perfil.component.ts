import { Component } from '@angular/core';


//Servicios:
import { AppService } from '../services/app.service';

//Formularios Angular:
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule
],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent {
  public perfilForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    first_name: ['', Validators.required],
    last_name: [''],
    fecha_nacimiento: [''],
    postal: [''],
    direccion: [''],
    telefono: [''],
  });

  public loading = true;

  constructor(
    private appService: AppService,
    private fb: FormBuilder,
  ) {
    this.appService.usuario$.subscribe((usuario) => {
      if (usuario?.id && !usuario?.detalle) {
        this.appService.cargarMiDetalle();
      }
      if (usuario?.detalle) {
        console.warn('Usuario con detalle: ', usuario.detalle);
        this.perfilForm.patchValue({
          ...usuario,
          ...usuario.detalle,
        });
      }
    });
  }

  guardarPerfil() {
    console.log('Guardando perfil: ', this.perfilForm.value);
  }
}
