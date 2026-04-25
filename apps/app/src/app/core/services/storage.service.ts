import { Injectable, inject } from '@angular/core';
import { ConvexService } from '../convex/convex.service';
import { api } from '../../../../../../convex/_generated/api';

export type UploadPrefix = 'avatars' | 'logos' | 'clinic-files';

export interface UploadResult {
  /** R2 key relativa, ej. `avatars/abc-123.jpg`. Es lo que se guarda en BD. */
  key: string;
  /** URL pública servida desde `assets.kengoapp.com`. */
  url: string;
}

/**
 * Sube archivos directamente a Cloudflare R2 vía presigned URL.
 *
 * Flujo:
 *  1. `convex.storage.actions.generateUploadUrl({ filename, contentType, prefix })`
 *     devuelve `{ uploadUrl, key, publicUrl }` (uploadUrl expira en 5 min).
 *  2. PUT directo del fichero a `uploadUrl` (R2 acepta el binario).
 *  3. La `key` se guarda en la entidad correspondiente (users.avatar,
 *     clinics.logo, clinicFiles.fileId) y se renderiza con `assetUrl(key)`.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private convex = inject(ConvexService);

  async upload(file: File, prefix: UploadPrefix): Promise<UploadResult> {
    const { uploadUrl, key, publicUrl } = await this.convex.action(
      api.storage.actions.generateUploadUrl,
      {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        prefix,
      },
    );

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!res.ok) {
      throw new Error(
        `Error subiendo archivo a R2: ${res.status} ${res.statusText}`,
      );
    }

    return { key, url: publicUrl };
  }

  /**
   * Borra un objeto de R2 por su key. Útil para limpiar avatares antiguos
   * cuando el usuario sube uno nuevo.
   */
  async delete(key: string): Promise<void> {
    await this.convex.action(api.storage.actions.deleteObject, { key });
  }
}
