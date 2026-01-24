import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment as env } from '../../../../../environments/environment';

//Angular Material:
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';

import { AuthService } from '../../../../core/auth/services/auth.service';

//Componente Add-Paciente:
import { AddPacienteDialogComponent } from '../../components/add-paciente/add-paciente.component';
import { QrDialogComponent } from '../../../../shared/ui/dialogo-qr/dialogo-qr.component';

//Servicios:
import { SessionService } from '../../../../core/auth/services/session.service';
import { PlanBuilderService } from '../../../planes/data-access/plan-builder.service';
import { PlanesService } from '../../../planes/data-access/planes.service';

import { Usuario, UsuarioDirectus } from '../../../../../types/global';

interface DirectusPage<T> {
  data: T[];
  meta?: { filter_count?: number };
}

@Component({
  selector: 'app-pacientes-list',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './pacientes-list.component.html',
  styleUrl: './pacientes-list.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class PacientesListComponent {
  private sessionService = inject(SessionService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  public planBuilderService = inject(PlanBuilderService);
  private planesService = inject(PlanesService);
  private authService = inject(AuthService);
  private breakpointObserver = inject(BreakpointObserver);

  // Signal para alternar vista card/lista
  public vista = signal<'card' | 'lista'>('card');

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe(['(min-width: 1024px)'])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  public idsClinicas = computed(() => {
    if (this.sessionService.usuario() == null) return null;
    return this.sessionService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
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
            'id,first_name,last_name,email,avatar,clinicas.id_clinica.id_clinica,clinicas.id_clinica.nombre,clinicas.puestos.Puestos_id.puesto,magic_link_url,clinicas.puestos.Puestos_id.id,is_cliente,is_fisio,telefono,direccion',
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
          usuarios.push(this.sessionService.transformarUsuarioDirectus(usuario));
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
  fullName(u: Usuario) {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : u.email || u.id;
  }

  getInitials(u: Usuario): string {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
    if (fn) return fn.substring(0, 2).toUpperCase();
    if (ln) return ln.substring(0, 2).toUpperCase();
    if (u.email) return u.email.substring(0, 2).toUpperCase();
    return '??';
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

  verPlanes(p: Usuario) {
    this.planesService.clearFilters();
    this.planesService.setFiltroPaciente(p.id);
    this.router.navigate(['/planes']);
  }

  verDetalle(p: Usuario) {
    this.router.navigate(['/mis-pacientes', p.id]);
  }

  getClinicaNombre(p: Usuario): string | null {
    if (!p.clinicas || p.clinicas.length === 0) return null;
    // Acceder al nombre de la clínica (viene como objeto anidado de Directus)
    const clinica = p.clinicas[0] as any;
    return clinica?.id_clinica?.nombre || null;
  }
}
