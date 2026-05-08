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
  Puesto,
} from '@kengo/shared-models';

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
        clinicaId: result.clinicId,
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
          nombreComercial: payload.nombreComercial,
          telefono: payload.telefono,
          email: payload.email,
          web: payload.web,
          direccion: payload.direccion,
          postal: payload.postal,
          nif: payload.nif,
          colorPrimario: payload.colorPrimario,
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
    clinicaId: string,
    payload: UpdateClinicaPayload,
  ): Promise<{ success: boolean; error?: string }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const convexId = clinicaId as Id<'clinics'>;

      const result = await this.convex.mutation(
        api.clinics.mutations.update,
        {
          clinicId: convexId,
          nombre: payload.nombre ?? undefined,
          nombreComercial:
            payload.nombreComercial === undefined
              ? undefined
              : payload.nombreComercial,
          telefono: payload.telefono ?? undefined,
          email: payload.email ?? undefined,
          web: payload.web === undefined ? undefined : payload.web,
          direccion: payload.direccion ?? undefined,
          postal: payload.postal ?? undefined,
          nif: payload.nif ?? undefined,
          colorPrimario: payload.colorPrimario ?? undefined,
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
    clinicaId: string,
    tipo: TipoCodigoAcceso,
    opciones?: { usosMaximos?: number | null; diasExpiracion?: number | null; email?: string | null },
  ): Promise<GenerarCodigoResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const convexId = clinicaId as Id<'clinics'>;

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
      const errorCode: string | undefined = err?.data?.code;
      this.error.set(errorMsg);
      return { success: false, error: errorMsg, errorCode };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Lista los códigos de acceso de una clínica.
   * Si se pasa `tipo`, filtra por ese tipo en backend.
   */
  listarCodigos(
    clinicaId: string,
    tipo?: TipoCodigoAcceso,
  ): Observable<CodigoAcceso[]> {
    const convexId = clinicaId as Id<'clinics'>;

    return from(
      this.convex.query(api.accessCodes.queries.listByClinic, {
        clinicId: convexId,
        tipo,
      }),
    ).pipe(
      map((codes) =>
        (codes ?? []).map((c): CodigoAcceso => ({
          id: c._id,
          codigo: c.codigo,
          tipo: c.tipo,
          activo: c.activo,
          usosMaximos: c.usosMaximos ?? null,
          usosActuales: c.usosActuales,
          fechaExpiracion: c.fechaExpiracion ? new Date(c.fechaExpiracion) : null,
          email: c.email ?? null,
          fechaCreacion: new Date(c._creationTime),
        })),
      ),
    );
  }

  /**
   * Desactiva un código de acceso
   */
  async desactivarCodigo(codigoId: string, clinicaId: string): Promise<{ success: boolean }> {
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
  async reactivarCodigo(codigoId: string, clinicaId: string): Promise<{ success: boolean }> {
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

  tienePuestoEnClinica(clinicaId: string, puesto: Puesto): boolean {
    const usuario = this.sessionService.usuario();
    if (!usuario) return false;
    const clinica = usuario.clinicas.find((c) => c.clinicId === clinicaId);
    if (!clinica) return false;
    return clinica.puesto === puesto;
  }

  esAdminEnClinica(clinicaId: string): boolean {
    return this.tienePuestoEnClinica(clinicaId, 'admin');
  }

  esFisioEnClinica(clinicaId: string): boolean {
    return this.tienePuestoEnClinica(clinicaId, 'fisio');
  }

  puedeGenerarCodigo(clinicaId: string, tipo: TipoCodigoAcceso): boolean {
    const esAdmin = this.esAdminEnClinica(clinicaId);
    const esFisio = this.esFisioEnClinica(clinicaId);
    if (tipo === 'fisioterapeuta') return esAdmin;
    return esAdmin || esFisio;
  }

  puedeGestionarCodigos(clinicaId: string): boolean {
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
