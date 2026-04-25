import { Injectable } from '@angular/core';
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import {
  crossDomainClient,
  convexClient,
} from '@convex-dev/better-auth/client/plugins';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BetterAuthService {
  private authClient = createAuthClient({
    baseURL: environment.CONVEX_SITE_URL,
    plugins: [crossDomainClient(), convexClient(), magicLinkClient()],
  });

  /**
   * Inicia sesion en Better-Auth. Si el usuario no existe, lo crea primero.
   */
  async signIn(
    email: string,
    password: string,
    name?: string,
  ): Promise<boolean> {
    try {
      const result = await this.authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        // Usuario no existe en Better-Auth — crearlo y reintentar
        if (
          result.error.code === 'INVALID_EMAIL_OR_PASSWORD' ||
          result.error.code === 'USER_NOT_FOUND'
        ) {
          return this.signUpAndSignIn(email, password, name);
        }
        console.warn('Better-Auth signIn error:', result.error);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('Better-Auth signIn failed:', err);
      return false;
    }
  }

  /**
   * Registra un nuevo usuario en Better-Auth y luego inicia sesion.
   */
  private async signUpAndSignIn(
    email: string,
    password: string,
    name?: string,
  ): Promise<boolean> {
    try {
      const signUpResult = await this.authClient.signUp.email({
        email,
        password,
        name: name ?? email.split('@')[0],
      });

      if (signUpResult.error) {
        console.warn('Better-Auth signUp error:', signUpResult.error);
        return false;
      }

      // signUp ya deja la sesion activa en better-auth
      return true;
    } catch (err) {
      console.warn('Better-Auth signUp failed:', err);
      return false;
    }
  }

  /**
   * Cierra sesion en Better-Auth.
   */
  async signOut(): Promise<void> {
    try {
      await this.authClient.signOut();
    } catch {
      // Ignorar errores de signOut
    }
  }

  /**
   * Obtiene un token JWT de Convex llamando al endpoint /api/auth/convex/token.
   * El crossDomainClient envía la sesión via header Better-Auth-Cookie.
   */
  async getConvexToken(): Promise<string | null> {
    try {
      const cookie = (this.authClient as any).getCookie?.();
      if (!cookie) return null;

      const res = await fetch(
        `${environment.CONVEX_SITE_URL}/api/auth/convex/token`,
        {
          method: 'GET',
          headers: {
            'Better-Auth-Cookie': cookie,
          },
        },
      );

      if (!res.ok) return null;

      const data = await res.json();
      return data?.token ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Verifica un magic link token (consumo de access token QR).
   * Usa el fetch interno del authClient para que el plugin crossDomain
   * capture el header Set-Better-Auth-Cookie y persista la sesión.
   */
  async verifyMagicLink(token: string): Promise<boolean> {
    try {
      const res = await (this.authClient as any).$fetch(
        '/magic-link/verify',
        { query: { token } },
      );
      if (res?.error) {
        console.warn('Better-Auth magicLink verify error:', res.error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Better-Auth magicLink verify failed:', err);
      return false;
    }
  }

  /**
   * Verifica si hay una sesion Better-Auth almacenada (crossDomain usa localStorage).
   */
  hasStoredSession(): boolean {
    try {
      const cookie = (this.authClient as any).getCookie?.();
      return !!cookie;
    } catch {
      return false;
    }
  }
}
