import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
} from '@angular/router';
import { SessionService } from '../auth/services/session.service';
import { ToastService } from '../../shared/services/toast/toast.service';

/**
 * Guard que sólo permite el paso si el usuario es admin en la clínica
 * indicada por el `clinicId` de la ruta. Si no se especifica `clinicId`
 * en la URL, comprueba que sea admin en al menos una clínica.
 */
@Injectable({ providedIn: 'root' })
export class ClinicAdminGuard implements CanActivate {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    // Angular ejecuta los guards de un canActivate en paralelo, así que no
    // podemos confiar en que AuthGuard haya terminado de cargar el usuario.
    // Esperamos a que la sesión esté lista antes de evaluar permisos.
    if (!this.session.usuario()) {
      await this.session.cargarMiUsuario();
    }

    const clinicIdParam = route.paramMap.get('clinicId');
    const esAdmin = clinicIdParam
      ? this.session.esAdminEnClinica(clinicIdParam)
      : this.session.esAdmin();

    if (esAdmin) return true;

    this.toast.error('Solo los administradores pueden acceder a esta sección');
    this.router.navigate(['/inicio']);
    return false;
  }
}
