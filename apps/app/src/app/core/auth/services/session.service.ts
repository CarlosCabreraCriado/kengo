import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { signal, computed, inject } from '@angular/core';
import { environment as env } from '../../../../environments/environment';
import {
  RolUsuario,
  Usuario,
  UsuarioDirectus,
  ClinicaUsuarioDirectus,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_PACIENTE,
  PUESTO_ADMINISTRADOR,
} from '../../../../types/global';
import { firstValueFrom } from 'rxjs';

/**
 * SessionService (formerly AppService)
 * Manages the current user session state
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private _rolUsuario = signal<RolUsuario>('fisio');
  public rolUsuario = this._rolUsuario;
  public permitirMultiRol = signal(false);

  //Señales privadas:
  private _usuario = signal<Usuario | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  //Señales publicas (solo lectura):
  public usuario = computed(() => this._usuario());
  public isLoggedIn = computed(() => this._usuario() !== null);
  public loading = computed(() => this._loading());
  public error = computed(() => this._error());
  public nombreCompleto = computed(() => {
    const u = this._usuario();
    return u ? `${u.first_name} ${u.last_name}`.trim() : '';
  });
  public misclinicas = computed(() => this._usuario()?.clinicas ?? []);

  //Servicios:
  private http = inject(HttpClient);
  private router = inject(Router);

  setRolUsuario(rol: RolUsuario) {
    this._rolUsuario.set(rol);
    console.warn('Rol de usuario actualizado:', this.rolUsuario());
  }

  toggleRolUsuario() {
    const current = this._rolUsuario();
    this._rolUsuario.set(current === 'fisio' ? 'paciente' : 'fisio');
  }

  inicializarApp() {
    console.warn('Inicializando app');
    this.cargarMiUsuario();
  }

  async refreshUsuario() {
    return this.cargarMiUsuario();
  }

  async cargarMiUsuario(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.http
        .get<{ data: UsuarioDirectus }>(`${env.DIRECTUS_URL}/users/me`, {
          params: {
            fields:
              'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.id_puesto,clinicas.puesto.id,clinicas.puesto.puesto,telefono,direccion,postal,numero_colegiado',
          },
        })
        .toPromise();

      if (res && res.data) {
        const usuario: Usuario = this.transformarUsuarioDirectus(res.data);

        console.log('Usuario cargado:', usuario);
        this._usuario.set(usuario);
        if (usuario.esFisio) {
          localStorage.setItem('carrito:last_fisio_id', usuario.id);
        } else {
          localStorage.removeItem('carrito:last_fisio_id');
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err: unknown) {
      console.error('Error al cargar el usuario:', err);
      this._error.set('No se pudo cargar el usuario');
      this._usuario.set(null);
      this.router.navigate(['/login']);
      localStorage.removeItem('carrito:last_fisio_id');
    } finally {
      const u = this._usuario();
      if (u?.esFisio && u?.esPaciente) {
        // Usuario con roles mixtos (fisio en una clínica, paciente en otra)
        this._rolUsuario.set('fisio'); // Default a fisio
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

  async uploadFile(file: File, title?: string): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);

    const res = await firstValueFrom(
      this.http.post<{ data: { id: string } }>(
        `${env.DIRECTUS_URL}/files`,
        form,
        {
          // Si usas sesión por cookies:
          withCredentials: true,
        },
      ),
    );
    return res.data.id;
  }

  transformarUsuarioDirectus(u: UsuarioDirectus): Usuario {
    const clinicas =
      u.clinicas?.map((c) => ({
        id_clinica: c.id_clinica,
        id_puesto: c.id_puesto ?? null,
        puesto: c.puesto?.puesto ?? null,
      })) || [];

    // Compute roles from clinic relationships
    const { esFisio, esPaciente } = this.computeRoleFromClinics(u.clinicas || []);

    return {
      id: u.id,
      avatar: u.avatar ?? null,
      avatar_url: u.avatar ? `${env.DIRECTUS_URL}/assets/${u.avatar}` : undefined,
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      email: u.email ?? '',
      telefono: u.telefono || undefined,
      direccion: u.direccion || undefined,
      magic_link_url: u.magic_link_url || undefined,
      postal: u.postal || undefined,
      detalle: null, // aquí podrás cargar "detalle_usuario" más abajo
      clinicas,
      esFisio,
      esPaciente,
      numero_colegiado: u.numero_colegiado || undefined,
    };
  }

  /**
   * Computes user role based on clinic relationships (id_puesto)
   * - Fisioterapeuta (1) or Administrador (4) → esFisio = true
   * - Paciente (2) → esPaciente = true
   * - No clinics → defaults to paciente view
   */
  private computeRoleFromClinics(
    clinicas: ClinicaUsuarioDirectus[],
  ): { esFisio: boolean; esPaciente: boolean } {
    if (!clinicas || clinicas.length === 0) {
      return { esFisio: false, esPaciente: true }; // Sin clínica = paciente
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

  /*
  async updateMe(patch: Record<string, any>): Promise<any> {
    const res = await firstValueFrom(
      this.http.patch<{ data: any }>(`${env.DIRECTUS_URL}/users/me`, patch, {
        withCredentials: true,
        // headers: this.authHeaders
      }),
    );
    return res.data;
  }
  */
}
