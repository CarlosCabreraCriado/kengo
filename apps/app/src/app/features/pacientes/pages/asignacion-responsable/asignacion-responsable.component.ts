import {
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
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicasService } from '../../../clinica/data-access/clinicas.service';
import { AsignacionesService } from '../../data-access/asignaciones.service';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

import {
  Usuario,
  UUID,
  PUESTO_ADMINISTRADOR,
  BulkAsignacionPayload,
} from '../../../../../types/global';
import { KENGO_BREAKPOINTS } from '../../../../shared';

@Component({
  selector: 'app-asignacion-responsable',
  standalone: true,
  imports: [FormsModule],
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
  private breakpointObserver = inject(BreakpointObserver);
  private convex = inject(ConvexService);

  constructor() {
    // Auto-seleccionar primera clínica admin cuando los datos estén disponibles
    effect(() => {
      const clinicas = this.clinicasAdmin();
      if (clinicas.length > 0 && this.clinicaSeleccionada() === null) {
        this.seleccionarClinica(clinicas[0].id_clinica);
      }
    });
  }

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  // Clínicas donde el usuario es admin
  readonly clinicasAdmin = computed(() => {
    const clinicas = this.clinicasService.misClinicasRes.value() ?? [];
    const userClinicas = this.sessionService.usuario()?.clinicas ?? [];
    const adminClinicaIds = userClinicas
      .filter((uc) => uc.id_puesto === PUESTO_ADMINISTRADOR)
      .map((uc) => uc.id_clinica);
    return clinicas.filter((c) => adminClinicaIds.includes(c.id_clinica));
  });

  readonly clinicaSeleccionada = signal<string | null>(null);

  // Fisios de la clínica seleccionada
  readonly fisiosClinica = computed(() => {
    const cid = this.clinicaSeleccionada();
    if (!cid) return [];
    return this.clinicasService.fisiosDeClinica(cid)();
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
  readonly mensaje = signal<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  seleccionarClinica(id: string) {
    this.clinicaSeleccionada.set(id);
    this.cargarDatos(id);
  }

  private async cargarDatos(clinicaId: string) {
    this.isLoadingPacientes.set(true);
    this.mensaje.set(null);

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
      this.mensaje.set({ tipo: 'error', texto: 'Error al cargar datos' });
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

  cambiarAsignacion(pacienteId: UUID, fisioId: string) {
    this.asignacionesEditadas.update((m) => {
      const copy = new Map(m);
      copy.set(pacienteId, fisioId || null);
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
    this.mensaje.set(null);

    try {
      const orig = this.asignacionesOriginales();
      const edit = this.asignacionesEditadas();

      const asignaciones: { id_paciente: UUID; id_fisio: UUID | null }[] = [];
      for (const [pacId, fisioId] of edit) {
        if (orig.get(pacId) !== fisioId) {
          asignaciones.push({ id_paciente: pacId, id_fisio: fisioId });
        }
      }

      const payload: BulkAsignacionPayload = {
        id_clinica: clinicaId,
        asignaciones,
      };

      const result = await firstValueFrom(this.asignacionesService.bulkAsignar(payload));

      if (result.success) {
        // Actualizar originales para reflejar el nuevo estado
        this.asignacionesOriginales.set(new Map(edit));
        this.mensaje.set({
          tipo: 'success',
          texto: `Cambios guardados: ${result.asignadas} asignada${result.asignadas !== 1 ? 's' : ''}${result.eliminadas > 0 ? `, ${result.eliminadas} eliminada${result.eliminadas !== 1 ? 's' : ''}` : ''}`,
        });

        setTimeout(() => this.mensaje.set(null), 4000);
      }
    } catch (err: unknown) {
      console.error('Error guardando asignaciones:', err);
      const errorMsg = (err as { error?: { error?: string } })?.error?.error || 'Error al guardar los cambios';
      this.mensaje.set({ tipo: 'error', texto: errorMsg });
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

  getInitials(u: Usuario): string {
    const fn = (u.first_name || '').trim();
    const ln = (u.last_name || '').trim();
    if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
    if (fn) return fn.substring(0, 2).toUpperCase();
    if (ln) return ln.substring(0, 2).toUpperCase();
    if (u.email) return u.email.substring(0, 2).toUpperCase();
    return '??';
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
