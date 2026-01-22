import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AppService } from '../services/app.service';
import { Usuario, UsuarioDirectus } from '../../types/global';
import { environment as env } from '../../environments/environment';

interface DirectusPage<T> {
  data: T[];
}

@Component({
  selector: 'app-selector-paciente',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="material-symbols-outlined text-[#e75c3e]">person_search</mat-icon>
      Seleccionar paciente
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Search -->
      <div class="mb-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Buscar paciente</mat-label>
          <input
            matInput
            [(ngModel)]="busqueda"
            (ngModelChange)="onBusquedaChange($event)"
            placeholder="Nombre o email..."
          />
          <mat-icon matSuffix class="material-symbols-outlined">search</mat-icon>
        </mat-form-field>
      </div>

      @if (isLoading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- Pacientes list -->
      @if (pacientesFiltrados().length === 0 && !isLoading()) {
        <div class="py-8 text-center">
          <mat-icon class="material-symbols-outlined icon-large text-zinc-300">
            person_off
          </mat-icon>
          <p class="mt-2 text-zinc-500">No se encontraron pacientes</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (paciente of pacientesFiltrados(); track paciente.id) {
            <button
              type="button"
              class="paciente-btn w-full rounded-lg border p-3 text-left transition-colors hover:border-[#e75c3e]/50 hover:bg-[#e75c3e]/5"
              [class.selected]="selectedId() === paciente.id"
              (click)="selectPaciente(paciente)"
            >
              <div class="flex items-center gap-3">
                @if (avatarUrl(paciente)) {
                  <img
                    [src]="avatarUrl(paciente)"
                    alt=""
                    class="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                  />
                } @else {
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white shadow-sm"
                  >
                    <mat-icon class="material-symbols-outlined icon-medium text-zinc-400">
                      person
                    </mat-icon>
                  </div>
                }
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium text-zinc-800">
                    {{ paciente.first_name }} {{ paciente.last_name }}
                  </h4>
                  @if (paciente.email) {
                    <p class="text-sm text-zinc-500 truncate">{{ paciente.email }}</p>
                  }
                </div>
                @if (selectedId() === paciente.id) {
                  <mat-icon class="material-symbols-outlined text-[#e75c3e]">
                    check_circle
                  </mat-icon>
                }
              </div>
            </button>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button
        mat-flat-button
        [disabled]="!selectedId()"
        (click)="confirmar()"
        class="btn-confirmar"
      >
        <mat-icon class="material-symbols-outlined">check</mat-icon>
        Seleccionar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: block;
    }
    .dialog-title {
      display: flex !important;
      align-items: center;
      gap: 0.5rem;
    }
    .dialog-content {
      max-height: 60vh !important;
    }
    .icon-large {
      font-size: 3rem !important;
    }
    .icon-medium {
      font-size: 1.5rem !important;
    }
    .paciente-btn.selected {
      border-color: #e75c3e !important;
      background-color: rgba(231, 92, 62, 0.1) !important;
    }
    .btn-confirmar {
      background-color: #e75c3e !important;
      color: white !important;
    }
  `],
})
export class SelectorPacienteComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<SelectorPacienteComponent>);
  private http = inject(HttpClient);
  private appService = inject(AppService);

  busqueda = '';

  isLoading = signal(false);
  pacientes = signal<Usuario[]>([]);
  selectedId = signal<string | null>(null);
  selectedPaciente = signal<Usuario | null>(null);

  private idsClinicas = computed(() => {
    return this.appService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
  });

  pacientesFiltrados = computed(() => {
    const q = this.busqueda.toLowerCase().trim();
    if (!q) return this.pacientes();
    return this.pacientes().filter(
      (p) =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.loadPacientes();
  }

  async loadPacientes() {
    const cids = this.idsClinicas();
    if (!cids || cids.length === 0) return;

    this.isLoading.set(true);
    try {
      const filter = { clinicas: { id_clinica: { _in: cids } } };

      const response = await firstValueFrom(
        this.http.get<DirectusPage<UsuarioDirectus>>(
          `${env.DIRECTUS_URL}/users`,
          {
            params: {
              fields:
                'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.puestos.Puestos_id.puesto,clinicas.puestos.Puestos_id.id,is_cliente,is_fisio,telefono,direccion',
              sort: 'first_name,last_name',
              limit: '200',
              filter: JSON.stringify(filter),
            },
          }
        )
      );

      const usuarios: Usuario[] = (response?.data ?? []).map((u) =>
        this.appService.transformarUsuarioDirectus(u)
      );
      this.pacientes.set(usuarios);
    } catch (error) {
      console.error('Error cargando pacientes:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  onBusquedaChange(_value: string) {
    // La busqueda ya es reactiva via computed
  }

  selectPaciente(paciente: Usuario) {
    this.selectedId.set(paciente.id);
    this.selectedPaciente.set(paciente);
  }

  confirmar() {
    if (this.selectedPaciente()) {
      this.dialogRef.close(this.selectedPaciente());
    }
  }

  avatarUrl(p: Usuario): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  }
}
