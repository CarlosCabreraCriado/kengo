import { Injectable, inject, computed, effect, signal } from '@angular/core';

import { ConvexService } from '../../../core/convex/convex.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../convex/_generated/dataModel';

import {
  Usuario,
  Clinica,
  Puesto,
  RolUsuario,
} from '../../../../types/global';

export interface MiembroEquipo extends Usuario {
  puesto: Puesto;
  /**
   * `true` cuando este miembro es el propietario de la clínica
   * (`clinics.ownerUserId`). El owner es el único que puede gestionar
   * la suscripción Stripe; el resto de admins son co-gestores funcionales.
   */
  isOwner: boolean;
}

type FisiosPorClinica = Record<string, MiembroEquipo[]>;

@Injectable({ providedIn: 'root' })
export class ClinicasService {
  private sessionService = inject(SessionService);
  private convex = inject(ConvexService);
  private clinicaActiva = inject(ClinicaActivaService);

  // Reexposición del signal (compatibilidad con consumidores existentes).
  // La verdad vive en `ClinicaActivaService`.
  readonly selectedClinicaId = this.clinicaActiva.selectedClinicaId;

  setSelectedClinicaId(id: string | null): void {
    this.clinicaActiva.set(id);
  }

  // ========= Convex: Suscripcion reactiva a mis clinicas =========
  private readonly misClinicasQuery = this.convex.watchQuery(
    api.clinics.queries.myClinicsList,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id) return 'skip' as const;
      return {};
    },
  );

  readonly misClinicas = computed<Clinica[]>(() => {
    const raw = this.misClinicasQuery.value();
    if (!raw) return [];
    return raw.map((c) => ({
      id: c._id,
      nombre: c.nombre,
      nombreComercial: c.nombreComercial ?? null,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      web: c.web ?? null,
      direccion: c.direccion ?? null,
      postal: c.postal ?? null,
      nif: c.nif ?? null,
      colorPrimario: c.colorPrimario ?? null,
      colorSecundario: c.colorSecundario ?? null,
      logo: typeof c.logo === 'string' ? c.logo : null,
      imagenes: (c.imagenes ?? []).map((img) => ({
        id: String(img.id),
        fileId: img.fileId,
      })),
    }));
  });

  readonly misClinicasRes = {
    value: this.misClinicas,
    isLoading: this.misClinicasQuery.isLoading,
    reload: () => {
      // No-op: Convex watchQuery se actualiza automaticamente
    },
  };

  readonly idsClinicasCargadas = computed<string[]>(() =>
    this.misClinicas().map((c) => c.id),
  );

  // ========= Fisios por clinica =========
  private fisiosCache = signal<FisiosPorClinica>({});

  private fisiosLoader = effect(() => {
    const clinicas = this.misClinicasQuery.value();
    if (clinicas && clinicas.length > 0) {
      this.cargarFisiosTodasClinicas();
    }
  });

  private async cargarFisiosTodasClinicas(): Promise<void> {
    const clinicas = this.misClinicasQuery.value();
    if (!clinicas || clinicas.length === 0) return;

    const result: FisiosPorClinica = {};

    for (const clinic of clinicas) {
      try {
        const fisios = await this.fetchMiembrosClinica(clinic._id);
        result[clinic._id] = fisios;
      } catch (err) {
        console.warn(`Error cargando miembros de clinica ${clinic.nombre}:`, err);
      }
    }

    this.fisiosCache.set(result);
  }

  /**
   * Recarga los miembros (fisio | admin) de una sola clínica y actualiza
   * el cache. Usado tras mutaciones puntuales (p.ej. expulsar fisio).
   */
  async recargarFisiosClinica(clinicId: string): Promise<void> {
    const clinicas = this.misClinicasQuery.value();
    const clinic = clinicas?.find((c) => c._id === clinicId);
    if (!clinic) return;
    try {
      const fisios = await this.fetchMiembrosClinica(clinic._id);
      this.fisiosCache.update((prev) => ({ ...prev, [clinicId]: fisios }));
    } catch (err) {
      console.warn(`Error recargando miembros de clinica ${clinic.nombre}:`, err);
    }
  }

  private async fetchMiembrosClinica(
    clinicId: Id<'clinics'>,
  ): Promise<MiembroEquipo[]> {
    const members = await this.convex.query(
      api.clinics.queries.getMembers,
      { clinicId },
    );

    return (members ?? [])
      .filter((m) => m.puesto === 'fisio' || m.puesto === 'admin')
      .map((m) => ({
        id: m._id,
        convexId: m._id,
        first_name: m.firstName ?? '',
        last_name: m.lastName ?? '',
        email: m.email ?? '',
        email_verified: m.emailVerified ?? false,
        avatar: m.avatar ? String(m.avatar) : '',
        avatar_url: undefined,
        telefono: m.telefono || undefined,
        numero_colegiado: m.numeroColegiado || undefined,
        detalle: null,
        clinicas: [],
        esFisio: true,
        esPaciente: false,
        puesto: m.puesto as Puesto,
        isOwner: m.isOwner === true,
      }));
  }

  fisiosDeClinica = (idClinica: string) =>
    computed<MiembroEquipo[]>(() => {
      return this.fisiosCache()[idClinica] ?? [];
    });

  readonly selectedClinica = computed<Clinica | null>(() => {
    const clinicas = this.misClinicas();
    const id = this.selectedClinicaId();
    if (!clinicas || clinicas.length === 0) return null;
    if (!id) return null;
    return clinicas.find((c) => c.id === id) ?? null;
  });

  /**
   * Puesto del usuario autenticado en la clínica activa.
   * `null` si no hay clínica activa o no se ha cargado todavía.
   */
  readonly puestoEnClinicaActiva = computed<Puesto | null>(() => {
    const id = this.selectedClinicaId();
    if (!id) return null;
    const c = this.sessionService
      .misclinicas()
      .find((m) => m.clinicId === id);
    return (c?.puesto as Puesto | null) ?? null;
  });

  /**
   * Modo derivado de la clínica activa:
   *   - puesto fisio o admin → 'fisio'
   *   - puesto paciente → 'paciente'
   *   - sin clínica activa o puesto desconocido → 'paciente' por defecto
   *     (el sistema redirige a /seleccionar-clinica antes de operar).
   */
  readonly modoActual = computed<RolUsuario>(() => {
    const puesto = this.puestoEnClinicaActiva();
    if (puesto === 'fisio' || puesto === 'admin') return 'fisio';
    return 'paciente';
  });

  // Sincroniza el id activo con las membresías reales:
  //   - autoseleccion cuando hay exactamente una clínica.
  //   - limpieza cuando el id persistido ya no aparece (p.ej. tras salir de
  //     la clínica desde otro dispositivo).
  //   - heurística "rol profesional único": si hay >1 clínicas pero el
  //     usuario solo es fisio/admin en una, se autoselecciona esa.
  private readonly sincronizadorClinicaActiva = effect(() => {
    const ids = this.idsClinicasCargadas();
    if (ids.length === 0) {
      // Aún no se ha cargado o no tiene clínicas: no tocar el id persistido
      // hasta confirmar (puede ser un estado transitorio antes de la query).
      return;
    }
    const actual = this.selectedClinicaId();

    if (ids.length === 1) {
      if (actual !== ids[0]) {
        this.setSelectedClinicaId(ids[0]!);
      }
      return;
    }

    if (actual && ids.includes(actual)) return;

    if (actual && !ids.includes(actual)) {
      this.setSelectedClinicaId(null);
    }

    const profesionales = this.sessionService
      .misclinicas()
      .filter((m) => m.puesto === 'fisio' || m.puesto === 'admin');
    if (profesionales.length === 1) {
      const candidato = profesionales[0]!.clinicId;
      if (ids.includes(candidato)) {
        this.setSelectedClinicaId(candidato);
      }
    }
  });
}
