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
  Ui2CardComponent,
} from '../../../../shared/ui-v2';
import { emailRequired } from '../../../../shared';
import { ToastService } from '../../../../shared/services/toast/toast.service';
import { DialogService } from '../../../../shared/services/dialog/dialog.service';
import { ClipboardService } from '../../../../core/services/clipboard.service';
import { LoggerService } from '../../../../core/services/logger.service';

import { Usuario } from '../../../../../types/global';
import { ConvexService } from '../../../../core/convex/convex.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { api } from '../../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../../convex/_generated/dataModel';

interface DialogData {
  usuario?: Usuario; // si viene -> modo edición
}

interface Resultado {
  userId: string;
  magicLink: string | null;
  codigo: string | null;
  emailEnviado: boolean;
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
    Ui2CardComponent,
  ],
  templateUrl: './add-paciente.component.html',
  styleUrl: './add-paciente.component.css',
})
export class AddPacienteDialogComponent {
  private fb = inject(FormBuilder);
  protected dialogRef = inject(DialogRef<{ created?: unknown; updated?: boolean }>);
  private data = inject<DialogData>(DIALOG_DATA);
  private convex = inject(ConvexService);
  private clinicaActiva = inject(ClinicaActivaService);
  private clinicasService = inject(ClinicasService);
  private clipboard = inject(ClipboardService);
  private toast = inject(ToastService);
  private dialogs = inject(DialogService);
  private logger = inject(LoggerService);

  loading = signal(false);
  error = signal<string | null>(null);
  isEdit = computed(() => !!this.data.usuario);

  resultado = signal<Resultado | null>(null);

  // Contexto único: la clínica activa de la sesión. Toda alta queda vinculada
  // a esta clínica; el modelo multiclínica se maneja desde el switcher de la
  // sidenav, no desde este popup.
  readonly clinicaActivaInfo = computed(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    const clinica = this.clinicasService
      .misClinicasRes
      .value()
      ?.find((c) => String(c.id) === String(id));
    return {
      id: id ?? null,
      nombre: clinica?.nombre ?? '',
    };
  });

  get emailError(): string | null {
    const ctrl = this.form.controls.email;
    return ctrl.invalid && ctrl.touched ? 'Email inválido' : null;
  }

  form = this.fb.group({
    first_name: [this.data.usuario?.first_name ?? '', Validators.required],
    last_name: [this.data.usuario?.last_name ?? ''],
    email: [this.data.usuario?.email ?? '', emailRequired],
    telefono: [this.data.usuario?.telefono ?? ''],
  });

  close(result?: { created?: unknown; updated?: boolean }) {
    this.dialogRef.close(result);
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();

    try {
      if (this.isEdit()) {
        await this.actualizarPaciente(v);
        return;
      }

      const clinicId = this.clinicaActivaInfo().id;
      if (!clinicId) {
        throw new Error('No hay clínica activa. Selecciona una desde el menú.');
      }

      await this.crearPaciente(v, clinicId as Id<'clinics'>);
    } catch (e: unknown) {
      this.logger.error(e);
      const msg = e instanceof Error ? e.message : 'No se pudieron guardar los cambios.';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private async crearPaciente(
    v: ReturnType<typeof this.form.getRawValue>,
    clinicId: Id<'clinics'>,
  ) {
    const email = (v.email ?? '').trim();

    // Pre-check: si el email ya existe en la plataforma, decidir si bloquear,
    // pedir confirmación o continuar silenciosamente.
    const precheck = await this.convex.query(
      api.users.queries.precheckPatientEmail,
      { email, clinicId },
    );

    if (precheck.status === 'invalid_email') {
      throw new Error('Email no válido.');
    }
    if (precheck.status === 'duplicate_in_clinic') {
      throw new Error('Este paciente ya está registrado en tu clínica.');
    }
    if (precheck.status === 'staff_in_clinic') {
      throw new Error(
        'Este email pertenece a un profesional de esta clínica.',
      );
    }

    let confirmReuseExisting = false;
    if (precheck.status === 'existing_active') {
      const nombre = `${precheck.firstName ?? ''} ${precheck.lastName ?? ''}`.trim() || 'un usuario existente';
      const ok = await this.dialogs.confirm({
        title: 'Email ya registrado',
        message:
          `Hemos encontrado a ${nombre} con ese email. ` +
          'Si lo vinculas a tu clínica como paciente, sus datos personales ' +
          '(nombre, apellidos y teléfono) no se modificarán. ¿Quieres continuar?',
        confirmText: 'Vincular',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
      confirmReuseExisting = true;
    }
    // status === 'new' o 'existing_pending' pasan sin confirmación: la action
    // permite actualizar los datos en ambos casos.

    const result = await this.convex.action(api.users.actions.createPatient, {
      firstName: v.first_name ?? '',
      lastName: v.last_name ?? '',
      email,
      telefono: v.telefono || undefined,
      password: this.genTempPassword(),
      clinicId,
      confirmReuseExisting,
    });

    if (!result.success) {
      throw new Error(result.error || 'No se pudo crear el usuario.');
    }

    this.resultado.set({
      userId: result.userId ?? '',
      magicLink: result.accessToken?.url ?? null,
      codigo: result.codigoAcceso ?? null,
      emailEnviado: !!result.emailEnviado,
    });
  }

  private async actualizarPaciente(
    v: ReturnType<typeof this.form.getRawValue>,
  ) {
    const userId = this.data.usuario!.id;
    const clinicIdActiva = this.clinicaActiva.selectedClinicaId();

    await this.convex.mutation(api.users.mutations.updatePatient, {
      patientId: userId as Id<'users'>,
      firstName: v.first_name ?? undefined,
      lastName: v.last_name ?? undefined,
      email: v.email ?? undefined,
      telefono: v.telefono || undefined,
      // La clínica activa permite al backend aplicar la regla multiclínica:
      // bloqueo si esa concretamente está suspendida, aunque otras no.
      clinicId: clinicIdActiva ? (clinicIdActiva as Id<'clinics'>) : undefined,
    });

    this.close({ updated: true });
  }

  copiarMagicLink() {
    const url = this.resultado()?.magicLink;
    if (!url) return;
    void this.clipboard.write(url);
    this.toast.success('Enlace copiado al portapapeles');
  }

  copiarCodigo() {
    const codigo = this.resultado()?.codigo;
    if (!codigo) return;
    void this.clipboard.write(codigo);
    this.toast.success('Código copiado al portapapeles');
  }

  finalizar() {
    const r = this.resultado();
    if (r) {
      this.close({ created: { id: r.userId } });
    } else {
      this.close();
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
