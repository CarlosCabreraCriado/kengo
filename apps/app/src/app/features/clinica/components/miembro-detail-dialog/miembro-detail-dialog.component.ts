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

  /** `true` si el miembro mostrado es el propietario de la clínica. */
  readonly esOwnerTarget = computed<boolean>(() => this.miembro()?.isOwner === true);

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

  /** `true` si el actor autenticado es el propietario de la clínica. */
  readonly esOwnerActor = computed<boolean>(() => {
    const actorId = this.sessionService.usuario()?.id;
    if (!actorId) return false;
    const actorMembership = this.clinicasService
      .fisiosDeClinica(this.clinicaId)()
      .find((m) => m.id === actorId);
    return actorMembership?.isOwner === true;
  });

  readonly esActor = computed<boolean>(
    () => this.sessionService.usuario()?.id === this.fisioId,
  );

  readonly puedeDesvincular = computed<boolean>(() => {
    if (!this.esAdminActor()) return false;
    if (this.esActor()) return false;
    // No se puede desvincular al propietario sin transferir antes (el backend
    // también lo rechaza con OWNER_MUST_TRANSFER_FIRST, pero ocultamos la
    // opción para no confundir al usuario).
    if (this.esOwnerTarget()) return false;
    return this.miembro()?.puesto === 'fisio';
  });

  readonly puedePromocionar = computed<boolean>(() => {
    if (!this.esAdminActor()) return false;
    if (this.esActor()) return false;
    return this.miembro()?.puesto === 'fisio';
  });

  /**
   * El owner actual puede transferir la propiedad a otro admin distinto
   * de él mismo. El nuevo owner debe ser ya admin (la mutation rechaza
   * con OWNER_MUST_BE_ADMIN si no lo es).
   */
  readonly puedeTransferirPropiedad = computed<boolean>(() => {
    if (!this.esOwnerActor()) return false;
    if (this.esActor()) return false;
    if (this.esOwnerTarget()) return false;
    return this.miembro()?.puesto === 'admin';
  });

  readonly promocionando = signal(false);
  readonly transfiriendo = signal(false);

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

  async onTransferirPropiedad(): Promise<void> {
    const m = this.miembro();
    if (!m || !this.puedeTransferirPropiedad() || this.transfiriendo()) return;

    const nombre = this.fullName() || 'este administrador';
    const confirmed = await this.dialogService.confirm({
      title: 'Transferir propiedad',
      message: `${nombre} pasará a ser el responsable de la suscripción. Recibirá los emails de billing y podrá cancelar o cambiar el método de pago. Tú mantendrás tu rol de administrador pero dejarás de ver las opciones de pago.`,
      confirmText: 'Transferir propiedad',
      cancelText: 'Cancelar',
      confirmVariant: 'primary',
    });
    if (!confirmed) return;

    this.transfiriendo.set(true);
    try {
      await this.convex.mutation(api.clinics.mutations.transferOwnership, {
        clinicId: this.clinicaId as Id<'clinics'>,
        toUserId: this.fisioId as Id<'users'>,
      });
      this.toastService.success('Propiedad transferida correctamente');
      await this.clinicasService.recargarFisiosClinica(this.clinicaId);
      this.dialogRef.close();
    } catch (err: unknown) {
      this.toastService.error(
        this.extraerMensajeError(err, 'No se pudo transferir la propiedad'),
      );
    } finally {
      this.transfiriendo.set(false);
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private extraerMensajeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as {
        data?: { code?: string; message?: string };
        message?: string;
      };
      // Mensajes específicos para los códigos del Bloque J.
      switch (e.data?.code) {
        case 'OWNER_REQUIRED':
          return 'Solo el propietario de la clínica puede realizar esta acción.';
        case 'OWNER_MUST_TRANSFER_FIRST':
          return 'Transfiere primero la propiedad a otro administrador para poder hacerlo.';
        case 'OWNER_MUST_BE_ADMIN':
          return 'El nuevo propietario debe ser administrador. Promociónalo primero.';
        case 'OWNER_TRANSFER_NOOP':
          return 'Ya eres el propietario de la clínica.';
        default:
          return e.data?.message ?? e.message ?? fallback;
      }
    }
    return fallback;
  }
}
