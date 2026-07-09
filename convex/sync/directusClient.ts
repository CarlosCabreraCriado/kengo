/**
 * Cliente HTTP minimalista para leer colecciones de Directus desde actions
 * Convex. Solo READ — la sincronización es one-way (Directus → Convex).
 *
 * Variables de entorno requeridas (configurar con `npx convex env set`):
 *   DIRECTUS_URL          URL base sin barra final (ej. https://cms.kengoapp.com)
 *   DIRECTUS_SYNC_TOKEN   static token con permisos read sobre las 3 colecciones
 */

export type DirectusCategoria = {
  id_categoria: number;
  nombre_categoria: string | null;
  date_created: string | null;
  date_updated: string | null;
};

export type DirectusEjercicio = {
  id_ejercicio: number;
  nombre_ejercicio: string | null;
  descripcion: string | null;
  es_por_duracion: boolean | null;
  series_defecto: string | number | null;
  repeticiones_defecto: string | number | null;
  duracion_defecto: string | number | null;
  video: string | null;
  portada: string | null;
  date_created: string | null;
  date_updated: string | null;
};

export type DirectusEjercicioCategoria = {
  id: number;
  ejercicios_id_ejercicio: number | null;
  categorias_id_categoria: number | null;
  date_created: string | null;
  date_updated: string | null;
};

function getEnv(): { url: string; token: string } {
  const url = process.env["DIRECTUS_URL"];
  const token = process.env["DIRECTUS_SYNC_TOKEN"];
  if (!url || !token) {
    throw new Error(
      "[sync] DIRECTUS_URL y DIRECTUS_SYNC_TOKEN deben configurarse en Convex env",
    );
  }
  return { url: url.replace(/\/$/, ""), token };
}

async function directusGet<T>(path: string): Promise<T[]> {
  const { url, token } = getEnv();
  const fullUrl = `${url}${path}`;
  const r = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`[sync] Directus ${r.status} ${r.statusText}: ${body.slice(0, 200)}`);
  }
  const json = (await r.json()) as { data: T[] };
  return json.data;
}

function buildQuery(fields: string[], extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    fields: fields.join(","),
    limit: "-1",
    ...extra,
  });
  return params.toString();
}

function sinceFilter(sinceMs: number): Record<string, string> {
  if (sinceMs <= 0) return {};
  const iso = new Date(sinceMs).toISOString();
  // `_or` para capturar filas con `date_updated` NULL (típicas de M2M creadas
  // vía UI Directus): el predicado se cumple por `date_created`.
  return {
    "filter[_or][0][date_updated][_gt]": iso,
    "filter[_or][1][date_created][_gt]": iso,
  };
}

export async function fetchCategoriasUpdatedSince(
  sinceMs: number,
): Promise<DirectusCategoria[]> {
  const fields = [
    "id_categoria",
    "nombre_categoria",
    "date_created",
    "date_updated",
  ];
  return directusGet<DirectusCategoria>(
    `/items/categorias?${buildQuery(fields, sinceFilter(sinceMs))}`,
  );
}

export async function fetchEjerciciosUpdatedSince(
  sinceMs: number,
): Promise<DirectusEjercicio[]> {
  const fields = [
    "id_ejercicio",
    "nombre_ejercicio",
    "descripcion",
    "es_por_duracion",
    "series_defecto",
    "repeticiones_defecto",
    "duracion_defecto",
    "video",
    "portada",
    "date_created",
    "date_updated",
  ];
  return directusGet<DirectusEjercicio>(
    `/items/ejercicios?${buildQuery(fields, sinceFilter(sinceMs))}`,
  );
}

export async function fetchEjerciciosCategoriasUpdatedSince(
  sinceMs: number,
): Promise<DirectusEjercicioCategoria[]> {
  const fields = [
    "id",
    "ejercicios_id_ejercicio",
    "categorias_id_categoria",
    "date_created",
    "date_updated",
  ];
  return directusGet<DirectusEjercicioCategoria>(
    `/items/ejercicios_categorias?${buildQuery(fields, sinceFilter(sinceMs))}`,
  );
}

export async function fetchAliveEjercicioIds(): Promise<number[]> {
  const rows = await directusGet<{ id_ejercicio: number }>(
    `/items/ejercicios?${buildQuery(["id_ejercicio"])}`,
  );
  return rows.map((r) => r.id_ejercicio);
}

export async function fetchAliveEjercicioCategoriaIds(): Promise<number[]> {
  const rows = await directusGet<{ id: number }>(
    `/items/ejercicios_categorias?${buildQuery(["id"])}`,
  );
  return rows.map((r) => r.id);
}

/** Convierte el campo string|number de Directus a number (o undefined si no parsea). */
export function toNumberOrUndefined(
  raw: string | number | null | undefined,
): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Devuelve ms UNIX a partir de un ISO string Directus. 0 si null/inválido. */
export function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Timestamp efectivo de una fila Directus: `max(date_updated, date_created)`.
 *  Necesario porque las filas creadas vía UI (típicamente M2M) nacen con
 *  `date_updated = NULL`; sin este fallback el sync incremental las ignoraba. */
export function effectiveUpdatedMs(row: {
  date_updated: string | null;
  date_created: string | null;
}): number {
  return Math.max(isoToMs(row.date_updated), isoToMs(row.date_created));
}
