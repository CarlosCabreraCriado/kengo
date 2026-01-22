import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment as env } from '../../environments/environment';
import { Usuario, UsuarioDirectus } from '../../types/global';
import { AppService } from '../services/app.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface DirectusResponse<T> {
  data: T[];
}

@Component({
  selector: 'app-fisios',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  templateUrl: './fisios.component.html',
  styleUrl: './fisios.component.css',
})
export class FisiosComponent {
  private http = inject(HttpClient);
  private appService = inject(AppService);

  public cargando = signal(true);
  public fisios = signal<Usuario[]>([]);
  public error = signal<string | null>(null);

  constructor() {
    this.cargarFisios();
  }

  private async cargarFisios(): Promise<void> {
    try {
      this.cargando.set(true);
      this.error.set(null);

      const params = {
        fields: [
          'id',
          'first_name',
          'last_name',
          'email',
          'avatar',
          'telefono',
          'numero_colegiado',
          'clinicas.id_clinica',
          'clinicas.puestos.Puestos_id.id',
          'clinicas.puestos.Puestos_id.puesto',
          'is_fisio',
          'is_cliente',
        ].join(','),
        filter: JSON.stringify({
          is_fisio: { _eq: true },
        }),
        sort: 'first_name,last_name',
        limit: '100',
      };

      const response = await this.http
        .get<DirectusResponse<UsuarioDirectus>>(`${env.DIRECTUS_URL}/users`, {
          params,
          withCredentials: true,
        })
        .toPromise();

      if (response?.data) {
        const fisiosTransformados = response.data.map((u) =>
          this.appService.transformarUsuarioDirectus(u)
        );
        this.fisios.set(fisiosTransformados);
      }
    } catch (err) {
      console.error('Error al cargar fisioterapeutas:', err);
      this.error.set('No se pudieron cargar los fisioterapeutas');
    } finally {
      this.cargando.set(false);
    }
  }
}
