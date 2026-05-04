import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import {
  Ui2DialogHostComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogContentComponent,
  Ui2DialogActionsComponent,
  Ui2ProgressBarComponent,
  Ui2InputComponent,
  Ui2ButtonComponent,
  Ui2CheckboxComponent,
  Ui2SectionLabelComponent,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';
import { emailRequired } from '../../../../shared';

import { Usuario } from '../../../../../types/global';
import { ConvexService } from '../../../../core/convex/convex.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { api } from '../../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../../convex/_generated/dataModel';

interface DialogData {
  idsClinicas: ID[]; // Convex Ids de las clínicas que puede ver/asignar el usuario actual
  usuario?: Usuario; // si viene -> modo edición
}

type ID = string | number;
interface Clinica {
  id: ID;
  nombre?: string;
}

@Component({
  selector: 'app-add-paciente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ProgressBarComponent,
    Ui2InputComponent,
    Ui2ButtonComponent,
    Ui2CheckboxComponent,
    Ui2SectionLabelComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './add-paciente.component.html',
  styleUrl: './add-paciente.component.css',
})
export class AddPacienteDialogComponent {
  private fb = inject(FormBuilder);
  protected dialogRef = inject(DialogRef<{ created?: unknown; updated?: boolean }>);
  private data = inject<DialogData>(DIALOG_DATA);
  private convex = inject(ConvexService);
  private clinicasService = inject(ClinicasService);

  // Mapa: clinicId -> membershipId (Convex Id<"clinicMemberships">)
  private currentLinks = new Map<ID, string>();

  loading = signal(false);
  error = signal<string | null>(null);
  isEdit = computed(() => !!this.data.usuario);

  // Clínicas disponibles (filtradas por las del usuario actual). Reactivo via ClinicasService.
  readonly clinicasRes = {
    value: computed<Clinica[]>(() => {
      const all = this.clinicasService.misClinicasRes.value() ?? [];
      const allowedIds = this.data.idsClinicas?.length
        ? new Set(this.data.idsClinicas.map((id) => String(id)))
        : null;
      const filtered = all.filter(
        (c) => !allowedIds || allowedIds.has(String(c.id)),
      );
      return filtered.map((c) => ({ id: c.id, nombre: c.nombre }));
    }),
    isLoading: computed(() => {
      const all = this.clinicasService.misClinicasRes.value();
      return !all || all.length === 0;
    }),
  };

  get emailError(): string | null {
    const ctrl = this.form.controls.email;
    return ctrl.invalid && ctrl.touched ? 'Email inválido' : null;
  }

  // Selección reactiva de clínicas
  readonly selectedClinicIds = signal<Set<string>>(
    new Set((this.data.idsClinicas ?? []).map(String)),
  );

  readonly selectedCount = computed(() => this.selectedClinicIds().size);

  isClinicSelected(id: ID): boolean {
    return this.selectedClinicIds().has(String(id));
  }

  toggleClinic(id: ID, checked: boolean) {
    const next = new Set(this.selectedClinicIds());
    const key = String(id);
    if (checked) next.add(key);
    else next.delete(key);
    this.selectedClinicIds.set(next);
  }

  form = this.fb.group({
    first_name: [this.data.usuario?.first_name ?? '', Validators.required],
    last_name: [this.data.usuario?.last_name ?? ''],
    email: [this.data.usuario?.email ?? '', emailRequired],
    telefono: [this.data.usuario?.telefono ?? ''],
  });

  constructor() {
    // si es edición, cargar sus enlaces actuales (usuarios_clinicas) y preseleccionar
    if (this.isEdit()) {
      void this.loadUserClinics(this.data.usuario!.id);
    }
  }

  close(result?: { created?: unknown; updated?: boolean }) {
    this.dialogRef.close(result);
  }

  // ====== Carga enlaces actuales (solo edición) ======
  private async loadUserClinics(userId: string) {
    try {
      const memberships = await this.convex.query(
        api.clinicMemberships.queries.listByUser,
        { userId: userId as Id<'users'> },
      );

      this.currentLinks.clear();
      const ids: string[] = [];
      for (const m of memberships ?? []) {
        if (m.puesto !== 'paciente') continue;
        this.currentLinks.set(m.clinicId, m._id as unknown as string);
        ids.push(String(m.clinicId));
      }

      this.selectedClinicIds.set(new Set(ids));
    } catch (e) {
      console.warn('No se pudieron cargar las clínicas del usuario:', e);
    }
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();

    try {
      if (!this.isEdit()) {
        // ---- CREAR — usamos createPatient para la primera clínica.
        // Si hay varias clínicas seleccionadas, añadimos las demás vía add().
        const selectedClinics = [...this.selectedClinicIds()];
        if (selectedClinics.length === 0) {
          throw new Error('Debe seleccionar al menos una clínica.');
        }

        const primaryClinicId = String(selectedClinics[0]);

        const result = await this.convex.action(api.users.actions.createPatient, {
          firstName: v.first_name ?? '',
          lastName: v.last_name ?? '',
          email: v.email ?? '',
          telefono: v.telefono || undefined,
          password: this.genTempPassword(),
          clinicId: primaryClinicId as Id<'clinics'>,
          generateAccessToken: true,
        });

        if (!result.success) {
          throw new Error(result.error || 'No se pudo crear el usuario.');
        }

        if (selectedClinics.length > 1) {
          await Promise.all(
            selectedClinics.slice(1).map(async (cid) => {
              return this.convex.mutation(api.clinicMemberships.mutations.add, {
                userId: result.userId as Id<'users'>,
                clinicId: String(cid) as Id<'clinics'>,
                puesto: 'paciente',
              });
            }),
          );
        }

        this.close({ created: { id: result.userId } });
      } else {
        // ---- EDITAR
        const userId = this.data.usuario!.id;

        const targetIds = new Set<string>([...this.selectedClinicIds()]);
        const currentIds = new Set<string>(
          [...this.currentLinks.keys()].map(String),
        );

        const toAdd: string[] = [...targetIds].filter((x) => !currentIds.has(x));
        const toRemove: ID[] = [...this.currentLinks.keys()].filter(
          (x) => !targetIds.has(String(x)),
        );

        await this.convex.mutation(api.users.mutations.updatePatient, {
          patientId: userId as Id<'users'>,
          firstName: v.first_name ?? undefined,
          lastName: v.last_name ?? undefined,
          email: v.email ?? undefined,
          telefono: v.telefono || undefined,
        });

        await Promise.all(
          toAdd.map((cid) =>
            this.convex.mutation(api.clinicMemberships.mutations.add, {
              userId: userId as Id<'users'>,
              clinicId: String(cid) as Id<'clinics'>,
              puesto: 'paciente',
            }),
          ),
        );

        // 3) Eliminar membresías sobrantes
        await Promise.all(
          toRemove.map((cid) => {
            const membershipId = this.currentLinks.get(cid);
            return membershipId
              ? this.convex.mutation(api.clinicMemberships.mutations.remove, {
                  membershipId: membershipId as Id<'clinicMemberships'>,
                })
              : Promise.resolve();
          }),
        );

        this.close({ updated: true });
      }
    } catch (e: unknown) {
      console.error(e);
      this.error.set('No se pudieron guardar los cambios.');
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
