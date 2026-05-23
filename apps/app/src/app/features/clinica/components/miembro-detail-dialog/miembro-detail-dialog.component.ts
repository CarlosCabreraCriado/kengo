import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  Ui2AvatarComponent,
  Ui2AvatarGradient,
  Ui2ButtonComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2PillComponent,
} from '../../../../shared/ui-v2';

import { SessionService } from '../../../../core/auth/services/session.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import { ToastService } from '../../../../shared/services/toast/toast.service';

import { ClinicasService, MiembroEquipo } from '../../data-access/clinicas.service';
import { assetUrl } from '../../../../core/utils/asset-url';

import { api } from '../../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../../convex/_generated/dataModel';

export interface MiembroDetailDialogData {
  clinicaId: string;
  fisioId: string;
}

@Component({
  standalone: true,
  selector: 'app-miembro-detail-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2AvatarComponent,
    Ui2PillComponent,
    Ui2ButtonComponent,
  ],
  templateUrl: './miembro-detail-dialog.component.html',
  styleUrl: './miembro-detail-dialog.component.css',
})
export class MiembroDetailDialogComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly data = inject<MiembroDetailDialogData>(DIALOG_DATA);

  private readonly sessionService = inject(SessionService);
  private readonly clinicasService = inject(ClinicasService);
  private readonly convex = inject(ConvexService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);

  readonly clinicaId = this.data.clinicaId;
  readonly fisioId = this.data.fisioId;

  /** Miembro reactivo desde el cache. Puede ser `undefined` si fue desvinculado. */
  readonly miembro = computed<MiembroEquipo | undefined>(() =>
    this.clinicasService
      .fisiosDeClinica(this.clinicaId)()
      .find((m) => m.id === this.fisioId),
  );

  readonly fullName = computed<string>(() => {
    const m = this.miembro();
    if (!m) return '';
    return `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
  });

  readonly esAdminTarget = computed<boolean>(() => this.miembro()?.puesto === 'admin');

  readonly rolLabel = computed<string>(() =>
    this.esAdminTarget() ? 'Admin' : 'Fisioterapeuta',
  );

  readonly rolIcon = computed<string>(() =>
    this.esAdminTarget() ? 'admin_panel_settings' : 'medical_services',
  );

  readonly esAdminActor = computed<boolean>(() => {
    const actorId = this.sessionService.usuario()?.id;
    if (!actorId) return false;
    const actorMembership = this.clinicasService
      .fisiosDeClinica(this.clinicaId)()
      .find((m) => m.id === actorId);
    return actorMembership?.puesto === 'admin';
  });

  readonly esActor = computed<boolean>(
    () => this.sessionService.usuario()?.id === this.fisioId,
  );

  readonly puedeDesvincular = computed<boolean>(() => {
    if (!this.esAdminActor()) return false;
    if (this.esActor()) return false;
    return this.miembro()?.puesto === 'fisio';
  });

  readonly puedePromocionar = computed<boolean>(() => {
    if (!this.esAdminActor()) return false;
    if (this.esActor()) return false;
    return this.miembro()?.puesto === 'fisio';
  });

  readonly promocionando = signal(false);

  readonly avatarSrc = computed<string | null>(() => {
    const avatar = this.miembro()?.avatar;
    if (!avatar) return null;
    return assetUrl(avatar, { fit: 'cover', width: 256, height: 256 });
  });

  /** Gradient determinista a partir del id para no cambiar entre aperturas. */
  readonly avatarGradient = computed<Ui2AvatarGradient>(() => {
    const gradients: readonly Ui2AvatarGradient[] = [
      'coral',
      'indigo',
      'green',
      'amber',
    ];
    const code = (this.fisioId || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return gradients[code % gradients.length]!;
  });

  async onDesvincular(): Promise<void> {
    const m = this.miembro();
    if (!m || !this.puedeDesvincular()) return;

    const nombre = this.fullName() || 'el fisioterapeuta';
    const confirmed = await this.dialogService.confirm({
      title: 'Desvincular fisioterapeuta',
      message: `Vas a retirar el acceso de ${nombre} a la clínica. Perderá las conversaciones y los pacientes asignados. Esta acción no se puede deshacer.`,
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.convex.mutation(api.clinicMemberships.mutations.expelMember, {
        clinicId: this.clinicaId as Id<'clinics'>,
        userId: this.fisioId as Id<'users'>,
      });
      this.toastService.success('Fisioterapeuta desvinculado');
      await this.clinicasService.recargarFisiosClinica(this.clinicaId);
      this.dialogRef.close();
    } catch (err: unknown) {
      this.toastService.error(
        this.extraerMensajeError(err, 'No se pudo desvincular al fisioterapeuta'),
      );
    }
  }

  async onPromocionar(): Promise<void> {
    const m = this.miembro();
    if (!m || !this.puedePromocionar() || this.promocionando()) return;

    const nombre = this.fullName() || 'el fisioterapeuta';
    const confirmed = await this.dialogService.confirm({
      title: 'Promocionar a administrador',
      message: `${nombre} podrá gestionar la clínica: invitar y desvincular fisios, cambiar la información de la clínica y administrar la suscripción. Esta acción se puede revertir contactando con soporte.`,
      confirmText: 'Promocionar',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
    });
    if (!confirmed) return;

    this.promocionando.set(true);
    try {
      await this.convex.mutation(api.clinicMemberships.mutations.promoteToAdmin, {
        clinicId: this.clinicaId as Id<'clinics'>,
        userId: this.fisioId as Id<'users'>,
      });
      this.toastService.success('Fisioterapeuta promocionado a administrador');
      await this.clinicasService.recargarFisiosClinica(this.clinicaId);
    } catch (err: unknown) {
      this.toastService.error(
        this.extraerMensajeError(err, 'No se pudo promocionar al fisioterapeuta'),
      );
    } finally {
      this.promocionando.set(false);
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private extraerMensajeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { data?: { message?: string }; message?: string };
      return e.data?.message ?? e.message ?? fallback;
    }
    return fallback;
  }
}
