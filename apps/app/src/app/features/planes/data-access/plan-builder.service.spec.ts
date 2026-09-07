import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { PlanBuilderService } from './plan-builder.service';
import { PlanesService } from './planes.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AsignacionesService } from '../../pacientes/data-access/asignaciones.service';
import { RutinasService } from '../../rutinas/data-access/rutinas.service';
import { CarritoPointers } from './internal/carrito-pointers';
import type {
  Ejercicio,
  EjercicioPlan,
  PlanCompleto,
  Usuario,
} from '../../../../types/global';

const FISIO_ID = 'fisio1';
const STORAGE_KEY = (pacienteId: string) =>
  `kengo:plan_builder:v1:f=${FISIO_ID}:p=${pacienteId}`;

function usuario(id: string, nombre = 'Paciente'): Usuario {
  return {
    id,
    first_name: nombre,
    last_name: 'Test',
    email: `${id}@test.local`,
  } as Usuario;
}

function ejercicio(id: string, extra: Partial<Ejercicio> = {}): Ejercicio {
  return {
    id,
    nombre: `Ejercicio ${id}`,
    descripcion: '',
    categoria: [],
    video: '',
    portada: '',
    ...extra,
  } as Ejercicio;
}

function itemPlan(
  ej: Ejercicio,
  sort: number,
  extra: Partial<EjercicioPlan> = {},
): EjercicioPlan {
  return {
    id: `pe_${ej.id}`,
    planId: 'plan_origen',
    planItemId: `pi_${ej.id}`,
    dateCreated: '2026-01-01T00:00:00Z',
    sort,
    ejercicio: ej,
    ...extra,
  };
}

function plan(items: EjercicioPlan[], pacienteId = 'pac1'): PlanCompleto {
  return {
    id: 'plan_origen',
    titulo: 'Plan lumbar',
    descripcion: 'Descripción original',
    estado: 'activo',
    fechaInicio: '2026-01-10',
    fechaFin: '2026-02-10',
    paciente: usuario(pacienteId),
    fisio: usuario(FISIO_ID, 'Fisio'),
    items,
  } as PlanCompleto;
}

describe('PlanBuilderService — copiar plan al carrito', () => {
  let service: PlanBuilderService;

  beforeEach(() => {
    localStorage.clear();
    CarritoPointers.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ConvexService,
          useValue: {
            query: jasmine.createSpy('query'),
            mutation: jasmine.createSpy('mutation'),
            watchQuery: jasmine.createSpy('watchQuery'),
          },
        },
        {
          provide: SessionService,
          useValue: {
            usuario: signal({ id: FISIO_ID }),
            enModoFisio: signal(true),
            transformarUsuarioConvex: (u: unknown) => u,
          },
        },
        {
          provide: ClinicaActivaService,
          useValue: { selectedClinicaId: signal('clin1') },
        },
        { provide: AsignacionesService, useValue: { autoAsignar: jasmine.createSpy() } },
        { provide: RutinasService, useValue: {} },
        { provide: PlanesService, useValue: { getPlanById: jasmine.createSpy() } },
        {
          provide: LoggerService,
          useValue: { error: jasmine.createSpy(), warn: jasmine.createSpy() },
        },
      ],
    });
    service = TestBed.inject(PlanBuilderService);
  });

  afterEach(() => {
    localStorage.clear();
    CarritoPointers.clear();
  });

  describe('loadFromPlan', () => {
    it('copia la dosificación, renumera sort y no arrastra ids del plan origen', () => {
      const p = plan([
        itemPlan(ejercicio('e2'), 5, {
          tipo: 'repeticiones',
          series: 4,
          repeticiones: 8,
          descansoSeg: 60,
          diasSemana: ['M', 'J'],
          instruccionesPaciente: 'Despacio',
          notasFisio: 'Vigilar dolor',
        }),
        itemPlan(ejercicio('e1'), 2, { series: 2, repeticiones: 15 }),
      ]);

      const res = service.loadFromPlan(p, usuario('pac2', 'Otro'));

      expect(res).toEqual({ cargados: 2, omitidos: 0 });
      const items = service.items();
      expect(items.map((i) => i.ejercicio.id)).toEqual(['e1', 'e2']);
      expect(items.map((i) => i.sort)).toEqual([1, 2]);
      expect(items[1]).toEqual(
        jasmine.objectContaining({
          tipo: 'repeticiones',
          series: 4,
          repeticiones: 8,
          descansoSeg: 60,
          diasSemana: ['M', 'J'],
          instruccionesPaciente: 'Despacio',
          notasFisio: 'Vigilar dolor',
        }),
      );
      for (const item of items) {
        expect(item.id).toBeUndefined();
        expect(item.planId).toBeUndefined();
        expect(item.planItemId).toBeUndefined();
        expect(item.dateCreated).toBeUndefined();
      }
    });

    it('omite ejercicios borrados del catálogo (fantasmas) y deduplica por ejercicio', () => {
      const e1 = ejercicio('e1');
      const p = plan([
        itemPlan(e1, 1),
        itemPlan(ejercicio('ghost', { nombre: '' }), 2),
        itemPlan(e1, 3),
        itemPlan({ id: '', nombre: 'Sin id' } as Ejercicio, 4),
      ]);

      const res = service.loadFromPlan(p, usuario('pac1'));

      expect(res).toEqual({ cargados: 1, omitidos: 2 });
      expect(service.items().map((i) => i.ejercicio.id)).toEqual(['e1']);
    });

    it('aplica defaults y respeta la invariante de una sola métrica por tipo', () => {
      const p = plan([
        itemPlan(ejercicio('reps'), 1),
        itemPlan(ejercicio('dur', { tipo: 'duracion' }), 2, {
          repeticiones: 10,
        }),
        itemPlan(ejercicio('dur2', { tipo: 'duracion', duracionDefectoSeg: 45 }), 3, {
          tipo: 'duracion',
        }),
      ]);

      service.loadFromPlan(p, usuario('pac1'));

      const [reps, dur, dur2] = service.items();
      expect(reps).toEqual(
        jasmine.objectContaining({
          tipo: 'repeticiones',
          series: 3,
          repeticiones: 12,
          descansoSeg: 45,
          diasSemana: ['L', 'X', 'V'],
        }),
      );
      expect(reps.duracionSeg).toBeUndefined();
      expect(dur.tipo).toBe('duracion');
      expect(dur.duracionSeg).toBe(30);
      expect(dur.repeticiones).toBeUndefined();
      expect(dur2.duracionSeg).toBe(45);
    });

    it('sale del modo edición y deja el builder limpio', () => {
      service.setPlanId('plan_editando');
      service.hasActivity.set(true);
      service.currentVersion.set(3);
      service.titulo.set('Título viejo');
      service.descripcion.set('Desc vieja');
      service.fechaInicio.set('2026-01-01');
      service.fechaFin.set('2026-02-01');
      service.markAsSaved();

      service.loadFromPlan(plan([itemPlan(ejercicio('e1'), 1)]), usuario('pac1'));

      expect(service.isEditMode()).toBeFalse();
      expect(service.planId()).toBeNull();
      expect(service.isDirty()).toBeFalse();
      expect(service.hasActivity()).toBeFalse();
      expect(service.currentVersion()).toBe(1);
      expect(service.titulo()).toBe('');
      expect(service.descripcion()).toBe('');
      expect(service.fechaInicio()).toBeNull();
      expect(service.fechaFin()).toBeNull();
    });

    it('fija el paciente destino y los punteros del carrito con fisioId', () => {
      service.paciente.set(usuario('pac1'));

      service.loadFromPlan(plan([itemPlan(ejercicio('e1'), 1)]), usuario('pac2', 'Otra'));

      expect(service.paciente()?.id).toBe('pac2');
      expect(CarritoPointers.read()).toEqual({ pacienteId: 'pac2', fisioId: FISIO_ID });
    });

    it('si todos los ejercicios son fantasmas no toca el estado', () => {
      service.paciente.set(usuario('pac1'));
      service.addEjercicio(ejercicio('previo'));
      service.setPlanId('plan_editando');

      const res = service.loadFromPlan(
        plan([itemPlan(ejercicio('ghost', { nombre: '   ' }), 1)]),
        usuario('pac2'),
      );

      expect(res).toEqual({ cargados: 0, omitidos: 1 });
      expect(service.paciente()?.id).toBe('pac1');
      expect(service.items().map((i) => i.ejercicio.id)).toEqual(['previo']);
      expect(service.planId()).toBe('plan_editando');
      expect(CarritoPointers.read()).toBeNull();
    });

    it('persiste el carrito bajo la clave del paciente destino', async () => {
      service.loadFromPlan(plan([itemPlan(ejercicio('e1'), 1)]), usuario('pac2'));

      TestBed.tick();
      await new Promise((r) => setTimeout(r, 450));

      const raw = localStorage.getItem(STORAGE_KEY('pac2'));
      expect(raw).not.toBeNull();
      const persisted = JSON.parse(raw as string);
      expect(persisted.items.length).toBe(1);
      expect(persisted.items[0].ejercicio.id).toBe('e1');
      expect(persisted.paciente.id).toBe('pac2');
    });
  });

  describe('countItemsFor', () => {
    it('cuenta en memoria para el paciente activo', () => {
      service.paciente.set(usuario('pac1'));
      service.addEjercicio(ejercicio('a'));
      service.addEjercicio(ejercicio('b'));

      expect(service.countItemsFor('pac1')).toBe(2);
    });

    it('lee el borrador persistido de otro paciente y devuelve 0 si no hay', () => {
      const now = new Date();
      localStorage.setItem(
        STORAGE_KEY('pac9'),
        JSON.stringify({
          v: 1,
          updatedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 864e5).toISOString(),
          paciente: usuario('pac9'),
          fisioId: FISIO_ID,
          titulo: '',
          descripcion: '',
          fechaInicio: null,
          fechaFin: null,
          drawerOpen: false,
          items: [itemPlan(ejercicio('x'), 1), itemPlan(ejercicio('y'), 2), itemPlan(ejercicio('z'), 3)],
        }),
      );

      expect(service.countItemsFor('pac9')).toBe(3);
      expect(service.countItemsFor('nadie')).toBe(0);
    });
  });
});
