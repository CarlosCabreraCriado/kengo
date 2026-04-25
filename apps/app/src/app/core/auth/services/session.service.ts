import { Injectable, signal, computed, inject } from '@angular/core';
import {
  RolUsuario,
  Usuario,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_PACIENTE,
  PUESTO_ADMINISTRADOR,
} from '../../../../types/global';
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
  private _rolUsuario = signal<RolUsuario>('fisio');
  public rolUsuario = this._rolUsuario;
  public permitirMultiRol = signal(false);

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

  private convex = inject(ConvexService);
  private betterAuth = inject(BetterAuthService);

  setRolUsuario(rol: RolUsuario) {
    this._rolUsuario.set(rol);
  }

  toggleRolUsuario() {
    const current = this._rolUsuario();
    this._rolUsuario.set(current === 'fisio' ? 'paciente' : 'fisio');
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
      if (u?.esFisio && u?.esPaciente) {
        this._rolUsuario.set('fisio');
        this.permitirMultiRol.set(true);
      } else if (u?.esFisio) {
        this._rolUsuario.set('fisio');
        this.permitirMultiRol.set(false);
      } else {
        this._rolUsuario.set('paciente');
        this.permitirMultiRol.set(false);
      }

      this._loading.set(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformarUsuarioConvex(u: any): Usuario {
    const clinicas =
      u.clinicas?.map((c: any) => ({
        id_clinica: c.id_clinica ?? 0,
        id_puesto: c.id_puesto ?? null,
        puesto: c.puesto ?? null,
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
      id: u.legacyDirectusId,
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
      detalle: null,
      clinicas,
      esFisio: esFisio ?? false,
      esPaciente: esPaciente ?? true,
      numero_colegiado: u.numeroColegiado || undefined,
    };
  }

  private computeRoleFromClinics(
    clinicas: { id_puesto: number | null }[],
  ): { esFisio: boolean; esPaciente: boolean } {
    if (!clinicas || clinicas.length === 0) {
      return { esFisio: false, esPaciente: true };
    }

    const hasFisioAccess = clinicas.some(
      (c) => c.id_puesto === PUESTO_FISIOTERAPEUTA || c.id_puesto === PUESTO_ADMINISTRADOR,
    );
    const hasPacienteAccess = clinicas.some((c) => c.id_puesto === PUESTO_PACIENTE);

    return {
      esFisio: hasFisioAccess,
      esPaciente: hasPacienteAccess || !hasFisioAccess,
    };
  }
}
