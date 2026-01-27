import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import { SessionService } from '../../../core/auth/services/session.service';
import type {
  CreateClinicaPayload,
  UpdateClinicaPayload,
  VincularClinicaPayload,
  VincularClinicaResponse,
  CrearClinicaResponse,
  GenerarCodigoPayload,
  GenerarCodigoResponse,
  CodigoAcceso,
  TipoCodigoAcceso,
  PUESTO_ADMINISTRADOR,
  PUESTO_FISIOTERAPEUTA,
} from '@kengo/shared-models';

// Constantes de puestos
const PUESTO_FISIO = 1;
const PUESTO_PAC = 2;
const PUESTO_ADMIN = 4;

@Injectable({ providedIn: 'root' })
export class ClinicaGestionService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);

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
      const payload: VincularClinicaPayload = { codigo: codigo.trim().toUpperCase() };
      const response = await firstValueFrom(
        this.http.post<VincularClinicaResponse>(
          `${env.API_URL}/clinica/vincular`,
          payload,
          { withCredentials: true }
        )
      );

      if (response.success) {
        // Recargar datos del usuario para reflejar la nueva clínica
        await this.sessionService.refreshUsuario();
      }

      return response;
    } catch (err: any) {
      const errorMsg = err?.error?.error || 'Error al vincular con la clínica';
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
      const response = await firstValueFrom(
        this.http.post<CrearClinicaResponse>(
          `${env.API_URL}/clinica/crear`,
          payload,
          { withCredentials: true }
        )
      );

      if (response.success) {
        // Recargar datos del usuario para reflejar la nueva clínica
        await this.sessionService.refreshUsuario();
      }

      return response;
    } catch (err: any) {
      const errorMsg = err?.error?.error || 'Error al crear la clínica';
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
    payload: UpdateClinicaPayload
  ): Promise<{ success: boolean; error?: string }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.patch<{ data: unknown }>(
          `${env.DIRECTUS_URL}/items/clinicas/${clinicaId}`,
          payload
        )
      );

      if (response?.data) {
        return { success: true };
      }

      return { success: false, error: 'Error al actualizar la clínica' };
    } catch (err: any) {
      const errorMsg = err?.error?.errors?.[0]?.message || err?.message || 'Error al actualizar la clínica';
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
    opciones?: { usosMaximos?: number | null; diasExpiracion?: number | null; email?: string | null }
  ): Promise<GenerarCodigoResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const payload: GenerarCodigoPayload = {
        id_clinica: clinicaId,
        tipo,
        usos_maximos: opciones?.usosMaximos,
        dias_expiracion: opciones?.diasExpiracion,
        email: opciones?.email,
      };

      const response = await firstValueFrom(
        this.http.post<GenerarCodigoResponse>(
          `${env.API_URL}/clinica/codigo/generar`,
          payload,
          { withCredentials: true }
        )
      );

      return response;
    } catch (err: any) {
      const errorMsg = err?.error?.error || 'Error al generar código';
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
    return this.http.get<CodigoAcceso[]>(
      `${env.API_URL}/clinica/${clinicaId}/codigos`,
      { withCredentials: true }
    ).pipe(
      map(codigos => codigos.map(c => ({
        ...c,
        fechaExpiracion: c.fechaExpiracion ? new Date(c.fechaExpiracion) : null,
        fechaCreacion: new Date(c.fechaCreacion),
      })))
    );
  }

  /**
   * Desactiva un código de acceso
   */
  async desactivarCodigo(codigoId: number, clinicaId: number): Promise<{ success: boolean }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.patch<{ success: boolean }>(
          `${env.API_URL}/clinica/codigo/${codigoId}/desactivar`,
          { clinicaId },
          { withCredentials: true }
        )
      );

      return response;
    } catch (err: any) {
      const errorMsg = err?.error?.error || 'Error al desactivar código';
      this.error.set(errorMsg);
      return { success: false };
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Reactiva un código de acceso
   */
  async reactivarCodigo(codigoId: number, clinicaId: number): Promise<{ success: boolean }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.patch<{ success: boolean }>(
          `${env.API_URL}/clinica/codigo/${codigoId}/reactivar`,
          { clinicaId },
          { withCredentials: true }
        )
      );

      return response;
    } catch (err: any) {
      const errorMsg = err?.error?.error || 'Error al reactivar código';
      this.error.set(errorMsg);
      return { success: false };
    } finally {
      this.loading.set(false);
    }
  }

  // =========================
  //  HELPERS DE PERMISOS
  // =========================

  /**
   * Verifica si el usuario tiene un puesto específico en una clínica
   */
  tienePuestoEnClinica(clinicaId: number, puestoId: number): boolean {
    const usuario = this.sessionService.usuario();
    if (!usuario) return false;

    const clinica = usuario.clinicas.find(c => c.id_clinica === clinicaId);
    if (!clinica) return false;

    return clinica.id_puesto === puestoId;
  }

  /**
   * Verifica si el usuario es administrador de una clínica
   */
  esAdminEnClinica(clinicaId: number): boolean {
    return this.tienePuestoEnClinica(clinicaId, PUESTO_ADMIN);
  }

  /**
   * Verifica si el usuario es fisioterapeuta en una clínica
   */
  esFisioEnClinica(clinicaId: number): boolean {
    return this.tienePuestoEnClinica(clinicaId, PUESTO_FISIO);
  }

  /**
   * Verifica si el usuario puede generar códigos de un tipo específico
   */
  puedeGenerarCodigo(clinicaId: number, tipo: TipoCodigoAcceso): boolean {
    const esAdmin = this.esAdminEnClinica(clinicaId);
    const esFisio = this.esFisioEnClinica(clinicaId);

    if (tipo === 'fisioterapeuta') {
      return esAdmin;
    }

    // tipo === 'paciente'
    return esAdmin || esFisio;
  }

  /**
   * Verifica si el usuario puede ver/gestionar códigos
   */
  puedeGestionarCodigos(clinicaId: number): boolean {
    return this.esAdminEnClinica(clinicaId) || this.esFisioEnClinica(clinicaId);
  }
}
