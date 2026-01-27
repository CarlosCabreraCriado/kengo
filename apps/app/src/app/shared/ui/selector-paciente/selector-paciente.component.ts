import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/services/session.service';
import { Usuario, UsuarioDirectus } from '../../../../types/global';
import { environment as env } from '../../../../environments/environment';

interface DirectusPage<T> {
  data: T[];
}

@Component({
  selector: 'app-selector-paciente',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="selector-dialog">
      <!-- Header -->
      <header class="dialog-header">
        <div class="header-icon">
          <span class="material-symbols-outlined">person_search</span>
        </div>
        <h2 class="header-title">Seleccionar paciente</h2>
        <button type="button" class="close-btn" (click)="cerrar()" aria-label="Cerrar">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <!-- Search -->
      <div class="search-container">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          type="text"
          class="search-input"
          [(ngModel)]="busqueda"
          placeholder="Buscar por nombre o email..."
        />
        @if (busqueda) {
          <button type="button" class="clear-btn" (click)="busqueda = ''">
            <span class="material-symbols-outlined">close</span>
          </button>
        }
      </div>

      <!-- Content -->
      <div class="dialog-content">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <span>Cargando pacientes...</span>
          </div>
        } @else if (pacientesFiltrados().length === 0) {
          <div class="empty-state">
            <span class="material-symbols-outlined empty-icon">person_off</span>
            <p>No se encontraron pacientes</p>
          </div>
        } @else {
          <div class="pacientes-list">
            @for (paciente of pacientesFiltrados(); track paciente.id) {
              <button
                type="button"
                class="paciente-item"
                [class.selected]="selectedId() === paciente.id"
                (click)="selectPaciente(paciente)"
              >
                @if (avatarUrl(paciente)) {
                  <img
                    [src]="avatarUrl(paciente)"
                    alt=""
                    class="paciente-avatar"
                  />
                } @else {
                  <div class="paciente-avatar-placeholder">
                    <span class="material-symbols-outlined">person</span>
                  </div>
                }
                <div class="paciente-info">
                  <span class="paciente-name">
                    {{ paciente.first_name }} {{ paciente.last_name }}
                  </span>
                  @if (paciente.email) {
                    <span class="paciente-email">{{ paciente.email }}</span>
                  }
                </div>
                @if (selectedId() === paciente.id) {
                  <span class="material-symbols-outlined check-icon">check_circle</span>
                }
              </button>
            }
          </div>
        }
      </div>

      <!-- Footer -->
      <footer class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="cerrar()">
          Cancelar
        </button>
        <button
          type="button"
          class="btn-confirm"
          [disabled]="!selectedId()"
          (click)="confirmar()"
        >
          <span class="material-symbols-outlined">check</span>
          Seleccionar
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .selector-dialog {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 500px;
      max-height: 80vh;
      margin: auto;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .header-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, rgba(231, 92, 62, 0.12) 0%, rgba(239, 192, 72, 0.08) 100%);
    }

    .header-icon .material-symbols-outlined {
      font-size: 1.25rem;
      color: #e75c3e;
    }

    .header-title {
      flex: 1;
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #27272a;
    }

    .close-btn {
      width: 2.25rem;
      height: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #71717a;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #27272a;
    }

    .search-container {
      position: relative;
      margin: 1rem 1.5rem;
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.25rem;
      color: #a1a1aa;
    }

    .search-input {
      width: 100%;
      padding: 0.875rem 2.75rem 0.875rem 3rem;
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      border-radius: 9999px;
      font-size: 0.9375rem;
      background: rgba(255, 255, 255, 0.8);
      color: #27272a;
      transition: all 0.2s ease;
    }

    .search-input::placeholder {
      color: #a1a1aa;
    }

    .search-input:focus {
      outline: none;
      border-color: #e75c3e;
      box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.1);
    }

    .clear-btn {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.05);
      color: #71717a;
      cursor: pointer;
    }

    .clear-btn .material-symbols-outlined {
      font-size: 1rem;
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 0 1.5rem;
      max-height: 50vh;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      gap: 1rem;
      color: #71717a;
    }

    .spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(231, 92, 62, 0.2);
      border-top-color: #e75c3e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }

    .empty-icon {
      font-size: 3.5rem;
      color: #d4d4d8;
      margin-bottom: 0.75rem;
    }

    .empty-state p {
      margin: 0;
      color: #71717a;
    }

    .pacientes-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-bottom: 1rem;
    }

    .paciente-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      width: 100%;
      padding: 0.875rem;
      border: 1.5px solid rgba(0, 0, 0, 0.06);
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .paciente-item:hover {
      border-color: rgba(231, 92, 62, 0.3);
      background: rgba(231, 92, 62, 0.04);
    }

    .paciente-item.selected {
      border-color: #e75c3e;
      background: rgba(231, 92, 62, 0.08);
    }

    .paciente-avatar {
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .paciente-avatar-placeholder {
      width: 3rem;
      height: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: linear-gradient(135deg, #e4e4e7 0%, #d4d4d8 100%);
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .paciente-avatar-placeholder .material-symbols-outlined {
      font-size: 1.5rem;
      color: #a1a1aa;
    }

    .paciente-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .paciente-name {
      font-weight: 500;
      color: #27272a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .paciente-email {
      font-size: 0.8125rem;
      color: #71717a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .check-icon {
      font-size: 1.5rem;
      color: #e75c3e;
      font-variation-settings: "FILL" 1;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .btn-cancel,
    .btn-confirm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel {
      background: transparent;
      border: 1.5px solid rgba(0, 0, 0, 0.1);
      color: #52525b;
    }

    .btn-cancel:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.15);
    }

    .btn-confirm {
      background: linear-gradient(135deg, #e75c3e 0%, #c94a2f 100%);
      border: none;
      color: white;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.35);
    }

    .btn-confirm:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(231, 92, 62, 0.45);
    }

    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-confirm .material-symbols-outlined {
      font-size: 1.125rem;
    }
  `],
})
export class SelectorPacienteComponent implements OnInit {
  private dialogRef = inject(DialogRef<Usuario>);
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);

  busqueda = '';

  isLoading = signal(false);
  pacientes = signal<Usuario[]>([]);
  selectedId = signal<string | null>(null);
  selectedPaciente = signal<Usuario | null>(null);

  private idsClinicas = computed(() => {
    return this.sessionService.usuario()?.clinicas.map((c) => c.id_clinica) || [];
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
                'id,first_name,last_name,email,avatar,clinicas.id_clinica,clinicas.id_puesto,clinicas.puesto.id,clinicas.puesto.puesto,telefono,direccion',
              sort: 'first_name,last_name',
              limit: '200',
              filter: JSON.stringify(filter),
            },
          }
        )
      );

      const usuarios: Usuario[] = (response?.data ?? []).map((u) =>
        this.sessionService.transformarUsuarioDirectus(u)
      );
      this.pacientes.set(usuarios);
    } catch (error) {
      console.error('Error cargando pacientes:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectPaciente(paciente: Usuario) {
    this.selectedId.set(paciente.id);
    this.selectedPaciente.set(paciente);
  }

  confirmar() {
    const paciente = this.selectedPaciente();
    if (paciente) {
      this.dialogRef.close(paciente);
    }
  }

  cerrar() {
    this.dialogRef.close();
  }

  avatarUrl(p: Usuario): string | null {
    const id_avatar = p?.avatar;
    return id_avatar
      ? `${env.DIRECTUS_URL}/assets/${id_avatar}?fit=cover&width=96&height=96&quality=80`
      : null;
  }
}
