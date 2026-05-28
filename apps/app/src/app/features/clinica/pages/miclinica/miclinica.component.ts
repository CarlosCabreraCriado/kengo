import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { assetUrl, rawAssetUrl } from '../../../../core/utils/asset-url';
// Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import { ClinicaGestionService } from '../../data-access/clinica-gestion.service';
import { SubscriptionService } from '../../../../core/billing/subscription.service';

// Types:
import { Usuario, Clinica, ID } from '../../../../../types/global';
import { useResponsive } from '../../../../shared';

// Dialogs (rediseñados V2). Tipos importados estáticamente; los componentes
// se cargan vía import() dinámico en sus métodos abrir*.
import type { VincularClinicaDialogComponent } from '../../components/vincular-clinica-dialog/vincular-clinica-dialog.component';
import type { CrearClinicaDialogComponent } from '../../components/crear-clinica-dialog/crear-clinica-dialog.component';
import type {
  GenerarCodigoDialogComponent,
  GenerarCodigoDialogData,
  GenerarCodigoDialogResult,
} from '../../components/generar-codigo-dialog/generar-codigo-dialog.component';
import type { EditarClinicaDialogComponent } from '../../components/editar-clinica-dialog/editar-clinica-dialog.component';
import type { SeleccionarOpcionClinicaDialogComponent } from '../../components/seleccionar-opcion-clinica-dialog/seleccionar-opcion-clinica-dialog.component';
import { ContactarVentasDialogComponent } from '../../components/contactar-ventas-dialog/contactar-ventas-dialog.component';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';

// V2 catalog
import {
  Ui2SectionComponent,
  Ui2ButtonComponent,
  Ui2CtaBarComponent,
  Ui2EmptyStateComponent,
  Ui2CardComponent,
  Ui2SpinnerComponent,
  Ui2PillVariant,
} from '../../../../shared/ui-v2';

// Subcomponentes presentacionales del rediseño desktop
import {
  MiClinicaHeroComponent,
  MiClinicaQuickActionsComponent,
  MiClinicaTeamGridComponent,
  MiClinicaRoleCardComponent,
  MiClinicaInfoCardComponent,
  MiClinicaInfoField,
  MiClinicaSubscriptionCardComponent,
  MiClinicaClinicasAccordionComponent,
} from '../../components/miclinica';

@Component({
  standalone: true,
  selector: 'app-mi-clinica',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    Ui2SectionComponent,
    Ui2ButtonComponent,
    Ui2CtaBarComponent,
    Ui2EmptyStateComponent,
    Ui2CardComponent,
    Ui2SpinnerComponent,
    MiClinicaHeroComponent,
    MiClinicaQuickActionsComponent,
    MiClinicaTeamGridComponent,
    MiClinicaRoleCardComponent,
    MiClinicaInfoCardComponent,
    MiClinicaSubscriptionCardComponent,
    MiClinicaClinicasAccordionComponent,
  ],
  templateUrl: './miclinica.component.html',
  styleUrl: './miclinica.component.css',
  host: {
    class: 'block w-full',
  },
})
export class MiClinicaComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  public clinicasService = inject(ClinicasService);
  public clinicaGestionService = inject(ClinicaGestionService);
  protected subscriptionService = inject(SubscriptionService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'miclinica';

  /** Datos críticos: lista de clínicas resuelta. */
  readonly pageReady = computed(() => !this.clinicasService.misClinicasRes.isLoading());

  ngOnInit(): void {
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy(): void {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
  }

  isMovil = useResponsive().esMobile;

  public usuario = computed(
    () => this.sessionService.usuario() as Usuario | null,
  )();

  public modoEdicion = signal(false);
  public fisios = (id: ID) => this.clinicasService.fisiosDeClinica(id)();

  // UI State
  teamExpanded = signal(false);
  clinicasAccordionExpanded = signal(false);

  // Dialog states

  // Permisos computados
  esAdmin = computed(() => {
    const clinica = this.currentClinic();
    if (!clinica) return false;
    return this.clinicaGestionService.esAdminEnClinica(clinica.id);
  });

  puedeAnadirAEquipo = computed(
    () => this.esAdmin() && this.sessionService.enModoFisio(),
  );

  puedeEditarClinica = computed(
    () => this.esAdmin() && this.sessionService.enModoFisio(),
  );

  /**
   * `true` cuando el admin ha alcanzado el límite de fisios del plan
   * autoservicio (10) y necesita contactar comercial para crecer. Se evalúa
   * a partir de la suscripción de la clínica donde el usuario es admin.
   */
  enLimiteFisios = computed(() => {
    const sub = this.subscriptionService.suscripcion();
    if (!sub) return false;
    return sub.fisiosActuales >= 10;
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

  toggleClinicasAccordion() {
    this.clinicasAccordionExpanded.update((v) => !v);
  }

  /** Devuelve el puesto del usuario en una clínica dada. */
  puestoEnClinicaFn = (clinicId: string): string | null => {
    return (
      this.sessionService.misclinicas().find((m) => m.clinicId === clinicId)
        ?.puesto ?? null
    );
  };

  /** Resolver de URL del logo de una clínica para el componente accordion. */
  resolverLogoClinica = (logoId: string | null | undefined): string | null =>
    logoId ? this.assetUrl(logoId) : null;

  /**
   * Abre el selector "Vincularme o crear nueva clínica" como bottom-sheet. La
   * opción "Crear nueva clínica" muestra antes un disclaimer porque convierte
   * al usuario en admin de la nueva clínica, aunque su puesto previo fuera
   * paciente. Ambas ramas delegan en los métodos `abrir*` ya existentes.
   */
  async onAbrirVincularOCrear(): Promise<void> {
    const { SeleccionarOpcionClinicaDialogComponent } = await import(
      '../../components/seleccionar-opcion-clinica-dialog/seleccionar-opcion-clinica-dialog.component'
    );
    const ref = this.dialogService.openSheet<
      SeleccionarOpcionClinicaDialogComponent,
      undefined,
      'link' | 'create' | null
    >(SeleccionarOpcionClinicaDialogComponent);

    ref.closed.subscribe(async (opcion) => {
      if (opcion === 'link') {
        this.abrirVincularClinica();
      } else if (opcion === 'create') {
        const confirmado = await this.dialogService.confirm({
          title: 'Crear nueva clínica',
          message:
            'Esta opción es para fisioterapeutas que quieran montar su propia clínica y gestionar a sus pacientes. Al continuar te convertirás en administrador de la nueva clínica.',
          confirmText: 'Continuar',
          cancelText: 'Cancelar',
        });
        if (confirmado) this.abrirCrearClinica();
      }
    });
  }

  // ===== Dialog Methods =====
  async abrirVincularClinica() {
    const { VincularClinicaDialogComponent } = await import(
      '../../components/vincular-clinica-dialog/vincular-clinica-dialog.component'
    );
    const ref = this.dialogService.openForm<VincularClinicaDialogComponent, undefined, boolean>(
      VincularClinicaDialogComponent,
    );
    ref.closed.subscribe(success => {
      if (success) this.showSnackbar('Te has vinculado a la clínica exitosamente');
    });
  }

  async abrirCrearClinica() {
    const { CrearClinicaDialogComponent } = await import(
      '../../components/crear-clinica-dialog/crear-clinica-dialog.component'
    );
    const ref = this.dialogService.openForm<CrearClinicaDialogComponent, undefined, boolean>(
      CrearClinicaDialogComponent,
    );
    ref.closed.subscribe(success => {
      if (success) this.showSnackbar('Clínica creada exitosamente');
    });
  }

  async abrirAnadirFisio() {
    const clinica = this.currentClinic();
    if (!clinica) return;
    const { GenerarCodigoDialogComponent } = await import(
      '../../components/generar-codigo-dialog/generar-codigo-dialog.component'
    );
    const ref = this.dialogService.openForm<
      GenerarCodigoDialogComponent,
      GenerarCodigoDialogData,
      GenerarCodigoDialogResult
    >(GenerarCodigoDialogComponent, {
      data: {
        clinicaId: clinica.id,
        esAdmin: this.esAdmin(),
        tipoFijo: 'fisioterapeuta',
      },
    });
    ref.closed.subscribe(result => {
      if (result?.codigo) {
        this.showSnackbar(`Código generado: ${result.codigo}`);
      } else if (result?.requiereContactoVentas) {
        this.toastService.warning(
          'Has alcanzado el plan máximo (10 fisios). Contacta con ventas para un plan a medida.',
        );
        this.abrirDialogContactarVentas();
      }
    });
  }

  async abrirEditarClinica() {
    const clinica = this.currentClinic();
    if (!clinica) return;
    const { EditarClinicaDialogComponent } = await import(
      '../../components/editar-clinica-dialog/editar-clinica-dialog.component'
    );
    const ref = this.dialogService.openForm<EditarClinicaDialogComponent, Clinica, boolean>(
      EditarClinicaDialogComponent,
      { data: clinica, maxWidth: '720px' },
    );
    ref.closed.subscribe(success => {
      if (success) this.showSnackbar('Clínica actualizada exitosamente');
    });
  }

  /** Abre el formulario de contacto comercial. Reutilizable desde el aviso de límite. */
  abrirDialogContactarVentas() {
    const clinica = this.currentClinic();
    if (!clinica) return;
    this.dialogService.open(ContactarVentasDialogComponent, {
      data: {
        clinicId: clinica.id,
        fisiosActuales:
          this.subscriptionService.suscripcion()?.fisiosActuales ?? 10,
      },
      maxWidth: '480px',
    });
  }

  // IDs de clínicas normalizados
  readonly clinicIds = computed<ID[] | null>(() => {
    const uc = this.sessionService.usuario()?.clinicas ?? null;
    if (!uc) return null;
    return uc.map((x) => x.clinicId);
  });

  clinicasRes = computed(() => this.clinicasService.misClinicasRes.value());

  // Computed para la clínica actual: siempre refleja la clínica activa
  // global (`ClinicaActivaService`). El `ClinicaActivaGuard` garantiza que
  // hay una válida al entrar a la página.
  currentClinic = computed<Clinica | null>(() => {
    const clinicas = this.clinicasRes();
    const activeId = this.clinicaActiva.selectedClinicaId();
    if (!clinicas || clinicas.length === 0) return null;
    return clinicas.find((c) => c.id === activeId) ?? null;
  });

  /**
   * Cambia la clínica activa al hacer click en una opción del accordion.
   * Actualiza el contexto global (`ClinicaActivaService`) y recarga el
   * formulario de edición para mantenerlo coherente con la nueva clínica.
   */
  onSeleccionarClinica(clinicId: string): void {
    this.clinicaActiva.set(clinicId);
    this.clinicasAccordionExpanded.set(false);
    this.teamExpanded.set(false);
    const idx = this.clinicasRes().findIndex((c) => c.id === clinicId);
    if (idx >= 0) this.cargarFormulario(idx);
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

  fisioAvatarUrl(avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    return `${assetUrl(avatar, { fit: 'cover', width: 128, height: 128 })}`;
  }

  iniciales(nombre?: string, apellidos?: string): string {
    const n = (nombre || '').trim();
    const a = (apellidos || '').trim();
    return ((n[0] || '') + (a[0] || '')).toUpperCase();
  }

  // ===== Suscripción (solo admin) =====
  protected readonly suscripcionSubtitle = computed<string>(() => {
    const sub = this.subscriptionService.suscripcion();
    if (!sub || sub.estado === 'none') return 'Sin suscripción activa';
    if (this.subscriptionService.bloqueada())
      return 'Suspendida — actualiza el método de pago';
    if (sub.estado === 'trialing') {
      const dias = this.subscriptionService.diasRestantesTrial();
      return `Trial · ${dias} día${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}`;
    }
    if (this.subscriptionService.cancelaAlFinDelPeriodo() && sub.currentPeriodEnd) {
      const fecha = new Date(sub.currentPeriodEnd).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      return `Se cancelará el ${fecha}`;
    }
    if (sub.estado === 'past_due') return 'Pago pendiente';
    if (sub.plan) {
      return `Activa · ${sub.plan.nombre} · ${sub.plan.precioMensualEur} €/mes`;
    }
    return 'Activa';
  });

  protected readonly suscripcionPillVariant = computed<Ui2PillVariant>(() => {
    const sub = this.subscriptionService.suscripcion();
    if (!sub || sub.estado === 'none') return 'neutral';
    if (this.subscriptionService.bloqueada()) return 'danger';
    if (sub.estado === 'trialing') return 'soft';
    if (sub.estado === 'past_due') return 'warning';
    if (this.subscriptionService.cancelaAlFinDelPeriodo()) return 'neutral';
    return 'success';
  });

  protected readonly suscripcionPillTexto = computed<string>(() => {
    const sub = this.subscriptionService.suscripcion();
    if (!sub || sub.estado === 'none') return 'Inactiva';
    if (this.subscriptionService.bloqueada()) return 'Suspendida';
    if (sub.estado === 'trialing') return 'Trial';
    if (sub.estado === 'past_due') return 'Pendiente';
    if (this.subscriptionService.cancelaAlFinDelPeriodo()) return 'Cancelará';
    return 'Activa';
  });

  irASuscripcion(): void {
    void this.router.navigate(['/mi-clinica/suscripcion']);
  }

  // ===== Datos derivados para el rediseño desktop =====

  /** Nombre del plan actual en mayúsculas — fallback "FREE" si no hay suscripción. */
  protected readonly suscripcionPlanNombre = computed<string>(() => {
    const sub = this.subscriptionService.suscripcion();
    return sub?.plan?.nombre?.toUpperCase() ?? 'FREE';
  });

  /**
   * `true` si conviene mostrar el banner amarillo dentro de la subscription card.
   * Lo activan: el plan está bloqueado por impago o el equipo supera el plan free.
   */
  protected readonly mostrarWarningSuscripcion = computed<boolean>(
    () => this.enLimiteFisios() || this.subscriptionService.bloqueada(),
  );

  protected readonly mensajeWarningSuscripcion = computed<string>(() => {
    if (this.subscriptionService.bloqueada())
      return 'Tu suscripción está suspendida. Actualiza el método de pago.';
    if (this.enLimiteFisios())
      return 'Has alcanzado el plan máximo (10 fisios). Contacta con ventas.';
    return 'Tu equipo supera el plan free. Activa una suscripción.';
  });

  /** Fecha de renovación legible, o "—" si no aplica. */
  protected readonly suscripcionRenovacion = computed<string>(() => {
    const fin = this.subscriptionService.suscripcion()?.currentPeriodEnd;
    if (!fin) return '—';
    return new Date(fin).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  });

  /** Etiqueta del CTA principal de la suscripción según estado. */
  protected readonly suscripcionCtaLabel = computed<string>(() => {
    const sub = this.subscriptionService.suscripcion();
    if (!sub || sub.estado === 'none') return 'Activar suscripción';
    if (this.subscriptionService.bloqueada()) return 'Actualizar pago';
    return 'Gestionar suscripción';
  });

  /** Campos de la InfoCard "Contacto" (rediseño desktop). */
  protected readonly camposContacto = computed<MiClinicaInfoField[]>(() => {
    const c = this.currentClinic();
    return [
      { label: 'Teléfono', value: c?.telefono ?? null },
      { label: 'Email', value: c?.email ?? null },
    ];
  });

  /** Campos de la InfoCard "Datos fiscales" (rediseño desktop). */
  protected readonly camposFiscales = computed<MiClinicaInfoField[]>(() => {
    const c = this.currentClinic();
    return [
      { label: 'NIF', value: c?.nif ?? null, mono: true },
      { label: 'Código postal', value: c?.postal ?? null },
      { label: 'Dirección', value: c?.direccion ?? null },
      { label: 'Web', value: c?.web ?? null },
    ];
  });

  /** Devuelve si un fisio concreto es admin de la clínica activa (para etiqueta de rol). */
  esAdminFisioFn = (fisioId: string): boolean => {
    const clinica = this.currentClinic();
    if (!clinica) return false;
    const miembro = this.fisios(clinica.id).find((f) => f.id === fisioId);
    return miembro?.puesto === 'admin';
  };

  /** Resolver de URL de avatar para el componente team-grid. */
  resolverAvatarFisio = (avatar: string | null | undefined): string | null =>
    this.fisioAvatarUrl(avatar);

  /**
   * Abre el detalle de un miembro del equipo en bottom-sheet (móvil) /
   * modal (desktop). El propio diálogo decide si mostrar la acción de
   * desvincular según el puesto del actor y del target.
   */
  async abrirDetalleMiembro(miembro: Usuario): Promise<void> {
    const clinica = this.currentClinic();
    if (!clinica) return;
    const { MiembroDetailDialogComponent } = await import(
      '../../components/miembro-detail-dialog/miembro-detail-dialog.component'
    );
    this.dialogService.openSheet(MiembroDetailDialogComponent, {
      data: { clinicaId: clinica.id, fisioId: miembro.id },
    });
  }
}
