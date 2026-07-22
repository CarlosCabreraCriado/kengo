# Auditoría de memoria — Convex self-hosted en Railway (2026-07-22)

## Veredicto

Los ~11GB de RAM del servicio **Convex Backend** son **heap real del proceso (memoria anónima), no page cache**. No hay una única fuga: es la suma de un proceso sin reiniciar durante 2 meses, cachés sin límite configurado y un ejecutor Node que acumula módulos con cada deploy.

## Datos medidos (dentro del contenedor, vía `railway ssh`)

| Métrica | Valor |
|---|---|
| `memory.current` (cgroup) | 11.75 GB |
| `anon` (heap real) | **11.51 GB** |
| `file` (page cache) | 0.09 GB |
| Límite del contenedor | 24 GB |
| RSS `convex-local-backend` (Rust, PID 1) | **7.3 GB** |
| RSS `node local.cjs` (ejecutor de acciones "use node") | **4.0 GB** |
| Uptime de ambos procesos | desde el 20 de mayo de 2026 (~2 meses) |
| Binario de la imagen | compilado el 19 de abril de 2026 (~3 meses) |
| Volumen `/convex/data` | 2.1 GB usados de 46 GB (storage 2 GB, tmp 112 MB) |
| Motor de BD | **Postgres** (`postgres.railway.internal`, flag `--db postgres-v5`) — descarta el bug de SQLite #495 |

## Causas identificadas

1. **Ejecutor Node con crecimiento no acotado (4 GB)**. El proceso `local.cjs` es único y vive desde mayo. Su tempdir (`/convex/data/tmp/.tmpNEZW3s`) tiene **1059 bundles**: cada `npx convex deploy`/`codegen`/`dev` (recordar: codegen hace push real a prod) carga un bundle nuevo en el mismo proceso Node, y Node no libera módulos importados. La RAM del ejecutor crece con cada push, para siempre, hasta reiniciar.
2. **Backend Rust en 7.3 GB**: cachés con defaults generosos (~2.5 GB de techo: `SHARED_UDF_CACHE_MAX_SIZE` 1GiB, `INDEX_CACHE_SIZE` 512MiB, `FUNRUN_CODE_CACHE_SIZE` 500MB, etc., ninguno configurado en el servicio) + 2 meses de churn de isolates: los logs muestran reinicios continuos de isolates V8 por `TooMuchMemoryCarryOver (~60MiB/99MiB)` provocados por las funciones de **better-auth** (`adapter.js`, `http.js:default`) en cada login/token/jwks. Ese ciclo constante de crear/destruir isolates fragmenta el asignador (jemalloc) y la memoria retenida crece con el uso.
3. **Sin mecanismo de reciclaje**: no hay límite de memoria por servicio ni restart programado; el contenedor tiene 24 GB de techo y el proceso simplemente sigue creciendo.

## Mitigaciones (estado)

### 1. Capar cachés por variables de entorno (APLICADO 2026-07-22 ~13:37 UTC)

Resultado inmediato tras el redeploy: `memory.current` del contenedor pasó de **11.75 GB a 0.34 GB**; RSS del backend Rust ~400 MB; endpoints `/version` y HTTP actions (jwks de better-auth) respondiendo 200. Variables aplicadas:

```bash
railway variables --skip-deploys \
 --set "SHARED_UDF_CACHE_MAX_SIZE=134217728" \
 --set "INDEX_CACHE_SIZE=134217728" \
 --set "FUNRUN_CODE_CACHE_SIZE=104857600" \
 --set "FUNRUN_MODULE_CACHE_SIZE=67108864" \
 --set "MODULE_CACHE_MAX_SIZE_BYTES=52428800" \
 --set "UDF_CACHE_MAX_SIZE=52428800" \
 --set "MAX_UDF_EXECUTION=200"
railway redeploy
```

Techo de cachés: de ~2.5 GB a ~0.5 GB. Coste: más cache-misses (re-ejecutar queries baratas); para la carga actual de Kengo es asumible. El redeploy además reinicia ambos procesos y recupera de golpe los ~10 GB acumulados.

### 2. Actualizar la imagen (recomendado, dashboard de Railway)

La imagen es de abril de 2026. En el servicio → Settings → Source, fijar un tag reciente **pineado** de `ghcr.io/get-convex/convex-backend` (no `latest` flotante) y actualizar `convex-dashboard` al mismo tag. Hay fixes de memoria/isolates posteriores a abril.

### 3. Reinicio periódico programado (recomendado)

Mientras existan el crecimiento del ejecutor Node por-deploy y la fragmentación por churn de isolates (bugs upstream, no de Kengo), un **redeploy semanal o quincenal** mantiene la RAM a raya. Opciones: cron local/CI que ejecute `railway redeploy --service "Convex Backend"`, o restart manual tras tandas de deploys.

### 4. Higiene que reduce el crecimiento

- Evitar `npx convex codegen`/`dev` contra prod salvo necesidad (cada push alimenta el ejecutor Node). Para typechecking usar `tsc -p convex/tsconfig.json`.
- `RUST_LOG=info` triplica el log de cada petición; bajar a `warn` si no se usan esos logs (no afecta a RAM, sí a ruido/coste de logs).

## Verificación tras aplicar

1. `railway ssh -- ps aux` → RSS del backend ~0.5–1.5 GB y del ejecutor Node ~0.2–0.5 GB tras el arranque.
2. Gráfica de memoria en Railway 48–72h: estabilización esperada en 1.5–3 GB con crecimiento lento (churn de isolates), en vez de 11 GB.
3. Smoke test de la app: login, dashboard de clínica, planes, sesión de paciente.

## Notas

- El seguimiento del crecimiento residual conviene revisarlo tras actualizar la imagen: issues upstream relevantes: get-convex/convex-backend #312 (memory carry-over en isolates), #435 (RAM crece con exports), #225 (requisitos de recursos sin documentar).
- La cascada nocturna de crons (02:00–04:30 UTC) y los `.collect()` de `convex/sync/internal.ts:294,315` y `convex/dashboard/queries.ts` son contribuyentes menores hoy; ver `docs/AUDITORIA_PERFORMANCE.md` (F3/H3).
