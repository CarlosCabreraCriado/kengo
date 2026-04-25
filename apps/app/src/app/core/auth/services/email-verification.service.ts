import { Injectable, inject } from '@angular/core';
import { ConvexService } from '../../convex/convex.service';
import { api } from '../../../../../../../convex/_generated/api';
import type {
  EnviarVerificacionResult,
  VerificarEmailResult,
} from '../../../../types/global';

/**
 * Servicio para la verificación de email del usuario.
 * Convex-only: usa actions `auth.actions.sendVerificationCode/verifyEmail`.
 */
@Injectable({ providedIn: 'root' })
export class EmailVerificationService {
  private convex = inject(ConvexService);

  async enviarCodigo(): Promise<EnviarVerificacionResult> {
    return (await this.convex.action(
      api.auth.actions.sendVerificationCode,
      {},
    )) as EnviarVerificacionResult;
  }

  async verificarEmail(codigo: string): Promise<VerificarEmailResult> {
    return (await this.convex.action(api.auth.actions.verifyEmail, {
      codigo,
    })) as VerificarEmailResult;
  }
}
