/**
 * Normaliza la URL de un deep link a una ruta absoluta (`/path?query#hash`)
 * comparable con las rutas de Angular.
 *
 * Para esquemas custom (`kengo://billing/return`), el parser WHATWG interpreta
 * el primer segmento tras `//` como HOST, no como parte del path:
 * `new URL('kengo://billing/return').pathname` es `/return` y su `host` es
 * `billing`. Si nos quedáramos con `pathname` perderíamos el `billing`, y una
 * comparación como `path.startsWith('/billing/return')` fallaría. Por eso
 * recomponemos `/{host}{pathname}`.
 *
 * Para universal links (`https://kengoapp.com/billing/return`) el host es el
 * dominio y la ruta real ya vive en `pathname`.
 */
export function normalizeAppUrlPath(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  const tail = `${parsed.search}${parsed.hash}`;

  if (parsed.protocol === 'kengo:') {
    return `/${parsed.host}${parsed.pathname}${tail}`;
  }

  return `${parsed.pathname}${tail}`;
}
