import { Injectable, signal, computed, inject } from '@angular/core';
import { RolUsuario, Usuario, Puesto } from '../../../../types/global';
import { ConvexService } from '../../convex/convex.service';
import { BetterAuthService } from './better-auth.service';
import { api } from '../../../../../../../convex/_generated/api';
import { rawAssetUrl } from '../../utils/asset-url';

/**
 * SessionService — gestiona el estado del usuario autenticado.
 * Tras la consolidación a Convex-only, esta clase consume exclusivamente
 * `api.users.queries.me`. La cookie/sesión la gestiona Better-Auth.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly MODO_STORAGE_KEY = 'kengo:modo';

  private _rolUsuario = signal<RolUsuario>('fisio');
  public rolUsuario = this._rolUsuario;
  // True cuando el usuario puede alternar entre modo fisio y modo paciente.
  // Solo los fisios pueden hacerlo; los pacientes están restringidos a su modo.
  public puedeAlternarModo = signal(false);

  private _usuario = signal<Usuario | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  public usuario = computed(() => this._usuario());
  public isLoggedIn = computed(() => this._usuario() !== null);
  public loading = computed(() => this._loading());
  public error = computed(() => this._error());
  public nombreCompleto = computed(() => {
    const u = this._usuario();
    return u ? `${u.first_name} ${u.last_name}`.trim() : '';
  });
  public misclinicas = computed(() => this._usuario()?.clinicas ?? []);

  // === MODO ACTIVO (dinámico, lo que el usuario ve/hace ahora) ===
  public enModoFisio = computed(() => this._rolUsuario() === 'fisio');
  public enModoPaciente = computed(() => this._rolUsuario() === 'paciente');

  // === CAPACIDAD (estático, derivado del usuario) ===
  public tieneCapacidadFisio = computed(
    () => this._usuario()?.esFisio ?? false,
  );
  public tieneCapacidadPaciente = computed(
    () => this._usuario()?.esPaciente ?? false,
  );
  public esAdmin = computed(() =>
    (this._usuario()?.clinicas ?? []).some((c) => c.puesto === 'admin'),
  );

  // === REGLAS DE NEGOCIO (semánticas, basadas en modo) ===
  // Si en el futuro la regla cambia (ej. admins en modo paciente sí pueden
  // crear planes), se modifica solo el computed correspondiente.
  public puedeGestionarPacientes = computed(() => this.enModoFisio());
  public puedeCrearPlanes = computed(() => this.enModoFisio());
  public puedeCrearRutinas = computed(() => this.enModoFisio());
  public puedeEditarRecursos = computed(() => this.enModoFisio());
  public puedeRealizarSesion = computed(() => this.enModoPaciente());
  public puedeAsignarResponsables = computed(
    () => this.enModoFisio() && this.esAdmin(),
  );
  public puedeRecibirNotificaciones = computed(() => this.enModoFisio());

  private convex = inject(ConvexService);
  private betterAuth = inject(BetterAuthService);

  // Granulares por clínica (no son computeds porque parametrizan)
  esAdminEnClinica(clinicaId: string): boolean {
    return (this._usuario()?.clinicas ?? []).some(
      (c) => c.clinicId === clinicaId && c.puesto === 'admin',
    );
  }

  tienePuestoEnClinica(clinicaId: string, puesto: Puesto): boolean {
    return (this._usuario()?.clinicas ?? []).some(
      (c) => c.clinicId === clinicaId && c.puesto === puesto,
    );
  }

  setRolUsuario(rol: RolUsuario) {
    this._rolUsuario.set(rol);
    // Solo persistimos preferencia si el usuario puede alternar (fisios).
    // Para pacientes puros la preferencia es siempre 'paciente' y no debe
    // persistirse para no quedar inconsistente si en el futuro adquieren rol fisio.
    if (this.puedeAlternarModo()) {
      this.guardarModoPersistido(rol);
    }
  }

  toggleRolUsuario() {
    const next: RolUsuario =
      this._rolUsuario() === 'fisio' ? 'paciente' : 'fisio';
    this.setRolUsuario(next);
  }

  private leerModoPersistido(): RolUsuario | null {
    try {
      const v = localStorage.getItem(this.MODO_STORAGE_KEY);
      return v === 'fisio' || v === 'paciente' ? v : null;
    } catch {
      return null;
    }
  }

  private guardarModoPersistido(rol: RolUsuario): void {
    try {
      localStorage.setItem(this.MODO_STORAGE_KEY, rol);
    } catch {
      /* ignore */
    }
  }

  private limpiarModoPersistido(): void {
    try {
      localStorage.removeItem(this.MODO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  inicializarApp() {
    this.cargarMiUsuario();
  }

  async refreshUsuario() {
    return this.cargarMiUsuario();
  }

  /**
   * Limpia el usuario actual del estado (sin tocar la sesión Better-Auth).
   */
  limpiar(): void {
    this._usuario.set(null);
    this._error.set(null);
    localStorage.removeItem('carrito:last_fisio_id');
    this.limpiarModoPersistido();
  }

  async cargarMiUsuario(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      if (!this.betterAuth.hasStoredSession()) {
        this._usuario.set(null);
        return;
      }

      const convexUser = await this.convex.query(api.users.queries.me, {});
      if (!convexUser) {
        this._usuario.set(null);
        return;
      }

      const usuario = this.transformarUsuarioConvex(convexUser);
      this._usuario.set(usuario);

      if (usuario.esFisio) {
        localStorage.setItem('carrito:last_fisio_id', usuario.id);
      } else {
        localStorage.removeItem('carrito:last_fisio_id');
      }
    } catch (err: unknown) {
      console.error('Error al cargar el usuario:', err);
      this._error.set('No se pudo cargar el usuario');
      this._usuario.set(null);
      localStorage.removeItem('carrito:last_fisio_id');
    } finally {
      const u = this._usuario();
      // Cualquier fisio puede alternar entre modos. Los pacientes puros no.
      const puedeAlternar = !!u?.esFisio;
      this.puedeAlternarModo.set(puedeAlternar);

      if (puedeAlternar) {
        const persistido = this.leerModoPersistido();
        this._rolUsuario.set(persistido ?? 'fisio');
        if (!persistido) this.guardarModoPersistido('fisio');
      } else {
        this._rolUsuario.set('paciente');
        this.limpiarModoPersistido();
      }

      this._loading.set(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformarUsuarioConvex(u: any): Usuario {
    const clinicas =
      u.clinicas?.map((c: any) => ({
        clinicId: c.clinicId ?? '',
        puesto: (c.puesto ?? null) as Puesto | null,
      })) || [];

    // Si vienen `esFisio`/`esPaciente` en el doc usamos esos. Si no, los
    // computamos desde las clínicas (caso de queries que no enriquecen flags).
    let esFisio = u.esFisio;
    let esPaciente = u.esPaciente;
    if (esFisio === undefined && esPaciente === undefined) {
      const computed = this.computeRoleFromClinics(clinicas);
      esFisio = computed.esFisio;
      esPaciente = computed.esPaciente;
    }

    return {
      id: u._id,
      convexId: u._id,
      avatar: u.avatar ?? null,
      avatar_url: u.avatar ? rawAssetUrl(u.avatar) : undefined,
      first_name: u.firstName ?? '',
      last_name: u.lastName ?? '',
      email: u.email ?? '',
      email_verified: u.emailVerified ?? false,
      telefono: u.telefono || undefined,
      direccion: u.direccion || undefined,
      postal: u.postal || undefined,
      detalle: u.detalle
        ? {
            dni: u.detalle.dni ?? '',
            telefono: u.detalle.telefono ?? u.telefono ?? '',
            direccion: u.detalle.direccion ?? u.direccion ?? '',
            postal: u.detalle.postal ?? u.postal ?? '',
          }
        : null,
      clinicas,
      esFisio: esFisio ?? false,
      esPaciente: esPaciente ?? true,
      numero_colegiado: u.numeroColegiado || undefined,
    };
  }

  private computeRoleFromClinics(
    clinicas: { puesto: Puesto | null }[],
  ): { esFisio: boolean; esPaciente: boolean } {
    if (!clinicas || clinicas.length === 0) {
      return { esFisio: false, esPaciente: true };
    }

    const hasFisioAccess = clinicas.some(
      (c) => c.puesto === 'fisio' || c.puesto === 'admin',
    );
    const hasPacienteAccess = clinicas.some((c) => c.puesto === 'paciente');

    return {
      esFisio: hasFisioAccess,
      esPaciente: hasPacienteAccess || !hasFisioAccess,
    };
  }
}
