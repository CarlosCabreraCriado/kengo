# media — proxy de respaldo de R2 (Railway)

Sirve los objetos del bucket R2 (`kengo-assets`) desde Railway, **sin Cloudflare
delante**, en `media.kengoapp.com`. Es el plan B cuando los operadores españoles
bloquean las IPs de Cloudflare durante los partidos de LaLiga y
`assets.kengoapp.com` deja de responder. Contexto completo en
`docs/INFRAESTRUCTURA_RED.md`.

## Contrato

Mismas URLs que `assets.kengoapp.com`, cambiando solo el host:

```
GET /cdn-cgi/image/width=400,height=300,fit=cover,format=webp,quality=80,onerror=redirect/planes/<uuid>.webp
GET /planes/<uuid>.webp?width=400&height=300&fit=cover&format=webp   (legacy, compat)
GET /videos/<uuid>.mp4            (Range soportado → 206)
GET /health                       (Railway healthcheck)
```

Es la misma ruta `/cdn-cgi/image/<opciones>/<key>` de Cloudflare Image
Transformations (la única que Cloudflare interpreta: los query params **no**
transforman en `assets.`). Opciones: `width`/`w`, `height`/`h` (≤
`MEDIA_MAX_DIM`, 2048), `fit` (`cover|contain|inside|outside|scale-down|crop|pad|squeeze`),
`format`/`f` (`webp|jpg|png|avif|auto`; `auto` negocia por `Accept`), `quality`/`q`
(1–100). Las desconocidas (`onerror`, `dpr`…) se ignoran. Se procesan con
`sharp` y se cachean en memoria (LRU acotada por `MEDIA_CACHE_MB`, 256 MB por
defecto). Vídeos, PDF y `txt` se hacen streaming, también bajo `/cdn-cgi/image/`.

## Servicio en Railway

- Servicio nuevo del mismo repo, root del monorepo.
- Build Command: `npm run railway:build:media` (no compila nada; instala deps).
- Start Command: `npm run railway:start:media`.
- Healthcheck: `/health`.
- Variables: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET` (copiar del deployment de Convex). Opcionales `MEDIA_CACHE_MB`,
  `MEDIA_MAX_DIM`.
- Dominio custom `media.kengoapp.com` en Railway y, en Cloudflare DNS, un
  CNAME **solo DNS (nube gris)** al target que dé Railway. Nunca proxied: la
  gracia es que su IP sea de Railway.

## Verificación

```sh
curl -I "https://media.kengoapp.com/health"
curl -I "https://media.kengoapp.com/cdn-cgi/image/width=400,format=webp/<key>.webp"   # 200 image/webp
curl -I "https://media.kengoapp.com/<key>.webp?width=400&format=webp"                 # legacy, 200 image/webp
curl -sI -r 0-1023 "https://media.kengoapp.com/<key>.mp4" | head -5      # 206 + Content-Range
```
