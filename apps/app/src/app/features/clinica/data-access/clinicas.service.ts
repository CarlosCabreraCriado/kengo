import { Injectable, signal, inject, computed } from '@angular/core';
import { environment as env } from '../../../../environments/environment';

import { httpResource } from '@angular/common/http';

// Core services
import { SessionService } from '../../../core/auth/services/session.service';

// Types:
import {
  Usuario,
  UsuarioDirectus,
  Clinica,
  ClinicaDirectus,
  ID,
} from '../../../../types/global';

interface DirectusPage<T> {
  data: T[];
}

type FisiosPorClinica = Record<number, Usuario[]>; // { [id_clinica]: Fisio[] }

@Injectable({ providedIn: 'root' })
export class ClinicasService {
  private sessionService = inject(SessionService);

  selectedClinicaId = signal<ID | null>(null);

  readonly idsMisClinicas = computed<ID[] | null>(() => {
    const uc = this.sessionService.usuario()?.clinicas ?? null;
    if (!uc) return null;
    const ids = uc.map((x) => x.id_clinica);
    console.log('IDs de mis clínicas:', ids);
    return ids;
  });

  // Lista de clínicas para el selector (id + nombre)
  readonly misClinicasRes = httpResource<Clinica[]>(
    () => {
      const ids = this.idsMisClinicas();
      console.log('Cargando datos de clínicas:', ids);
      if (!ids || !ids.length) return undefined;
      if (ids.length == 0) return undefined; // hasta que tengamos ids, no dispares la llamada

      return {
        url: `${env.DIRECTUS_URL}/items/clinicas`,
        method: 'GET',
        params: {
          fields: [
            'id_clinica',
            'nombre',
            'telefono',
            'email',
            'direccion',
            'postal',
            'nif',
            'color_primario',
            'logo',
            'logo.id',
            'imagenes.directus_files_id',
          ].join(','),
          filter: JSON.stringify({ id_clinica: { _in: ids } }),
          limit: '200',
        },
        // withCredentials: true,
      };
    },
    {
      parse: (v) => {
        const res = (v as DirectusPage<ClinicaDirectus>)?.data ?? [];
        const clinicas: Clinica[] = [];
        for (const clinica of res) {
          clinicas.push({
            id_clinica: Number(clinica.id_clinica),
            nombre: clinica.nombre ?? '',
            telefono: clinica.telefono ?? null,
            email: clinica.email ?? null,
            direccion: clinica.direccion ?? null,
            postal: clinica.postal ?? null,
            nif: clinica.nif ?? null,
            color_primario: clinica.color_primario ?? null,
            logo: clinica.logo?.id.toString() ?? null,
            imagenes: (clinica.imagenes ?? [])
              .map((f) => f.directus_files_id?.toString() ?? '')
              .filter(Boolean),
          });
        }

        console.log('Mis clínicas:', clinicas);
        return clinicas;
      },
      defaultValue: [],
    },
  );

  // IDs de clínicas ya confirmadas por el resource anterior
  readonly idsClinicasCargadas = computed<number[]>(() =>
    (this.misClinicasRes.value() ?? []).map((c) => Number(c.id_clinica)),
  );

  // --- NUEVO: fisios de TODAS las clínicas cargadas ---
  readonly fisiosEnMisClinicaRes = httpResource<FisiosPorClinica>(
    () => {
      const ids = this.idsClinicasCargadas();
      if (!ids || ids.length === 0) return undefined;

      return {
        url: `${env.DIRECTUS_URL}/users`,
        method: 'GET',
        params: {
          fields: [
            'id',
            'first_name',
            'last_name',
            'email',
            'avatar',
            'telefono',
            'numero_colegiado',
            'clinicas.id_clinica',
            'clinicas.id_puesto',
            'clinicas.puesto.id',
            'clinicas.puesto.puesto',
          ].join(','),
          filter: JSON.stringify({
            _and: [
              { is_fisio: { _eq: true } },
              { clinicas: { id_clinica: { _in: ids } } }, // Variante A
            ],
          }),
          limit: '500',
          sort: 'first_name,last_name',
        },
      };
    },
    {
      // agrupamos a los usuarios por cada clínica en la que estén
      parse: (v) => {
        const data = (v as DirectusPage<UsuarioDirectus>)?.data ?? [];
        const map: FisiosPorClinica = {};
        for (const u of data) {
          const fisio: Usuario = this.sessionService.transformarUsuarioDirectus(u);
          const rel = Array.isArray(u.clinicas) ? u.clinicas : [];
          for (const c of rel) {
            const idClin = Number(c?.id_clinica);
            if (!Number.isFinite(idClin)) continue;
            if (!map[idClin]) map[idClin] = [];
            map[idClin].push(fisio);
          }
        }
        console.log('Fisios en mis clínicas:', map);
        return map;
      },
      defaultValue: {},
    },
  );

  // helper de acceso cómodo para el template o componentes
  fisiosDeClinica = (idClinica: ID) =>
    computed<Usuario[]>(() => {
      return this.fisiosEnMisClinicaRes.value()[Number(idClinica)] ?? [];
    });
}
