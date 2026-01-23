import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { httpResource } from '@angular/common/http';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment as env } from '../../../../../environments/environment';

// Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { Usuario, UsuarioDirectus } from '../../../../../types/global';

interface DialogData {
  idsClinicas: ID[]; // clínicas que puede ver/asignar el usuario actual
  usuario?: Usuario; // si viene -> modo edición
}

type ID = string | number;
interface Clinica {
  id_clinica: ID;
  nombre?: string;
}
interface DirectusPage<T> {
  data: T[];
}

interface DirectusItem<T> {
  data: T;
}

@Component({
  selector: 'app-add-paciente',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './add-paciente.component.html',
  styleUrl: './add-paciente.component.css',
})
export class AddPacienteDialogComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private ref = inject(MatDialogRef<AddPacienteDialogComponent>);

  private currentLinks = new Map<ID, ID>(); // (id_clinica -> row id)

  private data = inject<DialogData>(MAT_DIALOG_DATA);

  loading = signal(false);
  error = signal<string | null>(null);
  isEdit = computed(() => !!this.data.usuario);

  // Carga de clínicas disponibles (filtradas por las del usuario actual)
  readonly clinicasRes = httpResource<Clinica[]>(
    () => ({
      url: `${env.DIRECTUS_URL}/items/clinicas`,
      method: 'GET',
      params: {
        fields: 'id_clinica,nombre',
        ...(this.data.idsClinicas?.length
          ? { filter: JSON.stringify({ id: { _in: this.data.idsClinicas } }) }
          : {}),
      },
    }),
    {
      parse: (v) => {
        const result = (v as DirectusPage<Clinica>)?.data ?? [];
        console.log('Clínicas disponibles:', result);
        this.form.get('clinicas')?.enable({ emitEvent: false }); // habilitar select
        return result;
      },
      defaultValue: [],
    },
  );

  form = this.fb.group({
    first_name: [this.data.usuario?.first_name ?? '', Validators.required],
    last_name: [this.data.usuario?.last_name ?? ''],
    email: [
      this.data.usuario?.email ?? '',
      [Validators.required, Validators.email],
    ],
    telefono: [this.data.usuario?.telefono ?? ''],
    clinicas: [
      { value: (this.data.idsClinicas ?? []) as ID[], disabled: true },
    ],
  });

  constructor() {
    // si es edición, cargar sus enlaces actuales (usuarios_clinicas) y preseleccionar
    if (this.isEdit()) {
      void this.loadUserClinics(this.data.usuario!.id);
    }
  }

  close(result?: unknown) {
    this.ref.close(result);
  }

  // ====== Carga enlaces actuales (solo edición) ======
  private async loadUserClinics(userId: string) {
    try {
      const params = new HttpParams()
        .set('fields', 'id,id_clinica')
        .set('filter', JSON.stringify({ id_usuario: { _eq: userId } }))
        .set('limit', '500');
      const res = await this.http
        .get<
          DirectusPage<{ id: ID; id_clinica: ID }>
        >(`${env.DIRECTUS_URL}/items/usuarios_clinicas`, { params })
        .toPromise();

      this.currentLinks.clear();
      const ids = (res?.data ?? []).map((row) => {
        this.currentLinks.set(row.id_clinica, row.id); // clinica -> row id
        return row.id_clinica;
      });

      this.form.patchValue({ clinicas: ids }, { emitEvent: false });
    } catch (e) {
      console.warn('No se pudieron cargar las clínicas del usuario:', e);
    }
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const tempPassword = this.genTempPassword();
    const baseUser = {
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      telefono: v.telefono,
      password: tempPassword, // Directus exige password al crear usuario
    };

    try {
      if (!this.isEdit()) {
        // ---- CREAR
        const payload = {
          ...baseUser,
          role: env.ROL_PACIENTE_ID,
          is_cliente: true,
          clinicas: (v.clinicas || []).map((cid: ID) => ({
            id_clinica: cid,
            puesto: 2,
          })),
        };

        const res = await this.http
          .post<DirectusItem<UsuarioDirectus>>(
            `${env.DIRECTUS_URL}/users`,
            payload,
            // , { withCredentials: true }
          )
          .toPromise();

        // >>> NUEVO: genera el Magic Link y abre el QR
        const user = res?.data;

        if (!user) throw new Error('No se pudo crear el usuario.');

        await this.http
          .post<{
            url: string;
          }>(`${env.API_URL}/crearMagicLink`, {
            email: user.email,
            password: tempPassword,
            userId: user.id,
          })
          .toPromise();

        this.close({ created: res?.data });
      } else {
        // ---- EDITAR
        const userId = this.data.usuario!.id;

        // 1) PATCH datos básicos
        await this.http
          .patch<DirectusItem<UsuarioDirectus>>(
            `${env.DIRECTUS_URL}/users/${userId}`,
            baseUser,
            // , { withCredentials: true }
          )
          .toPromise();

        // 2) Sincronizar clínicas (tabla puente) -> diff
        const targetIds = new Set<ID>(v.clinicas || []);
        const currentIds = new Set<ID>([...this.currentLinks.keys()]);

        const toAdd: ID[] = [...targetIds].filter((x) => !currentIds.has(x));
        const toRemove: ID[] = [...currentIds].filter((x) => !targetIds.has(x));

        // Crear enlaces nuevos (puesto=2)
        await Promise.all(
          toAdd.map((cid) =>
            this.http
              .post(
                `${env.DIRECTUS_URL}/items/usuarios_clinicas`,
                { id_usuario: userId, id_clinica: cid, puesto: 2 },
                // , { withCredentials: true }
              )
              .toPromise(),
          ),
        );

        // Borrar enlaces que sobran
        await Promise.all(
          toRemove.map((cid) => {
            const rowId = this.currentLinks.get(cid);
            return rowId
              ? this.http
                  .delete(
                    `${env.DIRECTUS_URL}/items/usuarios_clinicas/${rowId}`,
                    // , { withCredentials: true }
                  )
                  .toPromise()
              : Promise.resolve();
          }),
        );

        this.close({ updated: true });
      }
    } catch (e: unknown) {
      console.error(e);
      /*
      this.error.set(
        e?.error?.errors?.[0]?.message ?? 'No se pudieron guardar los cambios.',
      );
      */
    } finally {
      this.loading.set(false);
    }
  }

  genTempPassword(len = 12) {
    const charset =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?';

    // Web Crypto del navegador (sin import)
    const webCrypto = globalThis.crypto;
    if (!webCrypto?.getRandomValues) {
      // Fallback (menos seguro). Idealmente, evita esta rama en prod.
      return Array.from(
        { length: len },
        () => charset[Math.floor(Math.random() * charset.length)],
      ).join('');
    }

    const bytes = new Uint8Array(len);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => charset[b % charset.length]).join('');
  }
}
