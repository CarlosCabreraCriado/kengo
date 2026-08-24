import { Injectable, inject } from '@angular/core';
import { CapacitorHttp, type HttpOptions, type HttpResponse } from '@capacitor/core';
import { ConvexService } from '../convex/convex.service';
import { api } from '../../../../../../convex/_generated/api';
import { LoggerService } from './logger.service';
import { PlatformService } from './platform.service';

export type UploadPrefix = 'avatars' | 'logos' | 'clinic-files';

export interface UploadResult {
  /** R2 key relativa, ej. `avatars/abc-123.jpg`. Es lo que se guarda en BD. */
  key: string;
  /** URL pública servida desde `assets.kengoapp.com`. */
  url: string;
}

/** Error de subida con el paso en el que falló, para mensajes accionables. */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly stage: 'sign' | 'network' | 'http',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

const DEFAULT_MIME = 'application/octet-stream';

/**
 * Sube archivos directamente a Cloudflare R2 vía presigned URL.
 *
 * Flujo:
 *  1. `convex.storage.actions.generateUploadUrl({ filename, contentType, prefix })`
 *     devuelve `{ uploadUrl, key, publicUrl }` (uploadUrl expira en 5 min).
 *  2. PUT directo del fichero a `uploadUrl` (R2 acepta el binario).
 *     - **Web**: `fetch`. El PUT con `Content-Type` dispara preflight, así que
 *       el origen debe estar en la política CORS del bucket
 *       (`scripts/r2-cors.json`, aplicar con `npm run r2:cors`).
 *     - **Nativo (Capacitor)**: `CapacitorHttp.request` por la pila de red del
 *       sistema. No hay preflight ni CORS: una política CORS incompleta no
 *       puede volver a romper las apps de las stores.
 *  3. La `key` se guarda en la entidad correspondiente (users.avatar,
 *     clinics.logo, clinicFiles.fileId) y se renderiza con `assetUrl(key)`.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private convex = inject(ConvexService);
  private logger = inject(LoggerService);
  private platform = inject(PlatformService);

  async upload(file: File, prefix: UploadPrefix): Promise<UploadResult> {
    const contentType = file.type || DEFAULT_MIME;

    let signed: { uploadUrl: string; key: string; publicUrl: string };
    try {
      signed = await this.convex.action(api.storage.actions.generateUploadUrl, {
        filename: file.name,
        contentType,
        size: file.size,
        prefix,
      });
    } catch (err) {
      this.logger.error('[storage] generateUploadUrl falló', err);
      const motivo = (err as { message?: string })?.message?.replace(/^Uncaught Error:\s*/, '');
      throw new UploadError(
        motivo
          ? `No se pudo preparar la subida: ${motivo}`
          : 'No se pudo preparar la subida. Comprueba tu sesión y vuelve a intentarlo.',
        'sign',
      );
    }

    const { uploadUrl, key, publicUrl } = signed;
    this.logger.info('[storage] PUT', {
      host: safeHost(uploadUrl),
      origin: globalThis.location?.origin,
      native: this.platform.isNative(),
      contentType,
      size: file.size,
    });

    const status = this.platform.isNative()
      ? await this.putNative(uploadUrl, file, contentType)
      : await this.putWeb(uploadUrl, file, contentType);

    if (status < 200 || status >= 300) {
      this.logger.error('[storage] R2 respondió', status);
      throw new UploadError(
        `El almacenamiento rechazó el archivo (HTTP ${status}).`,
        'http',
        status,
      );
    }

    return { key, url: publicUrl };
  }

  /** PUT con `fetch`. Un fallo de red o de CORS lanza `TypeError` antes de tener respuesta. */
  private async putWeb(
    url: string,
    file: File,
    contentType: string,
  ): Promise<number> {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      return res.status;
    } catch (err) {
      this.logger.error('[storage] fetch PUT falló (red/CORS)', err);
      throw new UploadError(
        'No se pudo conectar con el almacenamiento (red o CORS). Revisa la conexión e inténtalo de nuevo.',
        'network',
      );
    }
  }

  /**
   * PUT por la pila nativa. `CapacitorHttp` solo acepta strings, así que el
   * binario viaja en base64 y `dataType: 'file'` hace que Android/iOS lo
   * decodifiquen antes de enviarlo. La URL presignada ya va codificada:
   * `shouldEncodeUrlParams: false` evita que se altere la firma.
   */
  private async putNative(
    url: string,
    file: File,
    contentType: string,
  ): Promise<number> {
    const data = await toBase64(file);
    try {
      const res = await this.nativeRequest({
        url,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        data,
        dataType: 'file',
        shouldEncodeUrlParams: false,
        connectTimeout: 15_000,
        readTimeout: 60_000,
      });
      return res.status;
    } catch (err) {
      this.logger.error('[storage] CapacitorHttp PUT falló', err);
      throw new UploadError(
        'No se pudo conectar con el almacenamiento. Revisa la conexión e inténtalo de nuevo.',
        'network',
      );
    }
  }

  /** Indirección sobre el Proxy del plugin: permite espiarlo en tests. */
  protected nativeRequest(options: HttpOptions): Promise<HttpResponse> {
    return CapacitorHttp.request(options);
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Blob → base64 (sin el prefijo `data:`), vía FileReader para no cargar todo en memoria dos veces. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}
