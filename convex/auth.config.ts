import type { AuthConfig } from "convex/server";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

/**
 * Provider que Convex usa para validar el JWT que llega en cada request.
 *
 * `getAuthConfigProvider()` devuelve un `customJwt` con:
 *   - applicationID = "convex"   (literal hardcoded en el plugin Better-Auth;
 *                                 el plugin filtra providers por este id y
 *                                 falla en bootstrap si no encuentra uno).
 *   - issuer        = CONVEX_SITE_URL  (env var inyectada por Convex).
 *   - algorithm     = "RS256"    (informativo; el `alg` real de cada JWK se
 *                                 sobrescribe desde la propia clave en BD).
 *   - jwks          = `${CONVEX_SITE_URL}/api/auth/convex/jwks`  (fetch
 *                                 dinámico contra el endpoint del plugin).
 *
 * Optimización opcional pendiente: pasar `jwks: process.env.JWKS` para usar
 * JWKS estático (data URI embebido) en vez del fetch dinámico. Reduce
 * latencia de validación y elimina una dependencia de red, pero requiere
 * regenerar con `npx convex run auth:generateJwk | npx convex env set JWKS`
 * cada vez que se rote la clave. Documentado en
 * `docs/AUTH_HARDENING_PLAN.md` como mejora futura.
 */
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
