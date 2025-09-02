import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { signal, computed, inject } from '@angular/core';
import { environment as env } from '../../environments/environment';
import { RolUsuario } from '../../types/global';

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
              'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.puestos.Puestos_id.puesto,clinicas.puestos.Puestos_id.id,is_cliente,is_fisio,telefono,direccion',
          },
        })
        .toPromise();

      if (res && res.data) {
        const usuario: Usuario = {
          id: res.data['id'],
          avatar: res.data['avatar'] ?? null,
          first_name: res.data['first_name'] ?? '',
          last_name: res.data['last_name'] ?? '',
          email: res.data['email'] ?? '',
          telefono: res.data['telefono'] || undefined,
          direccion: res.data['direccion'] || undefined,
          detalle: null, // aquí podrás cargar "detalle_usuario" más abajo
          clinicas:
            res.data.clinicas?.map((c) => ({
              id_clinica: c.id_clinica,
              puestos:
                c.puestos?.map((p) => ({
                  id_puesto: p.Puestos_id?.id, // asumiendo que puesto es string
                  puesto: p.Puestos_id?.puesto || '',
                })) || [],
            })) || [],
          esCliente: !!res.data['is_cliente'],
          esPaciente: !!res.data['is_paciente'],
        };

        this._usuario.set(usuario);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err: unknown) {
      console.error('Error al cargar el usuario:', err);
      this._error.set('No se pudo cargar el usuario');
      this._usuario.set(null);
      this.router.navigate(['/login']);
    } finally {
      this._loading.set(false);
    }
  }
}
