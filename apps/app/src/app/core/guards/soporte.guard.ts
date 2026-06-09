import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ConvexService } from '../convex/convex.service';
import { api } from '../../../../../../convex/_generated/api';

/**
 * Permite el acceso a rutas de soporte (impersonación) solo a técnicos
 * autorizados. La allowlist vive en el servidor (`SUPPORT_USER_IDS`); este guard
 * la consulta vía `impersonation.queries.amISupportTechnician` para no embeber la
 * lista en el bundle del cliente.
 */
@Injectable({ providedIn: 'root' })
export class SoporteGuard implements CanActivate {
  private convex = inject(ConvexService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    try {
      const ok = await this.convex.query(
        api.impersonation.queries.amISupportTechnician,
        {},
      );
      if (ok) return true;
    } catch {
      /* tratar como no autorizado */
    }
    this.router.navigate(['/inicio']);
    return false;
  }
}
