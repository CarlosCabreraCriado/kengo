import { Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment as env } from '../../environments/environment';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

// Servicios:
import { AppService } from '../services/app.service';
import { ClinicasService } from '../services/clinicas.service';

// Types:
import { Usuario, Clinica, ID } from '../../types/global';

@Component({
  standalone: true,
  selector: 'app-mi-clinica',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './miclinica.component.html',
})
export class MiClinicaComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private appService = inject(AppService);
  public clinicasService = inject(ClinicasService);

  public usuario = computed(
    () => this.appService.usuario() as Usuario | null,
  )();

  public modoEdicion = signal(false);
  public fisios = (id: ID) => this.clinicasService.fisiosDeClinica(id)();

  // IDs de clínicas normalizados
  readonly clinicIds = computed<ID[] | null>(() => {
    const uc = this.appService.usuario()?.clinicas ?? null;
    if (!uc) return null;
    const ids = uc.map((x) => x.id_clinica);
    console.log('IDs de mis clínicas:', ids);
    return ids;
  });

  // Selector de clínica activa
  selectedClinicId = signal<ID | null>(null);

  clinicasRes = computed(() => this.clinicasService.misClinicasRes.value());

  // ===== 3) Form & estado =====
  form = this.fb.group({
    nombre: ['', [Validators.required]],
    telefono: [''],
    email: ['', [Validators.email]],
    direccion: [''],
    postal: [''],
    nif: [''],
    color_primario: ['#000000'],
    // No meto logo/imagenes en el form (manejo por archivo), pero puedes añadirlos si prefieres.
  });

  loading = signal(false);
  error = signal<string | null>(null);

  // Files seleccionados (pendientes de subir)
  logoFile = signal<File | null>(null);
  imagenesFiles = signal<File[]>([]);

  // IDs existentes (para mantenerlos si no cambias)
  existingLogoId = signal<ID | null>(null);
  existingImagenIds = signal<ID[]>([]);

  cargarFormulario(indexClinica: number) {
    if (this.clinicasRes().length == 0) return;
    const c = this.clinicasRes()[indexClinica];
    this.form.patchValue(
      {
        nombre: c.nombre ?? '',
        telefono: c.telefono ?? '',
        email: c.email ?? '',
        direccion: c.direccion ?? '',
        postal: c.postal ?? '',
        nif: c.nif ?? '',
        color_primario: c.color_primario ?? '#000000',
      },
      { emitEvent: false },
    );
  }

  onClinicChange(indexClinica: number) {
    console.warn('clinica cambiada:', indexClinica);
    this.cargarFormulario(indexClinica);
    this.selectedClinicId.set(this.clinicasRes()[indexClinica].id_clinica);
    //this.form.reset();
    //this.logoFile.set(null);
    //this.imagenesFiles.set([]);
    //this.error.set(null);
  }

  // ==== Handlers de inputs file ====
  onLogoSelected(files: FileList | null) {
    this.logoFile.set(files?.item(0) ?? null);
  }
  onImagenesSelected(files: FileList | null) {
    this.imagenesFiles.set(files ? Array.from(files) : []);
  }

  // Previews
  logoPreviewUrl(): string | null {
    if (this.logoFile()) return URL.createObjectURL(this.logoFile()!);
    const id = this.existingLogoId();
    return id
      ? `${env.DIRECTUS_URL}/assets/${id}?fit=cover&width=200&height=200`
      : null;
  }

  imagenPreviewUrl(id: ID) {
    return `${env.DIRECTUS_URL}/assets/${id}?fit=cover&width=200&height=150`;
  }

  assetUrl(id?: string) {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}`;
  }

  firstImageId(c: Clinica) {
    const f = c?.imagenes?.[0];
    return f;
  }

  iniciales(nombre?: string, apellidos?: string): string {
    const n = (nombre || '').trim();
    const a = (apellidos || '').trim();
    return ((n[0] || '') + (a[0] || '')).toUpperCase();
  }
}

// ===== Effect para inicializar el formulario cuando llega la clínica =====
/*
function clinicaEffect(ctx: MiClinicaComponent) {
  //const unsub = setInterval(() => {}, 1); // no usado, evitamos warnings
  //const ref = ctx;
  // simple watcher manual basado en polling mínimo del resource (alternativa: computed+effect si gestionas señales derivadas)
  //let lastId: ID | null = null;
  const tick = () => {
    const id = ref.selectedClinicId();
    if (id !== lastId && id != null) {
      lastId = id;
      ref.clinicaRes.reload();
    }
    const c = ref.clinicaRes.value?.();
    if (c) {
      // Inicializa form
      ref.form.patchValue(
        {
          nombre: c.nombre ?? '',
          telefono: c.telefono ?? '',
          email: c.email ?? '',
          direccion: c.direccion ?? '',
          postal: c.postal ?? '',
          nif: c.nif ?? '',
          color_primario: c.color_primario ?? '#000000',
        },
        { emitEvent: false },
      );

      // IDs existentes (para mantener si no cambian)
      const logoId = typeof c.logo === 'object' ? c.logo?.id : c.logo;
      ref.existingLogoId.set(logoId ?? null);

      const imgIds = (c.imagenes ?? [])
        .map((x) => (typeof x === 'object' ? x.id : x))
        .filter(Boolean) as ID[];
      ref.existingImagenIds.set(imgIds);
    }
  };
  // pequeño interval para sincronizar (puedes cambiarlo por un `effect()` propio si centralizas señales)
  //const interval = setInterval(tick, 150);
  //(ref).__cleanup = () => clearInterval(interval);
}
*/
