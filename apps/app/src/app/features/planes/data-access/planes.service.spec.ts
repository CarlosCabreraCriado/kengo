import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { PlanesService } from './planes.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { LoggerService } from '../../../core/services/logger.service';

describe('PlanesService — eliminar plan y actividad', () => {
  let convexStub: {
    watchQuery: jasmine.Spy;
    query: jasmine.Spy;
    mutation: jasmine.Spy;
  };
  let loggerStub: { error: jasmine.Spy };

  function setup(): PlanesService {
    convexStub = {
      watchQuery: jasmine.createSpy('watchQuery').and.returnValue({
        value: signal(undefined),
        isLoading: signal(false),
        error: signal(null),
      }),
      query: jasmine.createSpy('query'),
      mutation: jasmine.createSpy('mutation'),
    };
    loggerStub = { error: jasmine.createSpy('error') };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConvexService, useValue: convexStub },
        { provide: SessionService, useValue: { usuario: signal(null) } },
        {
          provide: ClinicaActivaService,
          useValue: { selectedClinicaId: signal(null) },
        },
        { provide: LoggerService, useValue: loggerStub },
      ],
    });
    return TestBed.inject(PlanesService);
  }

  describe('removePlan', () => {
    it('mapea softDeleted y el id del predecesor restaurado', async () => {
      const service = setup();
      convexStub.mutation.and.resolveTo({
        softDeleted: false,
        predecesorRestaurado: 'kx7pred',
      });

      const result = await service.removePlan('kx7v2');

      expect(result).toEqual({
        softDeleted: false,
        predecesorRestaurado: 'kx7pred',
      });
    });

    it('devuelve predecesorRestaurado null cuando no había versión anterior', async () => {
      const service = setup();
      convexStub.mutation.and.resolveTo({
        softDeleted: true,
        predecesorRestaurado: null,
      });

      const result = await service.removePlan('kx7v1');

      expect(result).toEqual({ softDeleted: true, predecesorRestaurado: null });
    });

    it('devuelve null y loguea si la mutación falla', async () => {
      const service = setup();
      convexStub.mutation.and.rejectWith(new Error('boom'));

      const result = await service.removePlan('kx7x');

      expect(result).toBeNull();
      expect(loggerStub.error).toHaveBeenCalled();
    });
  });

  describe('checkPlanHasActivity', () => {
    it('propaga true/false del backend', async () => {
      const service = setup();
      convexStub.query.and.resolveTo(true);
      expect(await service.checkPlanHasActivity('kx7a')).toBeTrue();
      convexStub.query.and.resolveTo(false);
      expect(await service.checkPlanHasActivity('kx7a')).toBeFalse();
    });

    it('re-lanza el error para que el caller aplique su fallback', async () => {
      const service = setup();
      convexStub.query.and.rejectWith(new Error('sin red'));
      await expectAsync(service.checkPlanHasActivity('kx7a')).toBeRejected();
    });
  });
});
