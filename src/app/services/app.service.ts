import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { signal, computed, inject } from '@angular/core';
import { environment as env } from '../../environments/environment';
import { RolUsuario } from '../../types/global';

import { firstValueFrom } from 'rxjs';

//Modelos:
import { Usuario, UsuarioDirectus } from '../../types/global';

@Injectable({ providedIn: 'root' })
export class AppService {
  private _rolUsuario = signal<RolUsuario>('fisio');
  public rolUsuario = this._rolUsuario;

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
              'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.puestos.Puestos_id.puesto,clinicas.puestos.Puestos_id.id,is_cliente,is_fisio,telefono,direccion,postal',
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
    return {
      id: u.id,
      avatar: u.avatar ?? null,
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      email: u.email ?? '',
      telefono: u.telefono || undefined,
      direccion: u.direccion || undefined,
      magic_link_url: u.magic_link_url || undefined,
      postal: u.postal || undefined,
      detalle: null, // aquí podrás cargar "detalle_usuario" más abajo
      clinicas:
        u.clinicas?.map((c) => ({
          id_clinica: c.id_clinica,
          puestos:
            c.puestos?.map((p) => ({
              id_puesto: p.Puestos_id?.id, // asumiendo que puesto es string
              puesto: p.Puestos_id?.puesto || '',
            })) || [],
        })) || [],
      esFisio: !!u.is_fisio,
      esPaciente: !!u.is_cliente,
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
