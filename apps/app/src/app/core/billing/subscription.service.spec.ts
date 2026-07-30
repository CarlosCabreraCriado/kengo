import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { SubscriptionService } from './subscription.service';
import { ConvexService } from '../convex/convex.service';
import { SessionService } from '../auth/services/session.service';
import { ClinicaActivaService } from '../auth/services/clinica-activa.service';
import { ExternalBrowserService } from '../services/external-browser.service';
import { PlatformService } from '../services/platform.service';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../../shared/services/toast/toast.service';

describe('SubscriptionService — guard de pagos en nativo', () => {
  let convexStub: {
    watchQuery: jasmine.Spy;
    action: jasmine.Spy;
  };
  let toastStub: {
    info: jasmine.Spy;
    error: jasmine.Spy;
    success: jasmine.Spy;
  };
  let browserStub: { redirect: jasmine.Spy };

  function setup(isNative: boolean): SubscriptionService {
    convexStub = {
      watchQuery: jasmine.createSpy('watchQuery').and.returnValue({
        value: signal(undefined),
        isLoading: signal(false),
        error: signal(null),
      }),
      action: jasmine
        .createSpy('action')
        .and.resolveTo({ url: 'https://stripe.test/session' }),
    };
    toastStub = {
      info: jasmine.createSpy('info'),
      error: jasmine.createSpy('error'),
      success: jasmine.createSpy('success'),
    };
    browserStub = { redirect: jasmine.createSpy('redirect').and.resolveTo() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConvexService, useValue: convexStub },
        { provide: SessionService, useValue: { misclinicas: signal([]) } },
        {
          provide: ClinicaActivaService,
          useValue: { selectedClinicaId: signal(null) },
        },
        { provide: ToastService, useValue: toastStub },
        { provide: ExternalBrowserService, useValue: browserStub },
        { provide: PlatformService, useValue: { isNative: signal(isNative) } },
        {
          provide: LoggerService,
          useValue: { error: jasmine.createSpy('error') },
        },
      ],
    });
    return TestBed.inject(SubscriptionService);
  }

  describe('en build nativo', () => {
    it('pagosSoloWeb() es true', () => {
      const service = setup(true);
      expect(service.pagosSoloWeb()).toBeTrue();
    });

    it('iniciarCheckout es no-op con toast informativo', async () => {
      const service = setup(true);
      await service.iniciarCheckout('clinic-1');
      expect(convexStub.action).not.toHaveBeenCalled();
      expect(browserStub.redirect).not.toHaveBeenCalled();
      expect(toastStub.info).toHaveBeenCalled();
    });

    it('abrirPortal es no-op con toast informativo', async () => {
      const service = setup(true);
      await service.abrirPortal('clinic-1');
      expect(convexStub.action).not.toHaveBeenCalled();
      expect(browserStub.redirect).not.toHaveBeenCalled();
      expect(toastStub.info).toHaveBeenCalled();
    });

    it('reactivar es no-op con toast informativo', async () => {
      const service = setup(true);
      await service.reactivar('clinic-1');
      expect(convexStub.action).not.toHaveBeenCalled();
      expect(toastStub.info).toHaveBeenCalled();
    });

    it('cambiarVariante devuelve false sin llamar al backend', async () => {
      const service = setup(true);
      const resultado = await service.cambiarVariante('clinic-1', 'ilimitada');
      expect(resultado).toBeFalse();
      expect(convexStub.action).not.toHaveBeenCalled();
      expect(toastStub.info).toHaveBeenCalled();
    });

    it('cancelar SÍ llega al backend (cancelar no exige IAP)', async () => {
      const service = setup(true);
      await service.cancelar('clinic-1');
      expect(convexStub.action).toHaveBeenCalled();
      expect(toastStub.info).not.toHaveBeenCalled();
    });
  });

  describe('en web', () => {
    it('pagosSoloWeb() es false', () => {
      const service = setup(false);
      expect(service.pagosSoloWeb()).toBeFalse();
    });

    it('iniciarCheckout llega al backend y redirige', async () => {
      const service = setup(false);
      await service.iniciarCheckout('clinic-1');
      expect(convexStub.action).toHaveBeenCalled();
      expect(browserStub.redirect).toHaveBeenCalledWith(
        'https://stripe.test/session',
      );
      expect(toastStub.info).not.toHaveBeenCalled();
    });

    it('abrirPortal llega al backend y redirige', async () => {
      const service = setup(false);
      await service.abrirPortal('clinic-1');
      expect(convexStub.action).toHaveBeenCalled();
      expect(browserStub.redirect).toHaveBeenCalled();
    });

    it('cambiarVariante llega al backend', async () => {
      const service = setup(false);
      const resultado = await service.cambiarVariante('clinic-1', 'ilimitada');
      expect(resultado).toBeTrue();
      expect(convexStub.action).toHaveBeenCalled();
    });
  });
});
