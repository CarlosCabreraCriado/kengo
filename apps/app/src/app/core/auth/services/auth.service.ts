import { Injectable, inject, signal } from '@angular/core';
import { RouteReuseStrategy, Router } from '@angular/router';
import { CustomRouteReuseStrategy } from '../../config/route-reuse-strategy';
import { environment as env } from '../../../../environments/environment';
import { SessionService } from './session.service';
import { BetterAuthService } from './better-auth.service';
import { ConvexService } from '../../convex/convex.service';
import type {
  CreateUsuarioPayload,
  RegistroResult,
  SolicitarRecuperacionResult,
  ResetPasswordResult,
} from '@kengo/shared-models';
import { api } from '../../../../../../../convex/_generated/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private routeReuseStrategy = inject(RouteReuseStrategy) as CustomRouteReuseStrategy;
  private betterAuth = inject(BetterAuthService);
  private convex = inject(ConvexService);

  // Estado reactivo - solo indica si hay sesión activa
  readonly isLoggedIn = signal<boolean>(false);

  /**
   * Inicia sesión vía Better-Auth (Convex). Better-Auth gestiona el refresh
   * automático del token; no necesitamos timer propio.
   */
  async login(email: string, password: string): Promise<void> {
    const usuario = this.sessionService.usuario();
    const nombre = usuario
      ? `${usuario.first_name} ${usuario.last_name}`.trim()
      : undefined;

    const ok = await this.betterAuth.signIn(email, password, nombre);
    if (!ok) throw new Error('CREDENCIALES_INCORRECTAS');

    this.convex.setAuth(() => this.betterAuth.getConvexToken());
    this.isLoggedIn.set(true);
    await this.sessionService.cargarMiUsuario();
  }

  /**
   * Cierra sesión: limpia Better-Auth + Convex + estado local.
   */
  async logout(evitarRedirect?: boolean): Promise<void> {
    try {
      await this.betterAuth.signOut();
    } catch {
      // ignorar
    }
    this.convex.clearAuth();
    this.limpiarEstadoLocal(evitarRedirect);
  }

  /**
   * Limpia el estado local (signals + cache de rutas + storage no esencial).
   */
  limpiarEstadoLocal(evitarRedirect?: boolean): void {
    this.isLoggedIn.set(false);
    this.routeReuseStrategy.clearCache();
    localStorage.removeItem('kengo:theme:v1');
    if (!evitarRedirect) {
      this.router.navigate(['/login'], { state: { fromLogout: true } });
    }
  }

  /**
   * Verifica si hay sesión activa consultando Convex.
   * Better-Auth gestiona el token; si la cookie sigue válida la query a `me`
   * devuelve el usuario y consideramos sesión activa.
   */
  async checkSession(): Promise<boolean> {
    if (!this.betterAuth.hasStoredSession()) {
      this.isLoggedIn.set(false);
      return false;
    }

    try {
      const user = await this.convex.query(api.users.queries.me, {});
      const ok = !!user;
      this.isLoggedIn.set(ok);
      return ok;
    } catch {
      this.isLoggedIn.set(false);
      return false;
    }
  }

  /**
   * Verifica autenticación de forma síncrona (basado en estado local).
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  /**
   * Inicializa la app si hay sesión activa.
   */
  async iniciarApp(): Promise<void> {
    this.restaurarConvexAuth();
    const hasSession = await this.checkSession();
    if (hasSession) {
      await this.sessionService.cargarMiUsuario();
    }
  }

  // =========================
  //  TOKENS DE ACCESO (QR)
  // =========================

  async crearTokenAcceso(
    userId: string,
    opciones?: { usosMaximos?: number; diasExpiracion?: number },
  ): Promise<{ id: string; url: string }> {
    return await this.convex.mutation(api.accessTokens.mutations.create, {
      userId,
      usosMaximos: opciones?.usosMaximos,
      diasExpiracion: opciones?.diasExpiracion,
    });
  }

  async listarTokensAcceso(userId: string) {
    return await this.convex.query(api.accessTokens.queries.listByUser, {
      userId,
    });
  }

  async revocarTokenAcceso(tokenId: string): Promise<void> {
    await this.convex.mutation(api.accessTokens.mutations.revoke, {
      id: tokenId as never,
    });
  }

  async enviarTokenPorEmail(userId: string): Promise<void> {
    await this.convex.action(api.accessTokens.actions.sendByEmail, {
      userId,
    });
  }

  /**
   * Consume un access token (QR / magic link) vía Convex.
   * Flujo: Convex valida el access token → genera un magic link Better-Auth →
   * el cliente lo verifica → Better-Auth establece sesión Convex.
   */
  async consumirTokenAcceso(
    token: string,
  ): Promise<{ tienePassword: boolean; email: string }> {
    const res = await fetch(
      `${env.CONVEX_SITE_URL}/api/auth/consume-access-token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      },
    );

    const body = (await res.json()) as {
      success: boolean;
      error?: string;
      magicLinkToken?: string;
      email?: string;
    };

    if (!body.success || !body.magicLinkToken || !body.email) {
      throw new Error(body.error ?? 'ERROR_CONSUMIENDO_TOKEN');
    }

    const ok = await this.betterAuth.verifyMagicLink(body.magicLinkToken);
    if (!ok) throw new Error('ERROR_VERIFICANDO_MAGIC_LINK');

    this.convex.setAuth(() => this.betterAuth.getConvexToken());
    this.isLoggedIn.set(true);

    return { tienePassword: false, email: body.email };
  }

  /**
   * Establece contraseña para un usuario sin password (post magic link).
   * Usa el endpoint HTTP `/api/auth/convex-set-password` que delega en Better-Auth.
   */
  async establecerPassword(password: string): Promise<void> {
    const email = this.sessionService.usuario()?.email;
    if (!email) throw new Error('Usuario no autenticado');

    const res = await fetch(`${env.CONVEX_SITE_URL}/api/auth/convex-set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({ success: false }));
    if (!res.ok || !body?.success) {
      throw new Error(body?.message || 'Error al establecer la contraseña');
    }
  }

  // =========================
  //  REGISTRO
  // =========================

  async register(payload: CreateUsuarioPayload): Promise<RegistroResult> {
    const result = await this.convex.action(api.auth.actions.register, {
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      email: payload.email.toLowerCase().trim(),
      password: payload.password,
      tipo: payload.tipo,
      codigo_clinica: payload.codigo_clinica?.trim(),
    });
    return result as RegistroResult;
  }

  // =========================
  //  RECUPERACIÓN DE CONTRASEÑA
  // =========================

  async solicitarRecuperacion(
    email: string,
  ): Promise<SolicitarRecuperacionResult> {
    return await this.convex.action(api.auth.actions.requestPasswordReset, {
      email: email.toLowerCase().trim(),
    });
  }

  async resetPassword(
    email: string,
    codigo: string,
    nuevaPassword: string,
  ): Promise<ResetPasswordResult> {
    const res = await fetch(`${env.CONVEX_SITE_URL}/api/auth/convex-reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        codigo,
        nuevaPassword,
      }),
    });
    return (await res.json()) as ResetPasswordResult;
  }

  // =========================
  //  CONVEX AUTH BRIDGE
  // =========================

  /**
   * Restaura la auth de Convex si hay sesión Better-Auth guardada en localStorage.
   */
  private restaurarConvexAuth(): void {
    if (this.betterAuth.hasStoredSession()) {
      this.convex.setAuth(() => this.betterAuth.getConvexToken());
    }
  }
}
