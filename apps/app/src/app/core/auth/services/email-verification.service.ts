import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment as env } from '../../../../environments/environment';
import type {
  EnviarVerificacionResult,
  VerificarEmailResult,
} from '../../../../types/global';

/**
 * Servicio para la verificación de email del usuario
 */
@Injectable({ providedIn: 'root' })
export class EmailVerificationService {
  private http = inject(HttpClient);

  /**
   * Envía un código de verificación al email del usuario autenticado
   */
  async enviarCodigo(): Promise<EnviarVerificacionResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<EnviarVerificacionResult>(
          `${env.API_URL}/auth/enviar-verificacion`,
          {},
          { withCredentials: true }
        )
      );
      return res;
    } catch (error: any) {
      if (error.status === 429) {
        return {
          success: false,
          message: 'Has solicitado demasiados códigos. Inténtalo en una hora.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }
      return {
        success: false,
        message: error.error?.message || 'Error enviando el código',
        code: error.error?.code || 'SERVER_ERROR',
      };
    }
  }

  /**
   * Verifica el email con el código proporcionado
   */
  async verificarEmail(codigo: string): Promise<VerificarEmailResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<VerificarEmailResult>(
          `${env.API_URL}/auth/verificar-email`,
          { codigo },
          { withCredentials: true }
        )
      );
      return res;
    } catch (error: any) {
      return {
        success: false,
        message: error.error?.message || 'Error verificando el email',
        code: error.error?.code || 'SERVER_ERROR',
      };
    }
  }
}
