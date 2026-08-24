import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConvexService } from '../convex/convex.service';
import { LoggerService } from './logger.service';
import { PlatformService } from './platform.service';
import { StorageService, UploadError } from './storage.service';

describe('StorageService', () => {
  const signed = {
    uploadUrl: 'https://acc.r2.cloudflarestorage.com/kengo-assets/logos/x.png?X-Amz-Signature=abc',
    key: 'logos/x.png',
    publicUrl: 'https://assets.kengoapp.com/logos/x.png',
  };
  let isNative: ReturnType<typeof signal<boolean>>;
  let action: jasmine.Spy;
  let service: StorageService;
  const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });

  beforeEach(() => {
    isNative = signal(false);
    action = jasmine.createSpy('action').and.resolveTo(signed);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConvexService, useValue: { action } },
        { provide: PlatformService, useValue: { isNative: isNative.asReadonly() } },
        { provide: LoggerService, useValue: { info: () => undefined, error: () => undefined } },
      ],
    });
    service = TestBed.inject(StorageService);
  });

  it('en web hace PUT con fetch y devuelve la key', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 200 }));

    const result = await service.upload(file, 'logos');

    expect(action).toHaveBeenCalledWith(jasmine.anything(), {
      filename: 'logo.png', contentType: 'image/png', size: 3, prefix: 'logos',
    });
    expect(fetchSpy).toHaveBeenCalledWith(signed.uploadUrl, jasmine.objectContaining({ method: 'PUT' }));
    expect(result).toEqual({ key: 'logos/x.png', url: signed.publicUrl });
  });

  it('en web un fallo de red/CORS se reporta como UploadError de red', async () => {
    spyOn(window, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));

    await expectAsync(service.upload(file, 'logos')).toBeRejectedWith(
      jasmine.objectContaining({ name: 'UploadError', stage: 'network' }),
    );
  });

  it('un status no 2xx se reporta como UploadError http con el código', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 403 }));

    await expectAsync(service.upload(file, 'logos')).toBeRejectedWith(
      jasmine.objectContaining({ stage: 'http', status: 403 }),
    );
  });

  it('en nativo usa CapacitorHttp con el binario en base64 y sin recodificar la URL firmada', async () => {
    isNative.set(true);
    const fetchSpy = spyOn(window, 'fetch');
    const httpSpy = spyOn(
      service as unknown as { nativeRequest: StorageService['nativeRequest'] },
      'nativeRequest',
    ).and.resolveTo({ status: 200, data: '', headers: {}, url: signed.uploadUrl });

    const result = await service.upload(file, 'avatars');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(httpSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      url: signed.uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      data: btoa(String.fromCharCode(1, 2, 3)),
      dataType: 'file',
      shouldEncodeUrlParams: false,
    }));
    expect(result.key).toBe('logos/x.png');
  });

  it('si la action de firma falla, el error conserva el motivo del backend', async () => {
    action.and.rejectWith(new Error('Uncaught Error: Tipo de archivo no permitido: text/plain'));

    await expectAsync(service.upload(file, 'logos')).toBeRejectedWithError(
      UploadError, /Tipo de archivo no permitido/,
    );
  });
});
