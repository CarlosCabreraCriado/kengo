# Infraestructura de red: dominios, Railway y Cloudflare

Fuente de verdad de la topología de red de Kengo. La configuración DNS vive
en el dashboard de Cloudflare (zona `kengoapp.com`, NS `kay`/`dexter`) y no
está versionada en ningún otro sitio: **cualquier cambio de proxy/DNS se
refleja aquí**.

## Regla de oro

**Ningún host de la ruta crítica de la app puede estar detrás del proxy de
Cloudflare (nube naranja).** Motivo: desde febrero de 2025 los operadores
españoles bloquean por IP el proxy de Cloudflare durante los partidos de
LaLiga (ver "Contexto" abajo) y la app quedaba inutilizable cada fin de
semana. Cloudflare se sigue usando como **DNS, R2 e Image Transformations**;
el único host que permanece proxied es `assets.` (R2 no admite otra cosa) y
tiene fallback automático a `media.`.

## Mapa de hosts

| Host | Servicio | Plataforma | Cloudflare | Notas |
|---|---|---|---|---|
| `kengoapp.com` | App Angular (`apps/app`), servicio Railway "kengo" | Railway | **Solo DNS** (CNAME `5crr1qfl.up.railway.app`) | TLS lo emite Railway (Let's Encrypt). App Links / AASA se sirven desde aquí. |
| `www.kengoapp.com` | Landing (`apps/landingpage`), servicio "Kengo WEB" | Railway | **Solo DNS** (CNAME `b15rmfm0.up.railway.app`) | Prerender SSG + `compression` en `server.js`. |
| `api.kengoapp.com` | Directus (catálogo de ejercicios) | Railway | **Solo DNS** (CNAME `69km5j75.up.railway.app`) | Solo lo consume el cron `directus-catalog-sync` (04:00 UTC). |
| `admin.kengoapp.com` | Directus (panel de administración) | Railway | **Solo DNS** (CNAME `g629whh1.up.railway.app`) | Uso interno. |
| `convex.kengoapp.com` | Convex self-hosted, WebSocket (puerto 3210) | Railway | Solo DNS → `69.46.46.49` | `CONVEX_URL`. |
| `backend.kengoapp.com` | Convex HTTP actions, Better-Auth, webhook Stripe (3211) | Railway | Solo DNS → `69.46.46.103` | `CONVEX_SITE_URL`. |
| `assets.kengoapp.com` | Bucket R2 `kengo-assets` (dominio custom) + Image Transformations | Cloudflare | **Proxied (obligatorio)** | `ASSETS_URL`. Único host que cae durante los bloqueos. |
| `media.kengoapp.com` | Proxy de respaldo de R2 (`apps/media`) | Railway | **Solo DNS** | `ASSETS_FALLBACK_URL`. Mismo contrato de URLs que `assets.`. |

Comprobación rápida (todo excepto `assets.` debe devolver IPs de Railway
`69.46.46.x`, AS400940, y **no** `104.21.x`/`172.67.x`, AS13335):

```sh
for h in kengoapp.com www.kengoapp.com api.kengoapp.com media.kengoapp.com convex.kengoapp.com backend.kengoapp.com assets.kengoapp.com; do
  echo "$h -> $(dig +short A $h | tr '\n' ' ')"; done
curl -sI https://kengoapp.com | grep -iE '^server|cf-ray'   # server: railway-hikari, sin cf-ray
```

## Cómo funciona el fallback de assets

1. `AssetHostService` (`apps/app/src/app/core/services/asset-host.service.ts`)
   sondea `https://assets.kengoapp.com/health.txt` al arrancar (no bloqueante,
   `mode: 'no-cors'`, timeout 3 s), cada 5 min, al recuperar la red y al
   volver del background (`AppLifecycleService.onResume`).
2. Si el primario no responde **y** `media.` sí, escribe la base de respaldo
   en el signal `assetsBase` (`core/utils/asset-host.store.ts`). `assetUrl()`
   y `kengoImageLoader()` leen ese signal, así que todas las imágenes y vídeos
   se re-renderizan contra `media.` sin tocar ningún caller.
3. `OfflineBannerComponent` muestra "Conexión limitada por tu operador"
   mientras el fallback esté activo, y "Reconectando…" si el WebSocket de
   Convex lleva > 8 s caído (`ConvexService.isConnected` refleja ahora
   `subscribeToConnectionState`).
4. En cuanto `assets.` vuelve a responder, se regresa al CDN.

`apps/media/server.js` acepta los mismos query params que Cloudflare Image
Transformations (`width`, `height`, `fit`, `format`, `quality`) usando
`sharp`, y hace streaming con `Range` para vídeo. Detalles y variables en
`apps/media/README.md`.

## Procedimiento de reversión

Si hubiera que volver a poner un host tras el proxy (p. ej. ataque DDoS):
en Cloudflare DNS, editar el registro y activar la nube naranja; el TTL es
automático (≈5 min). Mientras esté proxied ese host **caerá durante los
partidos**; hacerlo solo de forma temporal y anotarlo aquí.

## Checklist de fin de semana (jornada de LaLiga)

1. `https://hayahora.futbol/` — comprobar si hay bloqueos activos y cruzar
   con `dig +short A assets.kengoapp.com` contra
   `https://hayahora.futbol/estado/blocked-any.txt`.
2. Desde una línea de Movistar/Digi (móvil con datos, sin VPN) abrir la app
   durante un partido: deben verse imágenes (cabecera `X-Kengo-Media:
   railway-fallback` en DevTools) y el banner "Conexión limitada por tu
   operador".
3. Verificar `https://media.kengoapp.com/health` → `OK`.

## Contexto: los bloqueos de LaLiga

- Auto del Juzgado Mercantil nº 6 de Barcelona (18-dic-2024), confirmado el
  26-mar-2025 tras rechazar las nulidades de Cloudflare y RootedCON. Obliga a
  Movistar/O2, Vodafone, MasOrange (Orange, Jazztel, Yoigo, MásMóvil,
  Pepephone) y Digi a bloquear las IPs que LaLiga señale durante los partidos,
  sin revisión judicial individual. Vigente hasta el final de la temporada
  2026/27 (20-jun-2027).
- El bloqueo es por IP a nivel de routing (Movistar: black hole; MásMóvil:
  silencioso; Digi: página de aviso; Orange/Vodafone: bloqueo con
  excepciones), así que cambiar de DNS o usar ECH no lo evita.
- Datos de `hayahora.futbol` para la jornada del 22–23 de agosto de 2026:
  1.156 de 1.812 IPs de Cloudflare monitorizadas bloqueadas; IPs de R2
  incluidas. Railway (AS400940) no aparece en el histórico.
- Referencias: https://bandaancha.eu/bloqueos-futbol,
  https://hayahora.futbol/, https://afectadosporlaliga.palbin.com/.

## Histórico

- **2026-08-24**: se documenta la topología y se pasan a "solo DNS" vía API
  `kengoapp.com`, `www`, `api` y `admin` (antes proxied, IPs
  `104.21.55.88` / `172.67.146.93`). Ajustes de zona que se revisaron y no
  hubo que tocar: `always_use_https: on` (Railway ya redirige 301 http→https),
  `ssl: strict`, HSTS desactivado, sin Page Rules; la única Cache Rule
  (`assets-r2-long-cache-kengo`) aplica solo a `assets.`. Se crea
  `apps/media` y el fallback automático en la app; **pendiente** el CNAME
  `media.kengoapp.com` (solo DNS) al target que dé Railway.
