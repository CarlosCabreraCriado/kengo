import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { assetUrl } from '../../../../core/utils/asset-url';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

import {
  Usuario,
  UUID,
  BulkAsignacionPayload,
} from '../../../../../types/global';
import { useResponsive } from '../../../../shared';
import { ToastService } from '../../../../shared/ui/toast/toast.service';

import {
  Ui2BackButtonComponent,
  Ui2AvatarComponent,
  Ui2SearchBoxComponent,
  Ui2SelectComponent,
  Ui2SpinnerComponent,
  Ui2EmptyStateComponent,
  Ui2ButtonComponent,
  Ui2CardComponent,
  Ui2SelectOption,
} from '../../../../shared/ui-v2';

@Component({
  selector: 'app-asignacion-responsable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    Ui2BackButtonComponent,
    Ui2AvatarComponent,
    Ui2SearchBoxComponent,
    Ui2SelectComponent,
    Ui2SpinnerComponent,
    Ui2EmptyStateComponent,
    Ui2ButtonComponent,
    Ui2CardComponent,
  ],
  templateUrl: './asignacion-responsable.component.html',
  styleUrl: './asignacion-responsable.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class AsignacionResponsableComponent {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private clinicasService = inject(ClinicasService);
  private asignacionesService = inject(AsignacionesService);
  private convex = inject(ConvexService);
  private toast = inject(ToastService);

  constructor() {
    // Auto-seleccionar primera clínica admin cuando los datos estén disponibles
    effect(() => {
      const clinicas = this.clinicasAdmin();
      if (clinicas.length > 0 && this.clinicaSeleccionada() === null) {
        this.seleccionarClinica(clinicas[0].id);
      }
    });
  }

  isMovil = useResponsive().esMobile;

  // Clínicas donde el usuario es admin
  readonly clinicasAdmin = computed(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    const userClinicas = this.sessionService.usuario()?.clinicas ?? [];
    const adminClinicaIds = userClinicas
      .filter((uc) => uc.puesto === 'admin')
      .map((uc) => uc.clinicId);
    return clinicas.filter((c) => adminClinicaIds.includes(c.id));
  });

  readonly clinicaSeleccionada = signal<string | null>(null);

  // Opciones de clínicas para ui2-select
  readonly clinicasOptions = computed<Ui2SelectOption[]>(() =>
    this.clinicasAdmin().map((c) => ({ value: c.id, label: c.nombre })),
  );

  // Fisios de la clínica seleccionada
  readonly fisiosClinica = computed(() => {
    const cid = this.clinicaSeleccionada();
    if (!cid) return [];
    return this.clinicasService.fisiosDeClinica(cid)();
  });

  readonly fisiosOptions = computed<Ui2SelectOption[]>(() => {
    const items: Ui2SelectOption[] = [{ value: '', label: 'Sin asignar' }];
    for (const f of this.fisiosClinica()) {
      items.push({ value: f.id, label: this.fisioFullName(f) });
    }
    return items;
  });

  // Pacientes y asignaciones
  readonly pacientes = signal<Usuario[]>([]);
  readonly isLoadingPacientes = signal(false);
  readonly asignacionesOriginales = signal<Map<UUID, UUID | null>>(new Map());
  readonly asignacionesEditadas = signal<Map<UUID, UUID | null>>(new Map());

  readonly busqueda = signal('');

  readonly pacientesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const all = this.pacientes();
    if (!q) return all;
    return all.filter(
      (p) =>
        (p.first_name || '').toLowerCase().includes(q) ||
        (p.last_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q),
    );
  });

  readonly cambiosPendientes = computed(() => {
    const orig = this.asignacionesOriginales();
    const edit = this.asignacionesEditadas();
    let count = 0;
    for (const [pacId, fisioId] of edit) {
      if (orig.get(pacId) !== fisioId) count++;
    }
    return count;
  });

  readonly guardando = signal(false);

  seleccionarClinica(id: string) {
    this.clinicaSeleccionada.set(id);
    this.cargarDatos(id);
  }

  onClinicaChange(value: string | number) {
    this.seleccionarClinica(String(value));
  }

  private async cargarDatos(clinicaId: string) {
    this.isLoadingPacientes.set(true);

    try {
      // Cargar pacientes y asignaciones en paralelo
      const [pacientes, asignaciones] = await Promise.all([
        this.cargarPacientes(clinicaId),
        firstValueFrom(this.asignacionesService.listarAsignaciones(clinicaId)),
      ]);

      this.pacientes.set(pacientes);

      // Construir mapa de asignaciones
      const asigMap = new Map<UUID, UUID | null>();
      for (const p of pacientes) {
        const asig = asignaciones.find((a) => a.idPaciente === p.id);
        asigMap.set(p.id, asig?.idFisio ?? null);
      }

      this.asignacionesOriginales.set(new Map(asigMap));
      this.asignacionesEditadas.set(new Map(asigMap));
    } catch (err) {
      console.error('Error cargando datos de asignación:', err);
      this.toast.error('Error al cargar datos');
    } finally {
      this.isLoadingPacientes.set(false);
    }
  }

  private async cargarPacientes(clinicaId: string): Promise<Usuario[]> {
    const result = await this.convex.query(
      api.users.queries.listPatientsByClinic,
      { clinicId: clinicaId as any, limit: 500 },
    );
    return (result?.results ?? []).map((u) =>
      this.sessionService.transformarUsuarioConvex(u),
    );
  }

  cambiarAsignacion(pacienteId: UUID, fisioId: string | number) {
    const id = typeof fisioId === 'number' ? String(fisioId) : fisioId;
    this.asignacionesEditadas.update((m) => {
      const copy = new Map(m);
      copy.set(pacienteId, id || null);
      return copy;
    });
  }

  getAsignacionActual(pacienteId: UUID): string {
    return this.asignacionesEditadas().get(pacienteId) || '';
  }

  tienesCambio(pacienteId: UUID): boolean {
    return (
      this.asignacionesOriginales().get(pacienteId) !==
      this.asignacionesEditadas().get(pacienteId)
    );
  }

  async guardarCambios() {
    const clinicaId = this.clinicaSeleccionada();
    if (!clinicaId || this.cambiosPendientes() === 0) return;

    this.guardando.set(true);

    try {
      const orig = this.asignacionesOriginales();
      const edit = this.asignacionesEditadas();

      const asignaciones: { pacienteId: UUID; fisioId: UUID | null }[] = [];
      for (const [pacId, fisioId] of edit) {
        if (orig.get(pacId) !== fisioId) {
          asignaciones.push({ pacienteId: pacId, fisioId });
        }
      }

      const payload: BulkAsignacionPayload = {
        clinicId: clinicaId,
        asignaciones,
      };

      const result = await firstValueFrom(this.asignacionesService.bulkAsignar(payload));

      if (result.success) {
        // Actualizar originales para reflejar el nuevo estado
        this.asignacionesOriginales.set(new Map(edit));
        const partes: string[] = [];
        partes.push(`${result.asignadas} asignada${result.asignadas !== 1 ? 's' : ''}`);
        if (result.eliminadas > 0) {
          partes.push(`${result.eliminadas} eliminada${result.eliminadas !== 1 ? 's' : ''}`);
        }
        this.toast.success(`Cambios guardados: ${partes.join(', ')}`);
      }
    } catch (err: unknown) {
      console.error('Error guardando asignaciones:', err);
      const errorMsg =
        (err as { error?: { error?: string } })?.error?.error ||
        'Error al guardar los cambios';
      this.toast.error(errorMsg);
    } finally {
      this.guardando.set(false);
    }
  }

  volver() {
    this.router.navigate(['/mis-pacientes']);
  }

  fullName(u: Usuario): string {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : u.email || u.id;
  }

  avatarUrl(p: Usuario): string | null {
    return p?.avatar
      ? `${assetUrl(p.avatar, { fit: 'cover', width: 80, height: 80, quality: 80 })}`
      : null;
  }

  fisioFullName(u: Usuario): string {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    return fn || ln ? `${fn} ${ln}`.trim() : u.email || '';
  }
}
