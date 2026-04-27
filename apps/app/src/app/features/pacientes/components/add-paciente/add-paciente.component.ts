import { Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import {
  DialogContainerComponent,
  DialogHeaderComponent,
  DialogContentComponent,
  DialogActionsComponent,
  ProgressBarComponent,
  emailRequired,
} from '../../../../shared';

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
  imports: [
    ReactiveFormsModule,
    DialogContainerComponent,
    DialogHeaderComponent,
    DialogContentComponent,
    DialogActionsComponent,
    ProgressBarComponent,
  ],
  templateUrl: './add-paciente.component.html',
  styleUrl: './add-paciente.component.css',
})
export class AddPacienteDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(DialogRef<{ created?: unknown; updated?: boolean }>);
  private data = inject<DialogData>(DIALOG_DATA);
  private elementRef = inject(ElementRef);
  private convex = inject(ConvexService);
  private clinicasService = inject(ClinicasService);

  // Mapa: clinicId -> membershipId (Convex Id<"clinicMemberships">)
  private currentLinks = new Map<ID, string>();

  loading = signal(false);
  error = signal<string | null>(null);
  isEdit = computed(() => !!this.data.usuario);

  // Estado del desplegable de clínicas
  clinicasDropdownOpen = signal(false);

  // Texto a mostrar en el campo de clínicas
  clinicasDisplayText = computed(() => {
    const selectedIds = this.form.get('clinicas')?.value as ID[] ?? [];
    const clinicas = this.clinicasRes.value() ?? [];

    if (selectedIds.length === 0) return 'Seleccionar clínicas...';

    const nombres = selectedIds
      .map(id => clinicas.find(c => c.id === id)?.nombre ?? `Clínica ${id}`)
      .slice(0, 2);

    if (selectedIds.length > 2) {
      return `${nombres.join(', ')} +${selectedIds.length - 2}`;
    }
    return nombres.join(', ');
  });

  // Cerrar dropdown al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dropdown = this.elementRef.nativeElement.querySelector('.clinicas-dropdown-container');
    if (dropdown && !dropdown.contains(target)) {
      this.clinicasDropdownOpen.set(false);
    }
  }

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
      // Habilitar select en el primer render con datos
      queueMicrotask(() => this.form.get('clinicas')?.enable({ emitEvent: false }));
      return filtered.map((c) => ({ id: c.id, nombre: c.nombre }));
    }),
    isLoading: computed(() => {
      const all = this.clinicasService.misClinicasRes.value();
      return !all || all.length === 0;
    }),
  };

  form = this.fb.group({
    first_name: [this.data.usuario?.first_name ?? '', Validators.required],
    last_name: [this.data.usuario?.last_name ?? ''],
    email: [this.data.usuario?.email ?? '', emailRequired],
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

  close(result?: { created?: unknown; updated?: boolean }) {
    this.dialogRef.close(result);
  }

  toggleClinicasDropdown() {
    if (this.form.get('clinicas')?.disabled) return;
    this.clinicasDropdownOpen.update(v => !v);
  }

  isClinicaSelected(id: ID): boolean {
    const selected = this.form.get('clinicas')?.value as ID[] ?? [];
    return selected.some(s => s === id || String(s) === String(id));
  }

  toggleClinica(id: ID) {
    const control = this.form.get('clinicas');
    if (!control) return;

    const current = (control.value as ID[]) ?? [];
    const isSelected = current.some(s => s === id || String(s) === String(id));

    if (isSelected) {
      control.setValue(current.filter(s => s !== id && String(s) !== String(id)));
    } else {
      control.setValue([...current, id]);
    }
  }

  // ====== Carga enlaces actuales (solo edición) ======
  private async loadUserClinics(userId: string) {
    try {
      const memberships = await this.convex.query(
        api.clinicMemberships.queries.listByUser,
        { userId: userId as Id<'users'> },
      );

      this.currentLinks.clear();
      const ids: ID[] = [];
      for (const m of memberships ?? []) {
        if (m.puesto !== 'paciente') continue;
        this.currentLinks.set(m.clinicId, m._id as unknown as string);
        ids.push(m.clinicId);
      }

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

    try {
      if (!this.isEdit()) {
        // ---- CREAR — usamos createPatient para la primera clínica.
        // Si hay varias clínicas seleccionadas, añadimos las demás vía add().
        const selectedClinics = (v.clinicas as ID[]) || [];
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

        const targetIds = new Set<ID>(v.clinicas || []);
        const currentIds = new Set<ID>([...this.currentLinks.keys()]);

        const toAdd: ID[] = [...targetIds].filter((x) => !currentIds.has(x));
        const toRemove: ID[] = [...currentIds].filter((x) => !targetIds.has(x));

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
