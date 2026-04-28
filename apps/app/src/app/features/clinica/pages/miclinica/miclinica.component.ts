import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { assetUrl, rawAssetUrl } from '../../../../core/utils/asset-url';
// Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';

// Types:
import { Usuario, Clinica, ID, CodigoAcceso } from '../../../../../types/global';
import type { TipoCodigoAcceso } from '@kengo/shared-models';
import { useResponsive, BackButtonComponent, AvatarComponent } from '../../../../shared';

// Dialogs
import { VincularClinicaDialogComponent } from '../../components/vincular-clinica-dialog/vincular-clinica-dialog.component';
import { CrearClinicaDialogComponent } from '../../components/crear-clinica-dialog/crear-clinica-dialog.component';
import { GenerarCodigoDialogComponent } from '../../components/generar-codigo-dialog/generar-codigo-dialog.component';
import { EditarClinicaDialogComponent } from '../../components/editar-clinica-dialog/editar-clinica-dialog.component';

import { DatePipe } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-mi-clinica',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    VincularClinicaDialogComponent,
    CrearClinicaDialogComponent,
    GenerarCodigoDialogComponent,
    EditarClinicaDialogComponent,
    BackButtonComponent,
    AvatarComponent,
  ],
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
  public clinicaGestionService = inject(ClinicaGestionService);

  isMovil = useResponsive().esMobile;

  public usuario = computed(
    () => this.sessionService.usuario() as Usuario | null,
  )();

  public modoEdicion = signal(false);
  public fisios = (id: ID) => this.clinicasService.fisiosDeClinica(id)();

  // UI State
  showClinicPicker = false;
  teamExpanded = signal(false);

  // Dialog states
  mostrarModalVincular = signal(false);
  mostrarModalCrear = signal(false);
  mostrarModalGenerarCodigo = signal(false);
  mostrarModalEditar = signal(false);

  // Códigos de acceso
  codigosClinica = signal<CodigoAcceso[]>([]);
  codigosLoading = signal(false);
  codigosExpanded = signal(false);

  // Tipo inicial para el dialog de generar código
  tipoInicialCodigo = signal<TipoCodigoAcceso | null>(null);

  // Permisos computados
  esAdmin = computed(() => {
    const clinica = this.currentClinic();
    if (!clinica) return false;
    return this.clinicaGestionService.esAdminEnClinica(clinica.id);
  });

  esFisioOAdmin = computed(() => {
    const clinica = this.currentClinic();
    if (!clinica) return false;
    return this.clinicaGestionService.puedeGestionarCodigos(clinica.id);
  });

  // Rol del usuario en la clínica actual
  rolEnClinica = computed<{ nombre: string; icono: string } | null>(() => {
    const clinica = this.currentClinic();
    const usuario = this.sessionService.usuario();
    if (!clinica || !usuario) return null;

    const clinicaUsuario = usuario.clinicas.find(c => c.clinicId === clinica.id);
    if (!clinicaUsuario || clinicaUsuario.puesto === null) return null;

    const puesto = clinicaUsuario.puesto;
    if (puesto === 'admin') return { nombre: 'Administrador', icono: 'admin_panel_settings' };
    if (puesto === 'fisio') return { nombre: 'Fisioterapeuta', icono: 'medical_services' };
    if (puesto === 'paciente') return { nombre: 'Paciente', icono: 'person' };

    return null;
  });

  toggleTeamExpanded() {
    this.teamExpanded.update((v) => !v);
  }

  // ===== Dialog Methods =====
  abrirVincularClinica() {
    this.mostrarModalVincular.set(true);
  }

  cerrarVincularClinica() {
    this.mostrarModalVincular.set(false);
  }

  abrirCrearClinica() {
    this.mostrarModalCrear.set(true);
  }

  cerrarCrearClinica() {
    this.mostrarModalCrear.set(false);
  }

  abrirGenerarCodigo() {
    this.tipoInicialCodigo.set(null);
    this.mostrarModalGenerarCodigo.set(true);
  }

  abrirAnadirFisio() {
    this.tipoInicialCodigo.set('fisioterapeuta');
    this.mostrarModalGenerarCodigo.set(true);
  }

  cerrarGenerarCodigo() {
    this.mostrarModalGenerarCodigo.set(false);
  }

  abrirEditarClinica() {
    this.mostrarModalEditar.set(true);
  }

  cerrarEditarClinica() {
    this.mostrarModalEditar.set(false);
  }

  onClinicaActualizada() {
    this.cerrarEditarClinica();
    this.showSnackbar('Clínica actualizada exitosamente');
  }

  onVinculacionExitosa() {
    this.cerrarVincularClinica();
    this.showSnackbar('Te has vinculado a la clínica exitosamente');
  }

  onClinicaCreada() {
    this.cerrarCrearClinica();
    this.showSnackbar('Clínica creada exitosamente');
  }

  onCodigoGenerado(codigo: string) {
    this.cerrarGenerarCodigo();
    this.showSnackbar(`Código generado: ${codigo}`);
    this.cargarCodigos();
  }

  // ===== Códigos de Acceso =====
  toggleCodigosExpanded() {
    this.codigosExpanded.update((v) => !v);
    if (this.codigosExpanded() && this.codigosClinica().length === 0) {
      this.cargarCodigos();
    }
  }

  async cargarCodigos() {
    const clinica = this.currentClinic();
    if (!clinica) return;

    this.codigosLoading.set(true);
    try {
      this.clinicaGestionService.listarCodigos(clinica.id).subscribe({
        next: (codigos) => {
          this.codigosClinica.set(codigos);
          this.codigosLoading.set(false);
        },
        error: () => {
          this.codigosLoading.set(false);
        },
      });
    } catch {
      this.codigosLoading.set(false);
    }
  }

  async desactivarCodigo(codigoId: string) {
    const clinica = this.currentClinic();
    if (!clinica) return;

    const result = await this.clinicaGestionService.desactivarCodigo(codigoId, clinica.id);
    if (result.success) {
      this.showSnackbar('Código desactivado');
      this.cargarCodigos();
    }
  }

  async reactivarCodigo(codigoId: string) {
    const clinica = this.currentClinic();
    if (!clinica) return;

    const result = await this.clinicaGestionService.reactivarCodigo(codigoId, clinica.id);
    if (result.success) {
      this.showSnackbar('Código reactivado');
      this.cargarCodigos();
    }
  }

  copiarCodigo(codigo: string) {
    navigator.clipboard.writeText(codigo);
    this.showSnackbar('Código copiado al portapapeles');
  }

  // IDs de clínicas normalizados
  readonly clinicIds = computed<ID[] | null>(() => {
    const uc = this.sessionService.usuario()?.clinicas ?? null;
    if (!uc) return null;
    return uc.map((x) => x.clinicId);
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
      this.selectedClinicId.set(clinica.id);
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
    colorPrimario: ['#000000'],
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
        colorPrimario: c.colorPrimario ?? '#000000',
      },
      { emitEvent: false },
    );
  }

  onClinicChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const indexClinica = parseInt(select.value, 10);
    this.selectedClinicIndex.set(indexClinica);
    this.cargarFormulario(indexClinica);
    this.selectedClinicId.set(this.clinicasRes()[indexClinica].id);
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
      ? `${assetUrl(id, { fit: 'cover', width: 200, height: 200 })}`
      : null;
  }

  imagenPreviewUrl(id: ID) {
    return `${assetUrl(id, { fit: 'cover', width: 200, height: 150 })}`;
  }

  assetUrl(id?: string | null) {
    if (!id) return '';
    return `${rawAssetUrl(id)}`;
  }

  firstImageId(c: Clinica): string | undefined {
    const img = c?.imagenes?.[0];
    return img?.fileId ?? undefined;
  }

  iniciales(nombre?: string, apellidos?: string): string {
    const n = (nombre || '').trim();
    const a = (apellidos || '').trim();
    return ((n[0] || '') + (a[0] || '')).toUpperCase();
  }
}
