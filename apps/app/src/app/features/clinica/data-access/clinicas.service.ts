import { Injectable, signal, inject, computed, effect } from '@angular/core';

import { ConvexService } from '../../../core/convex/convex.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../convex/_generated/dataModel';

import {
  Usuario,
  Clinica,
  ID,
  PUESTO_FISIOTERAPEUTA,
  PUESTO_ADMINISTRADOR,
} from '../../../../types/global';

type FisiosPorClinica = Record<number, Usuario[]>;

@Injectable({ providedIn: 'root' })
export class ClinicasService {
  private sessionService = inject(SessionService);
  private convex = inject(ConvexService);

  selectedClinicaId = signal<ID | null>(null);

  // ========= Convex: Suscripcion reactiva a mis clinicas =========
  private readonly misClinicasQuery = this.convex.watchQuery(
    api.clinics.queries.myClinicsList,
    () => {
      const usuario = this.sessionService.usuario();
      if (!usuario?.id) return 'skip' as const;
      return {};
    },
  );

  // Clinicas transformadas al tipo de dominio
  readonly misClinicas = computed<Clinica[]>(() => {
    const raw = this.misClinicasQuery.value();
    if (!raw) return [];
    return raw.map((c) => ({
      id_clinica: c.legacyId ?? 0,
      nombre: c.nombre,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      direccion: c.direccion ?? null,
      postal: c.postal ?? null,
      nif: c.nif ?? null,
      color_primario: c.colorPrimario ?? null,
      color_secundario: c.colorSecundario ?? null,
      logo: typeof c.logo === 'string' ? c.logo : null,
      imagenes: (c.imagenes ?? []).map((img) => ({
        id: String(img.id),
        fileId: img.fileId,
      })),
    }));
  });

  // Compat: misClinicasRes.value() y misClinicasRes.reload()
  readonly misClinicasRes = {
    value: this.misClinicas,
    reload: () => {
      // No-op: Convex watchQuery se actualiza automaticamente en tiempo real
    },
  };

  // Map: legacyId → Convex ID (para mutations)
  readonly legacyToConvexClinicId = computed(() => {
    const map = new Map<number, Id<'clinics'>>();
    const raw = this.misClinicasQuery.value();
    if (!raw) return map;
    for (const c of raw) {
      if (c.legacyId !== undefined) {
        map.set(c.legacyId, c._id);
      }
    }
    return map;
  });

  // IDs de mis clinicas (legacy)
  readonly idsClinicasCargadas = computed<number[]>(() =>
    this.misClinicas().map((c) => Number(c.id_clinica)),
  );

  // ========= Fisios por clinica =========
  private fisiosCache = signal<FisiosPorClinica>({});

  // Auto-cargar fisios cuando cambian las clinicas
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
        const members = await this.convex.query(
          api.clinics.queries.getMembers,
          { clinicId: clinic._id },
        );

        const fisios: Usuario[] = (members ?? [])
          .filter(
            (m) => m.puesto === PUESTO_FISIOTERAPEUTA || m.puesto === PUESTO_ADMINISTRADOR,
          )
          .map((m) => ({
            id: m.legacyDirectusId ?? m._id,
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
          }));

        if (clinic.legacyId !== undefined) {
          result[clinic.legacyId] = fisios;
        }
      } catch (err) {
        console.warn(`Error cargando miembros de clinica ${clinic.nombre}:`, err);
      }
    }

    this.fisiosCache.set(result);
  }

  // Compat: fisiosDeClinica(id) devuelve un computed
  fisiosDeClinica = (idClinica: ID) =>
    computed<Usuario[]>(() => {
      return this.fisiosCache()[Number(idClinica)] ?? [];
    });

  // Computed para obtener la clínica actualmente seleccionada
  readonly selectedClinica = computed<Clinica | null>(() => {
    const clinicas = this.misClinicas();
    const id = this.selectedClinicaId();

    if (!clinicas || clinicas.length === 0) return null;
    if (!id) return clinicas[0] ?? null;

    return clinicas.find((c) => c.id_clinica === id) ?? clinicas[0] ?? null;
  });
}
