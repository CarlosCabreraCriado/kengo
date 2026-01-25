import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment as env } from '../../../../../environments/environment';

// Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicasService } from '../../data-access/clinicas.service';

// Types:
import { Usuario, Clinica, ID } from '../../../../../types/global';
import { KENGO_BREAKPOINTS } from '../../../../shared';

@Component({
  standalone: true,
  selector: 'app-mi-clinica',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './miclinica.component.html',
  styleUrl: './miclinica.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class MiClinicaComponent {
  private fb = inject(FormBuilder);
  private sessionService = inject(SessionService);
  public clinicasService = inject(ClinicasService);
  private breakpointObserver = inject(BreakpointObserver);

  // Detectar si es móvil (< 768px) - alineado con breakpoint de navegación
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  public usuario = computed(
    () => this.sessionService.usuario() as Usuario | null,
  )();

  public modoEdicion = signal(false);
  public fisios = (id: ID) => this.clinicasService.fisiosDeClinica(id)();

  // UI State
  showClinicPicker = false;
  teamExpanded = signal(false);

  toggleTeamExpanded() {
    this.teamExpanded.update((v) => !v);
  }

  // IDs de clínicas normalizados
  readonly clinicIds = computed<ID[] | null>(() => {
    const uc = this.sessionService.usuario()?.clinicas ?? null;
    if (!uc) return null;
    return uc.map((x) => x.id_clinica);
  });

  // Selector de clínica activa
  selectedClinicId = signal<ID | null>(null);
  selectedClinicIndex = signal<number>(0);

  clinicasRes = computed(() => this.clinicasService.misClinicasRes.value());

  // Computed para la clínica actual
  currentClinic = computed<Clinica | null>(() => {
    const clinicas = this.clinicasRes();
    if (!clinicas || clinicas.length === 0) return null;
    return clinicas[this.selectedClinicIndex()] ?? null;
  });

  selectClinic(index: number) {
    this.selectedClinicIndex.set(index);
    const clinica = this.clinicasRes()[index];
    if (clinica) {
      this.selectedClinicId.set(clinica.id_clinica);
      this.cargarFormulario(index);
    }
    this.showClinicPicker = false;
    this.teamExpanded.set(false);
  }

  // ===== 3) Form & estado =====
  form = this.fb.group({
    nombre: ['', [Validators.required]],
    telefono: [''],
    email: ['', [Validators.email]],
    direccion: [''],
    postal: [''],
    nif: [''],
    color_primario: ['#000000'],
  });

  loading = signal(false);
  error = signal<string | null>(null);

  // Files seleccionados (pendientes de subir)
  logoFile = signal<File | null>(null);
  imagenesFiles = signal<File[]>([]);

  // IDs existentes (para mantenerlos si no cambias)
  existingLogoId = signal<ID | null>(null);
  existingImagenIds = signal<ID[]>([]);

  // Snackbar nativo
  snackbarVisible = signal(false);
  snackbarMessage = signal('');

  showSnackbar(message: string) {
    this.snackbarMessage.set(message);
    this.snackbarVisible.set(true);
    setTimeout(() => this.snackbarVisible.set(false), 3000);
  }

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

  onClinicChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const indexClinica = parseInt(select.value, 10);
    this.selectedClinicIndex.set(indexClinica);
    this.cargarFormulario(indexClinica);
    this.selectedClinicId.set(this.clinicasRes()[indexClinica].id_clinica);
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
