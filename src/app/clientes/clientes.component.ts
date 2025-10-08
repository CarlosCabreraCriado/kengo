import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment as env } from '../../environments/environment';

//Angular Material:
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';

import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

//Componente Add-Paciente:
import { AddPacienteDialogComponent } from '../add-paciente/add-paciente.component';
import { QrDialogComponent } from '../dialogo-qr/dialogo-qr.component';

//Servicios:
import { AppService } from '../services/app.service';
import { PlanBuilderService } from '../services/plan-builder.service';

import { Usuario, UsuarioDirectus } from '../../types/global';

interface DirectusPage<T> {
  data: T[];
  meta?: { filter_count?: number };
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressBarModule,
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css',
})
export class ClientesComponent {
  private appService = inject(AppService);
  private dialog = inject(MatDialog);
  public planBuilderService = inject(PlanBuilderService);
  private authService = inject(AuthService);

  public idsClinicas = computed(() => {
    if (this.appService.usuario() == null) return null;
    return this.appService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
  });

  private readonly busqueda = signal('');

  readonly pacientes = computed(() => this.pacientesRes.value());
  readonly pacientesRes = httpResource<Usuario[]>(
    () => {
      const cid = this.idsClinicas();
      if (!cid) return undefined; // hasta que tengamos clínica, no dispares la llamada

      if (cid.length == 0) return undefined; // hasta que tengamos clínica, no dispares la llamada

      const q = this.busqueda().trim(); // <-- hace reactivo el resource
      // Construimos el filter combinando condiciones con _and
      const andFilters: unknown[] = [
        { clinicas: { id_clinica: { _in: cid } } },
      ];

      if (q) {
        andFilters.push({
          _or: [
            { first_name: { _icontains: q } },
            { last_name: { _icontains: q } },
            { email: { _icontains: q } },
          ],
        });
      }

      const filter =
        andFilters.length === 1 ? andFilters[0] : { _and: andFilters };

      return {
        url: `${env.DIRECTUS_URL}/users`,
        method: 'GET',
        params: {
          fields:
            'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.puestos.Puestos_id.puesto,magic_link_url, clinicas.puestos.Puestos_id.id, is_cliente,is_fisio, telefono, direccion',
          sort: 'first_name,last_name',
          limit: '200', // ajusta/añade paginación si lo necesitas
          filter: JSON.stringify(filter),
          meta: 'filter_count',
        },
        // withCredentials: true, // ⬅️ descomenta si usas cookie de sesión
      };
    },
    {
      defaultValue: [],
      parse: (v: unknown): Usuario[] => {
        const resultado = (v as DirectusPage<UsuarioDirectus>)?.data ?? [];
        const usuarios: Usuario[] = [];
        for (const usuario of resultado) {
          usuarios.push(this.appService.transformarUsuarioDirectus(usuario));
        }
        console.log('Pacientes cargados:', resultado);
        return usuarios;
      },
    },
  );

  avatarUrl(p: Usuario): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  }

  onBuscar = (term: string) => {
    this.busqueda.set((term ?? '').trim());
  };

  seleccionarPaciente(p: Usuario) {
    this.planBuilderService.cambiarPaciente(p);
  }

  openAddPaciente() {
    this.dialog
      .open(AddPacienteDialogComponent, {
        width: '520px',
        data: { clinicIds: this.idsClinicas() }, // clínicas del usuario actual
      })
      .afterClosed()
      .subscribe((r) => {
        if (r?.created || r?.updated) this.pacientesRes.reload();
      });
  }

  openEditarPaciente(p: Usuario) {
    this.dialog
      .open(AddPacienteDialogComponent, {
        width: '520px',
        data: { clinicIds: this.idsClinicas(), usuario: p }, // pasa el usuario a editar
      })
      .afterClosed()
      .subscribe((r) => {
        if (r?.updated) this.pacientesRes.reload();
      });
  }

  reload() {
    this.pacientesRes.reload();
  }

  // Helpers
  fullName(u: UsuarioDirectus) {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : u.email || u.id;
  }

  async generarQr(url: string) {
    try {
      if (url) this.openDialogoQR(url);
    } catch (e) {
      console.error('Error generando QR:', e);
    }
  }

  public openDialogoQR(url: string) {
    this.dialog.open(QrDialogComponent, {
      data: { url },
      // disableClose: false, // si quieres que pueda cerrarse tocando fuera
      // width: '360px',
    });
  }
}
