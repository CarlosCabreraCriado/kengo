import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SessionService } from '../../../core/auth/services/session.service';
import { ConvexService } from '../../../core/convex/convex.service';
import { StorageService, UploadPrefix } from '../../../core/services/storage.service';
import { ClinicasService } from './clinicas.service';
import { api } from '../../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../../convex/_generated/dataModel';
import type {
  CreateClinicaPayload,
  UpdateClinicaPayload,
  VincularClinicaResponse,
  CrearClinicaResponse,
  GenerarCodigoResponse,
  CodigoAcceso,
  TipoCodigoAcceso,
} from '@kengo/shared-models';

// Constantes de puestos
const PUESTO_FISIO = 1;
const PUESTO_ADMIN = 4;

export interface UploadFileResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicaGestionService {
  private sessionService = inject(SessionService);
  private convex = inject(ConvexService);
  private storage = inject(StorageService);
  private clinicasService = inject(ClinicasService);

  // Estado de carga
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Vincula al usuario actual a una clínica mediante código de acceso
   */
  async vincularConCodigo(codigo: string): Promise<VincularClinicaResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.convex.mutation(
        api.accessCodes.mutations.consume,
        { codigo: codigo.trim().toUpperCase() },
      );

      // Recargar datos del usuario para reflejar la nueva clínica
      await this.sessionService.refreshUsuario();

      return {
        success: true,
        clinicaId: result.clinicLegacyId,
        nombreClinica: result.nombreClinica,
        tipo: result.tipo,
      };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al vincular con la clínica';
      this.error.set(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Crea una nueva clínica (el usuario se convierte en administrador)
   */
  async crearClinica(payload: CreateClinicaPayload): Promise<CrearClinicaResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.convex.mutation(
        api.clinics.mutations.create,
        {
          nombre: payload.nombre,
          telefono: payload.telefono,
          email: payload.email,
          direccion: payload.direccion,
          postal: payload.postal,
          nif: payload.nif,
          colorPrimario: payload.color_primario,
        },
      );

      // Recargar datos del usuario para reflejar la nueva clínica
      await this.sessionService.refreshUsuario();

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al crear la clínica';
      this.error.set(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Actualiza los datos de una clínica existente (solo para administradores)
   */
  async actualizarClinica(
    clinicaId: number,
    payload: UpdateClinicaPayload,
  ): Promise<{ success: boolean; error?: string }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const convexId = this.clinicasService.legacyToConvexClinicId().get(clinicaId);
      if (!convexId) {
        return { success: false, error: 'Clínica no encontrada' };
      }

      const result = await this.convex.mutation(
        api.clinics.mutations.update,
        {
          clinicId: convexId,
          nombre: payload.nombre ?? undefined,
          telefono: payload.telefono ?? undefined,
          email: payload.email ?? undefined,
          direccion: payload.direccion ?? undefined,
          postal: payload.postal ?? undefined,
          nif: payload.nif ?? undefined,
          colorPrimario: payload.color_primario ?? undefined,
          logo: payload.logo ?? undefined,
          addImageKeys: payload.imagenes?.create,
          removeImageIds: payload.imagenes?.delete as
            | Id<'clinicFiles'>[]
            | undefined,
        },
      );

      const orphaned = result?.orphanedKeys ?? [];
      if (orphaned.length > 0) {
        await Promise.allSettled(
          orphaned.map((k) => this.storage.delete(k)),
        );
      }

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al actualizar la clínica';
      this.error.set(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Genera un nuevo código de acceso para una clínica
   */
  async generarCodigo(
    clinicaId: number,
    tipo: TipoCodigoAcceso,
    opciones?: { usosMaximos?: number | null; diasExpiracion?: number | null; email?: string | null },
  ): Promise<GenerarCodigoResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const convexId = this.clinicasService.legacyToConvexClinicId().get(clinicaId);
      if (!convexId) {
        return { success: false, error: 'Clínica no encontrada' };
      }

      // Calcular fecha de expiracion si se proporcionan dias
      let fechaExpiracion: string | undefined;
      if (opciones?.diasExpiracion) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + opciones.diasExpiracion);
        fechaExpiracion = fecha.toISOString();
      }

      const result = await this.convex.mutation(
        api.accessCodes.mutations.create,
        {
          clinicId: convexId,
          tipo,
          usosMaximos: opciones?.usosMaximos ?? undefined,
          fechaExpiracion,
          email: opciones?.email ?? undefined,
        },
      );

      return {
        success: true,
        codigo: result.codigo,
      };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al generar código';
      this.error.set(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Lista los códigos de acceso de una clínica
   */
  listarCodigos(clinicaId: number): Observable<CodigoAcceso[]> {
    const convexId = this.clinicasService.legacyToConvexClinicId().get(clinicaId);
    if (!convexId) {
      return from(Promise.resolve([]));
    }

    return from(
      this.convex.query(api.accessCodes.queries.listByClinic, { clinicId: convexId }),
    ).pipe(
      map((codes) =>
        (codes ?? []).map((c): CodigoAcceso => ({
          id: c._id as unknown as number, // Convex ID stored as 'id' for compat
          codigo: c.codigo,
          tipo: c.tipo,
          activo: c.activo,
          usosMaximos: c.usosMaximos ?? null,
          usosActuales: c.usosActuales,
          fechaExpiracion: c.fechaExpiracion ? new Date(c.fechaExpiracion) : null,
          email: c.email ?? null,
          fechaCreacion: new Date(c._creationTime),
          // Store Convex ID for mutations
          _convexId: c._id,
        } as CodigoAcceso & { _convexId: string })),
      ),
    );
  }

  /**
   * Desactiva un código de acceso
   */
  async desactivarCodigo(codigoId: number | string, clinicaId: number): Promise<{ success: boolean }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      // codigoId es el Convex ID (almacenado en 'id' del CodigoAcceso)
      await this.convex.mutation(
        api.accessCodes.mutations.deactivate,
        { codeId: codigoId as unknown as Id<'accessCodes'> },
      );
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al desactivar código';
      this.error.set(errorMsg);
      return { success: false };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Reactiva un código de acceso
   */
  async reactivarCodigo(codigoId: number | string, clinicaId: number): Promise<{ success: boolean }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.convex.mutation(
        api.accessCodes.mutations.reactivate,
        { codeId: codigoId as unknown as Id<'accessCodes'> },
      );
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.data?.message || err?.message || 'Error al reactivar código';
      this.error.set(errorMsg);
      return { success: false };
    } finally {
      this.loading.set(false);
    }
  }

  // =========================
  //  HELPERS DE PERMISOS
  // =========================

  tienePuestoEnClinica(clinicaId: number, puestoId: number): boolean {
    const usuario = this.sessionService.usuario();
    if (!usuario) return false;
    const clinica = usuario.clinicas.find((c) => c.id_clinica === clinicaId);
    if (!clinica) return false;
    return clinica.id_puesto === puestoId;
  }

  esAdminEnClinica(clinicaId: number): boolean {
    return this.tienePuestoEnClinica(clinicaId, PUESTO_ADMIN);
  }

  esFisioEnClinica(clinicaId: number): boolean {
    return this.tienePuestoEnClinica(clinicaId, PUESTO_FISIO);
  }

  puedeGenerarCodigo(clinicaId: number, tipo: TipoCodigoAcceso): boolean {
    const esAdmin = this.esAdminEnClinica(clinicaId);
    const esFisio = this.esFisioEnClinica(clinicaId);
    if (tipo === 'fisioterapeuta') return esAdmin;
    return esAdmin || esFisio;
  }

  puedeGestionarCodigos(clinicaId: number): boolean {
    return this.esAdminEnClinica(clinicaId) || this.esFisioEnClinica(clinicaId);
  }

  /**
   * Sube un archivo directamente a R2 vía presigned URL.
   * Devuelve la R2 key como `fileId` (la entidad correspondiente la guarda
   * y se renderiza con `assetUrl(fileId)`).
   */
  async uploadFile(
    file: File,
    prefix: UploadPrefix = 'clinic-files',
  ): Promise<UploadFileResult> {
    try {
      const result = await this.storage.upload(file, prefix);
      return { success: true, fileId: result.key };
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message || 'Error al subir el archivo';
      return { success: false, error: errorMsg };
    }
  }
}
